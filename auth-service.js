// ═══════════════════════════════════════════════════════════════════════
//  auth-service.js — منصة الدكتور محمد عبد الله | عميد الفيزياء
//  نظام المصادقة الوحيد للمنصة (الطالب + لوحة التحكم)
//
//  المبدأ: Firestore هو مصدر الحقيقة — لا المتصفح. لا Firebase Authentication
//  ولا إيميل إطلاقاً: الحساب = مستند users/{رقم الهاتف}.
//   • إنشاء الحساب = كتابة هذا المستند مباشرة (معاملة ذرّية لا تكتب فوق حساب موجود).
//   • كلمة المرور تُخزَّن مُجزَّأة (SHA-256 + ملح + رقم الهاتف) في passwordHash.
//   • الأدمن = وجود مستند admins/{رقم الهاتف} (يُضاف من Firebase Console فقط).
//   • localStorage هنا "كاش للعرض فقط" بعد نجاح الدخول — لا يُعتمد عليه أبداً.
//
//  الفصل بين المراحل (كل مرحلة دالة مستقلة):
//     accountExists(phone)          ← هل الرقم مسجّل؟         (users/{phone})
//     verifyPassword(phone, pw)     ← هل كلمة المرور صحيحة؟    (مقارنة التجزئة)
//     createSession(rec)            ← إنشاء الجلسة وتحميل الحساب
//     restoreSession()              ← استعادة الجلسة عند فتح الموقع
// ═══════════════════════════════════════════════════════════════════════
(function (global) {
    'use strict';

    var CFG = {
        salt: 'drmohamed-physics-v1',   // ملح تجزئة كلمات المرور (لا تغيّره: كل الحسابات المسجَّلة مجزّأة به)
        readyTimeoutMs: 7000
    };
    var CACHE_KEY = 'iraqiplatform_current_user';   // كاش للعرض فقط
    var PERSIST_KEY = 'authsvc_persist', ALIVE_KEY = 'authsvc_alive';
    var ADMIN_CACHE_KEY = 'alsaqr_current_user';    // كاش جلسة لوحة التحكم (للعرض فقط)

    var MESSAGES = {
        phone_not_registered: 'رقم الهاتف غير مسجل — This phone number is not registered.',
        wrong_password: 'كلمة المرور غير صحيحة — Incorrect password.',
        invalid_phone: 'رقم الهاتف يجب أن يكون 11 رقمًا ويبدأ بـ 01 — Phone must be 11 digits starting with 01.',
        invalid_input: 'من فضلك أدخل رقم الهاتف وكلمة المرور — Please enter your phone number and password.',
        account_missing: 'الحساب غير مفعّل بعد. تواصل مع الدعم — Account is not activated yet. Please contact support.',
        profile_missing: 'بيانات الحساب غير مكتملة. تواصل مع الدعم — Account data is incomplete. Please contact support.',
        too_many_attempts: 'محاولات كثيرة. حاول لاحقًا — Too many attempts. Please try again later.',
        network: 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى — Could not reach the server. Check your connection.',
        disabled: 'هذا الحساب موقوف. تواصل مع الدعم — This account is disabled. Please contact support.',
        phone_taken: 'رقم الهاتف مسجل بالفعل. سجّل الدخول بدلًا من ذلك — This phone number is already registered.',
        weak_password: 'كلمة المرور ضعيفة (6 أحرف/أرقام على الأقل) — Password is too weak (min 6 characters).',
        not_admin: 'هذا الحساب ليس حساب مدرس/أدمن — This account is not an administrator.',
        unknown: 'حدث خطأ غير متوقع. حاول مرة أخرى — Something went wrong. Please try again.',
        // أخطاء من Firestore نفسه (ليست من بيانات الطالب): تُعرض برمز الخطأ ليسهل تشخيصها
        db_denied: 'تعذّر حفظ الحساب الآن: قاعدة البيانات لم تسمح بالعملية. تواصل مع الدعم — The database did not allow this request. Please contact support.',
        db_missing: 'قاعدة البيانات غير متاحة حاليًا. تواصل مع الدعم — The database is not available right now. Please contact support.'
    };

    var state = { user: null, admin: false, verified: false, ready: false, uid: null };
    var readyPromise = null;
    var subscribed = false;

    // ── أدوات ───────────────────────────────────────────────────────
    function db() { return global.db || null; }
    function fv() { return global.firebase && global.firebase.firestore && global.firebase.firestore.FieldValue; }
    function AuthError(code, extra) { var e = new Error(MESSAGES[code] || code); e.code = code; e.detail = extra; return e; }
    function message(code) { return MESSAGES[code] || MESSAGES.unknown; }

    function normalizePhone(raw) {
        var s = String(raw == null ? '' : raw);
        // أرقام عربية/فارسية → لاتينية
        s = s.replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
             .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
        s = s.replace(/[^0-9]/g, '');
        if (s.length === 12 && s.indexOf('20') === 0) s = '0' + s.slice(2);       // +20 1x... → 01x...
        return /^01\d{9}$/.test(s) ? s : null;
    }

    // تحويل خطأ Firestore إلى رسالة مفهومة. الحساب يُقرأ/يُكتب في Firestore مباشرة، لذا الأخطاء هنا
    // هي أخطاء Firestore (permission-denied / not-found ...) وليست أخطاء Firebase Auth.
    function mapAuthError(e) {
        var c = (e && e.code) || '';
        if (e && e.code && MESSAGES[e.code]) return e;
        var kind = 'unknown', hint = '';
        if (c === 'permission-denied' || c === 'unauthenticated') {
            kind = 'db_denied';
            hint = 'قواعد Firestore الحالية في Firebase Console ترفض قراءة/كتابة users/{رقم الهاتف}. الحل: انسخ firestore.rules من المشروع إلى Firestore ← Rules ← Publish (انظر README-auth.md).';
        } else if (c === 'not-found') {
            kind = 'db_missing';
            hint = 'قاعدة Firestore غير موجودة في مشروع Firebase هذا. الحل: Firebase Console ← Firestore Database ← Create database (وضع Production ثم انشر firestore.rules).';
        }
        try { console.error('[AuthService] ' + (hint ? hint + ' ' : 'unexpected error: '), c, e && e.message); } catch (_) {}
        var out = AuthError(kind, e && e.message);
        if (c) out.message += ' [' + c + ']';
        return out;
    }
    function isNetworkErr(e) {
        var c = (e && e.code) || '';
        return c === 'unavailable' || c === 'network' || /network|offline|unavailable/i.test((e && e.message) || '');
    }
    function emit() {
        try { global.dispatchEvent(new CustomEvent('authchange', { detail: { user: state.user, admin: state.admin } })); } catch (e) {}
    }

    // ── الكاش (عرض فقط) ─────────────────────────────────────────────
    function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
    function writeCache() {
        try {
            if (!state.user) { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(ADMIN_CACHE_KEY); return; }
            localStorage.setItem(CACHE_KEY, JSON.stringify(state.user));
            if (state.admin) {
                localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ id: state.user.id, name: state.user.name, role: 'admin', email: state.user.email || '', phone: state.user.phone, loginAt: new Date().toISOString() }));
            } else {
                localStorage.removeItem(ADMIN_CACHE_KEY);     // أي جلسة أدمن محلية بلا أدمن حقيقي تُمحى
            }
        } catch (e) {}
    }
    // بيانات خاصة بمستخدم معيّن — تُمحى عند الخروج أو تبديل الحساب حتى لا تظهر لحساب آخر
    function purgeUserData() {
        try {
            var kill = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && (k.indexOf('iraqi_qs_attempts_') === 0 || k === 'iraqi_lesson_progress')) kill.push(k);
            }
            kill.forEach(function (k) { localStorage.removeItem(k); });
            ['iraqiplatform_users', 'alsaqr_users', 'iraqiplatform_current_user', 'alsaqr_current_user', 'alsaqr_quiz_attempts'].forEach(function (k) { localStorage.removeItem(k); });
            sessionStorage.removeItem('iraqiplatform_redirect');
        } catch (e) {}
    }

    // ── المصادقة عبر قاعدة البيانات مباشرة (بدون Firebase Auth / بدون إيميل) ─────
    // الحساب = مستند users/{رقم الهاتف}. كلمة المرور تُخزَّن مُجزَّأة (SHA-256) لا نصًا صريحًا.
    function sha256Hex(str) {
        if (!global.crypto || !global.crypto.subtle) return Promise.reject(AuthError('unknown'));
        return global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
            return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        });
    }
    function hashPassword(phone, password) { return sha256Hex(CFG.salt + ':' + phone + ':' + String(password)); }
    function userRef(id) { return db().collection('users').doc(String(id)); }
    function errOut(e) { var err = (e && e.code && MESSAGES[e.code]) ? e : (isNetworkErr(e) ? AuthError('network') : mapAuthError(e)); return { ok: false, code: err.code, message: err.message }; }
    function stripSecrets(d) { var p = Object.assign({}, d); delete p.password; delete p.passwordHash; return p; }

    // مستند الطالب بالرقم (المعرّف = الرقم، مع بحث احتياطي للمستندات القديمة)
    function fetchUserDoc(phone) {
        return userRef(phone).get({ source: 'server' }).then(function (snap) {
            if (snap.exists) return { id: snap.id, data: snap.data() || {} };
            return db().collection('users').where('phone', '==', phone).limit(1).get({ source: 'server' }).then(function (q) {
                if (q.empty) return null;
                var d = q.docs[0]; return { id: d.id, data: d.data() || {} };
            });
        });
    }
    function accountExists(phone) {
        if (!db()) return Promise.reject(AuthError('network'));
        return fetchUserDoc(phone).then(function (rec) { return !!rec; }, function (e) { throw isNetworkErr(e) ? AuthError('network') : mapAuthError(e); });
    }
    function verifyPassword(phone, password) {
        if (!db()) return Promise.reject(AuthError('network'));
        return fetchUserDoc(phone).then(function (rec) {
            if (!rec) throw AuthError('phone_not_registered');
            if (rec.data.disabled) throw AuthError('disabled');
            return hashPassword(phone, password).then(function (h) {
                if (rec.data.passwordHash) { if (rec.data.passwordHash !== h) throw AuthError('wrong_password'); return rec; }
                if (rec.data.password !== undefined && String(rec.data.password) === String(password)) {   // حساب قديم بكلمة مرور نصية: نرقّيه لتجزئة
                    userRef(rec.id).update({ passwordHash: h, password: fv().delete() }).catch(function () {});
                    return rec;
                }
                throw AuthError(rec.data.password !== undefined ? 'wrong_password' : 'account_missing');
            });
        }, function (e) { throw (e && e.code && MESSAGES[e.code]) ? e : (isNetworkErr(e) ? AuthError('network') : mapAuthError(e)); });
    }

    // ── إنشاء الجلسة ─────────────────────────────────────────────────
    function checkAdmin(id) {
        return db().collection('admins').doc(String(id)).get({ source: 'server' }).then(function (s) { return !!s.exists; }, function () { return false; });
    }
    function createSession(rec) {
        var profile = stripSecrets(rec.data); profile.id = rec.id;
        return checkAdmin(rec.id).then(function (isAdm) {
            var prev = readCache();
            if (prev && prev.id && String(prev.id) !== String(rec.id)) purgeUserData();     // حساب مختلف: لا نُبقي شيئاً من الحساب السابق
            state.user = profile; state.admin = isAdm; state.verified = true; state.uid = rec.id;
            writeCache(); emit();
            return state.user;
        });
    }
    function setPersist(mode) { try { localStorage.setItem(PERSIST_KEY, mode); sessionStorage.setItem(ALIVE_KEY, '1'); } catch (e) {} }
    function sessionAllowed() { try { return localStorage.getItem(PERSIST_KEY) !== 'session' || sessionStorage.getItem(ALIVE_KEY) === '1'; } catch (e) { return true; } }

    // ── استعادة الجلسة عند فتح الموقع ───────────────────────────────
    function restoreSession() {
        var cached = readCache();
        if (!cached || !cached.id) { clearState(); return Promise.resolve(null); }
        if (!sessionAllowed()) { purgeUserData(); clearState(); return Promise.resolve(null); }
        if (!db()) return Promise.resolve(null);
        return userRef(cached.id).get({ source: 'server' }).then(function (snap) {
            if (!snap.exists || (snap.data() || {}).disabled) { purgeUserData(); clearState(); return null; }   // حُذف/أُوقف
            return createSession({ id: snap.id, data: snap.data() || {} });
        }, function (e) {
            if (isNetworkErr(e)) {   // بلا اتصال: نعرض الكاش فقط (غير موثّق)
                state.user = cached; state.admin = !!localStorage.getItem(ADMIN_CACHE_KEY); state.verified = false; state.uid = cached.id; emit();
                return null;
            }
            clearState(); return null;
        }).then(function (user) { subscribeToChanges(); return user; });
    }
    function clearState() {
        var had = !!state.user;
        state.user = null; state.admin = false; state.verified = false; state.uid = null;
        try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(ADMIN_CACHE_KEY); } catch (e) {}
        if (had) emit();
    }
    // خروج/دخول من تبويب آخر
    function subscribeToChanges() {
        if (subscribed) return; subscribed = true;
        global.addEventListener('storage', function (ev) {
            if (ev.key === CACHE_KEY && !ev.newValue && state.user) { state.user = null; state.admin = false; state.verified = false; state.uid = null; emit(); }
        });
    }

    // ── تسجيل الدخول ────────────────────────────────────────────────
    function login(phoneRaw, password, opts) {
        var phone = normalizePhone(phoneRaw);
        if (!phoneRaw || !password) return Promise.resolve({ ok: false, code: 'invalid_input', message: message('invalid_input') });
        if (!phone) return Promise.resolve({ ok: false, code: 'invalid_phone', message: message('invalid_phone') });
        var mode = (opts && opts.remember === false) ? 'session' : 'local';
        return verifyPassword(phone, password)
            .then(function (rec) { setPersist(mode); return createSession(rec); })
            .then(function (user) { return { ok: true, user: user, admin: state.admin }; })
            .catch(errOut);
    }

    // ── تسجيل حساب جديد: يُكتب الحساب مباشرة في قاعدة البيانات ثم يدخل الطالب فورًا ─────
    function register(f) {
        f = f || {};
        var phone = normalizePhone(f.phone);
        if (!phone) return Promise.resolve({ ok: false, code: 'invalid_phone', message: message('invalid_phone') });
        if (!f.password || String(f.password).length < 6) return Promise.resolve({ ok: false, code: 'weak_password', message: message('weak_password') });
        if (!db()) return Promise.resolve(errOut(AuthError('network')));
        var now = new Date().toISOString();
        return accountExists(phone).then(function (exists) {
            if (exists) throw AuthError('phone_taken');
            return hashPassword(phone, f.password);
        }).then(function (hash) {
            var profile = {
                id: phone, name: f.name || '', phone: phone, parentPhone: f.parentPhone || '',
                grade: f.grade || '', section: f.section || '', governorate: f.governorate || '',
                enrolledCourses: [], completedLessons: 0, avgScore: 0, streak: 1, createdAt: now, passwordHash: hash
            };
            var ref = userRef(phone);
            return db().runTransaction(function (tx) {          // إنشاء ذرّي: لا يُكتب فوق حساب موجود
                return tx.get(ref).then(function (s) { if (s.exists) throw AuthError('phone_taken'); tx.set(ref, profile); });
            }).then(function () { return { id: phone, data: profile }; });
        }).then(function (rec) { setPersist('local'); return createSession(rec); })
          .then(function (user) { return { ok: true, user: user }; })
          .catch(errOut);
    }

    // ── خروج ────────────────────────────────────────────────────────
    function logout() {
        purgeUserData(); clearState();
        try { localStorage.removeItem(PERSIST_KEY); sessionStorage.removeItem(ALIVE_KEY); } catch (e) {}
        emit();
        return Promise.resolve(true);
    }

    // ── عمليات الحساب الحالي ─────────────────────────────────────────
    var EDITABLE = ['name', 'parentPhone', 'grade', 'section', 'governorate'];   // رقم الهاتف هو معرّف الدخول: لا يُغيَّر من المتصفح
    function updateProfile(patch) {
        if (!state.user) return Promise.resolve({ ok: false, code: 'unknown' });
        var clean = {}; EDITABLE.forEach(function (k) { if (patch && patch[k] !== undefined) clean[k] = patch[k]; });
        return userRef(state.uid).update(clean).then(function () {
            Object.assign(state.user, clean); writeCache(); emit(); return { ok: true, user: state.user };
        }, function (e) { return { ok: false, code: isNetworkErr(e) ? 'network' : 'unknown', message: message(isNetworkErr(e) ? 'network' : 'unknown') }; });
    }
    function enroll(courseId) {
        if (!state.user) return Promise.resolve({ ok: false });
        var cid = String(courseId);
        return userRef(state.uid).update({ enrolledCourses: fv().arrayUnion(cid) }).then(function () {
            var list = (state.user.enrolledCourses || []).map(String);
            if (list.indexOf(cid) === -1) state.user.enrolledCourses = list.concat([cid]);
            writeCache(); emit(); return { ok: true };
        }, function (e) { return { ok: false, code: 'unknown', message: e && e.message }; });
    }
    function changePassword(current, next) {
        if (!state.user) return Promise.resolve({ ok: false, code: 'unknown', message: message('unknown') });
        if (!next || String(next).length < 6) return Promise.resolve({ ok: false, code: 'weak_password', message: message('weak_password') });
        var phone = state.user.phone || state.uid;
        return verifyPassword(phone, current)
            .then(function (rec) { return hashPassword(phone, next).then(function (h) { return userRef(rec.id).update({ passwordHash: h }); }); })
            .then(function () { return { ok: true }; }, errOut);
    }

    // ── الأدمن (لوحة التحكم): وجود مستند admins/{رقم الهاتف} ─────────────
    function isAdmin() { return !!(state.user && state.admin); }
    function requireAdmin() {
        return whenReady().then(function () {
            if (!state.user || !state.uid) return false;
            return checkAdmin(state.uid).then(function (ok) { state.admin = ok; if (!ok) writeCache(); return ok; });
        });
    }
    function adminLogin(phone, password) {
        return login(phone, password, { remember: true }).then(function (r) {
            if (!r.ok) return r;
            if (!state.admin) return { ok: false, code: 'not_admin', message: message('not_admin') };
            return r;
        });
    }

    // ── جاهزية الخدمة ────────────────────────────────────────────────
    function init() {
        if (readyPromise) return readyPromise;
        var timeout = new Promise(function (res) { setTimeout(function () { res('timeout'); }, CFG.readyTimeoutMs); });
        readyPromise = Promise.race([restoreSession().catch(function () { clearState(); return null; }), timeout]).then(function (r) {
            state.ready = true; if (r === 'timeout') clearState(); return state.user;
        });
        return readyPromise;
    }
    function whenReady() { return init(); }

    global.AuthService = {
        CFG: CFG, message: message, messages: MESSAGES, normalizePhone: normalizePhone,
        accountExists: accountExists, verifyPassword: verifyPassword, createSession: createSession, restoreSession: restoreSession,
        login: login, register: register, logout: logout, changePassword: changePassword, updateProfile: updateProfile, enroll: enroll,
        isAdmin: isAdmin, requireAdmin: requireAdmin, adminLogin: adminLogin,
        getCurrentUser: function () { return state.user; }, isLoggedIn: function () { return !!state.user; },
        isVerified: function () { return state.verified; }, ready: whenReady, init: init
    };

    // ابدأ استعادة الجلسة فور تحميل الصفحة
    init();
})(window);
