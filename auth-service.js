// ═══════════════════════════════════════════════════════════════════════
//  auth-service.js — منصة الدكتور محمد عبد الله | عميد الفيزياء
//  نظام المصادقة الوحيد للمنصة (الطالب + لوحة التحكم)
//
//  المبدأ: قاعدة البيانات/خدمة المصادقة هي مصدر الحقيقة — لا المتصفح.
//   • التحقق من كلمة المرور يتم على خوادم Firebase Authentication (كلمات المرور
//     مشفّرة هناك ولا تُخزَّن ولا تُنزَّل إلى أي متصفح).
//   • وجود الحساب يُفحص من قاعدة البيانات (phone_index) قبل أي محاولة دخول.
//   • الجلسة تحفظها Firebase Auth (رموز موقّعة من الخادم) وتبقى بعد إغلاق المتصفح.
//   • localStorage هنا "كاش للعرض فقط" بعد نجاح الدخول — لا يُعتمد عليه أبداً.
//
//  الفصل المطلوب بين المراحل (كل مرحلة دالة مستقلة):
//     accountExists(phone)          ← هل الرقم مسجّل؟         (phone_index)
//     verifyPassword(phone, pw)     ← هل كلمة المرور صحيحة؟    (Firebase Auth)
//     createSession(fbUser)         ← إنشاء الجلسة وتحميل الحساب (users/{uid})
//     restoreSession()              ← استعادة الجلسة عند فتح الموقع
// ═══════════════════════════════════════════════════════════════════════
(function (global) {
    'use strict';

    var CFG = {
        // البريد الداخلي المشتق من رقم الهاتف (لا يُرسل إليه شيء — هو مجرد معرّف للحساب في Firebase Auth)
        emailDomain: 'phone.drmohamed-physics.app',
        readyTimeoutMs: 7000
    };
    var CACHE_KEY = 'iraqiplatform_current_user';   // كاش للعرض فقط
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
        setup: 'الخدمة غير مهيأة بعد. تواصل مع الدعم — Service is not configured yet. Please contact support.'
    };

    var state = { user: null, admin: false, verified: false, ready: false, uid: null };
    var readyPromise = null;
    var subscribed = false;

    // ── أدوات ───────────────────────────────────────────────────────
    function fbAuth() { return global.firebase && typeof global.firebase.auth === 'function' ? global.firebase.auth() : null; }
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
    function phoneToEmail(phone) { return phone + '@' + CFG.emailDomain; }

    function mapAuthError(e) {
        var c = (e && e.code) || '';
        if (c === 'auth/wrong-password' || c === 'auth/invalid-credential' || c === 'auth/invalid-login-credentials') return AuthError('wrong_password');
        if (c === 'auth/user-not-found') return AuthError('account_missing');
        if (c === 'auth/too-many-requests') return AuthError('too_many_attempts');
        if (c === 'auth/network-request-failed') return AuthError('network');
        if (c === 'auth/user-disabled') return AuthError('disabled');
        if (c === 'auth/invalid-email') return AuthError('invalid_phone');
        if (c === 'auth/weak-password') return AuthError('weak_password');
        if (c === 'auth/email-already-in-use') return AuthError('phone_taken');
        if (e && e.code && MESSAGES[e.code]) return e;
        try { console.error('[AuthService] unexpected error:', c, e && e.message); } catch (_) {}
        var isSetup = /^(auth\/(operation-not-allowed|configuration-not-found|invalid-api-key|api-key-not-valid.*|app-not-authorized|unauthorized-domain)|permission-denied|failed-precondition|not-found|unauthenticated)$/.test(c);
        var out = AuthError(isSetup ? 'setup' : 'unknown', e && e.message);
        if (c) out.message += ' [' + c + ']';
        return out;
    }
    function isNetworkErr(e) {
        var c = (e && e.code) || '';
        return c === 'unavailable' || c === 'auth/network-request-failed' || c === 'network' || /network|offline|unavailable/i.test((e && e.message) || '');
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

    // ── المرحلة 1: هل الحساب موجود؟ (قاعدة البيانات) ──────────────────
    function accountExists(phone) {
        if (!db()) return Promise.reject(AuthError('network'));
        return db().collection('phone_index').doc(phone).get({ source: 'server' }).then(function (snap) {
            return !!snap.exists;
        }, function (e) { throw isNetworkErr(e) ? AuthError('network') : mapAuthError(e); });
    }

    // ── المرحلة 2: هل كلمة المرور صحيحة؟ (Firebase Auth على الخادم) ─────
    function verifyPassword(phone, password) {
        var a = fbAuth();
        if (!a) return Promise.reject(AuthError('network'));
        return a.signInWithEmailAndPassword(phoneToEmail(phone), password).then(function (cred) { return cred.user; }, function (e) { throw mapAuthError(e); });
    }

    // ── المرحلة 3: إنشاء الجلسة وتحميل الحساب من قاعدة البيانات ─────────
    function loadProfile(uid) {
        return db().collection('users').doc(uid).get({ source: 'server' }).then(function (snap) {
            if (!snap.exists) return null;
            var d = snap.data() || {};
            delete d.password;                 // كلمات المرور لا تُستخدم ولا تُعرض أبداً
            d.id = uid;
            return d;
        });
    }
    function checkAdmin(uid) {
        return db().collection('admins').doc(uid).get({ source: 'server' }).then(function (s) { return !!s.exists; }, function () { return false; });
    }
    function createSession(fbUser) {
        var uid = fbUser.uid;
        return loadProfile(uid).then(function (profile) {
            if (!profile) { var a = fbAuth(); return (a ? a.signOut() : Promise.resolve()).then(function () { throw AuthError('profile_missing'); }); }
            return checkAdmin(uid).then(function (isAdm) {
                var prev = readCache();
                if (prev && prev.id && String(prev.id) !== String(uid)) purgeUserData();     // حساب مختلف: لا نُبقي شيئاً من الحساب السابق
                state.user = profile; state.admin = isAdm; state.verified = true; state.uid = uid;
                writeCache(); emit();
                return state.user;
            });
        });
    }

    // ── المرحلة 4: استعادة الجلسة عند فتح الموقع ────────────────────────
    function firstAuthState() {
        var a = fbAuth();
        return new Promise(function (resolve) {
            if (!a) return resolve(null);
            var un = a.onAuthStateChanged(function (u) { try { un(); } catch (e) {} resolve(u || null); }, function () { resolve(null); });
        });
    }
    function restoreSession() {
        return firstAuthState().then(function (u) {
            if (!u) { clearState(); return null; }
            // تحقق من الخادم أن الحساب ما زال صالحاً (لم يُحذف/يُوقف)
            return u.reload().then(function () { return createSession(u); }, function (e) {
                var c = (e && e.code) || '';
                if (c === 'auth/network-request-failed' || isNetworkErr(e)) {
                    // بلا اتصال: الهوية تأتي من Firebase (uid موقّع) لا من الكاش؛ الكاش يُستخدم للعرض فقط إن طابق نفس الـ uid
                    var cached = readCache();
                    if (cached && String(cached.id) === String(u.uid)) { state.user = cached; state.admin = !!localStorage.getItem(ADMIN_CACHE_KEY); state.verified = false; state.uid = u.uid; emit(); return state.user; }
                    return null;
                }
                var a = fbAuth();
                return (a ? a.signOut() : Promise.resolve()).then(function () { clearState(); return null; });   // محذوف/موقوف/رمز غير صالح
            });
        }).then(function (user) { subscribeToChanges(); return user; });
    }
    function clearState() {
        var had = !!state.user;
        state.user = null; state.admin = false; state.verified = false; state.uid = null;
        try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(ADMIN_CACHE_KEY); } catch (e) {}
        if (had) emit();
    }
    // تغيّر الجلسة من تبويب آخر (خروج/دخول)
    function subscribeToChanges() {
        if (subscribed) return; subscribed = true;
        var a = fbAuth(); if (!a) return;
        a.onAuthStateChanged(function (u) {
            if (!u && state.user) { purgeUserData(); clearState(); }
            else if (u && state.uid && u.uid !== state.uid) { createSession(u).catch(function () {}); }
        });
    }

    // ── تسجيل الدخول (يجمع المراحل بالترتيب — كل مرحلة منفصلة) ───────────
    function login(phoneRaw, password, opts) {
        var phone = normalizePhone(phoneRaw);
        if (!phoneRaw || !password) return Promise.resolve({ ok: false, code: 'invalid_input', message: message('invalid_input') });
        if (!phone) return Promise.resolve({ ok: false, code: 'invalid_phone', message: message('invalid_phone') });
        var a = fbAuth();
        var persist = (opts && opts.remember === false) ? 'session' : 'local';
        var setP = (a && a.setPersistence && global.firebase.auth.Auth && global.firebase.auth.Auth.Persistence)
            ? a.setPersistence(persist === 'session' ? global.firebase.auth.Auth.Persistence.SESSION : global.firebase.auth.Auth.Persistence.LOCAL).catch(function () {})
            : Promise.resolve();
        return setP
            .then(function () { return accountExists(phone); })                                   // 1) الحساب موجود؟
            .then(function (exists) {
                if (!exists) throw AuthError('phone_not_registered');                              //    لا → لا نُنشئ حساباً ولا نجرّب كلمة المرور
                return verifyPassword(phone, password);                                            // 2) كلمة المرور
            })
            .then(function (fbUser) { return createSession(fbUser); })                            // 3) الجلسة
            .then(function (user) { return { ok: true, user: user, admin: state.admin }; })
            .catch(function (e) {
                var err = (e && e.code && MESSAGES[e.code]) ? e : mapAuthError(e);
                return { ok: false, code: err.code, message: err.message };
            });
    }

    // ── تسجيل حساب جديد ─────────────────────────────────────────────
    function createProfileDocs(fbUser, phone, f) {
        var uid = fbUser.uid, now = new Date().toISOString();
        var profile = {
            id: uid, name: f.name || '', email: '', phone: phone, parentPhone: f.parentPhone || '',
            grade: f.grade || '', section: f.section || '', governorate: f.governorate || '',
            enrolledCourses: [], completedLessons: 0, avgScore: 0, streak: 1, createdAt: now
        };
        var batch = db().batch();
        batch.set(db().collection('phone_index').doc(phone), { uid: uid, createdAt: now });
        batch.set(db().collection('users').doc(uid), profile);
        return batch.commit();
    }
    function register(f) {
        var phone = normalizePhone(f && f.phone);
        if (!phone) return Promise.resolve({ ok: false, code: 'invalid_phone', message: message('invalid_phone') });
        if (!f.password || String(f.password).length < 6) return Promise.resolve({ ok: false, code: 'weak_password', message: message('weak_password') });
        var a = fbAuth();
        return accountExists(phone).then(function (exists) {
            if (exists) throw AuthError('phone_taken');
            return a.createUserWithEmailAndPassword(phoneToEmail(phone), f.password).then(function (cred) {
                return createProfileDocs(cred.user, phone, f).then(function () { return cred.user; }, function (e) {
                    // فشلت كتابة الملف بعد إنشاء الحساب: نحاول حذف الحساب اليتيم حتى لا يعلق الرقم
                    return cred.user.delete().catch(function () {}).then(function () { throw isNetworkErr(e) ? AuthError('network') : mapAuthError(e); });
                });
            }, function (e) {
                if (e && e.code === 'auth/email-already-in-use') {
                    // حساب Auth موجود بلا فهرس/ملف (تسجيل سابق انقطع): لو نفس كلمة المرور نُكمل الإصلاح، وإلا الرقم محجوز
                    return verifyPassword(phone, f.password).then(function (u) {
                        return loadProfile(u.uid).then(function (p) { if (p) throw AuthError('phone_taken'); return createProfileDocs(u, phone, f).then(function () { return u; }); });
                    }, function () { throw AuthError('phone_taken'); });
                }
                throw mapAuthError(e);
            });
        }).then(function (fbUser) { return createSession(fbUser); })
          .then(function (user) { return { ok: true, user: user }; })
          .catch(function (e) { var err = (e && e.code && MESSAGES[e.code]) ? e : mapAuthError(e); return { ok: false, code: err.code, message: err.message }; });
    }

    // ── خروج ────────────────────────────────────────────────────────
    function logout() {
        var a = fbAuth();
        var p = a ? a.signOut() : Promise.resolve();
        return p.catch(function () {}).then(function () { purgeUserData(); clearState(); emit(); return true; });
    }

    // ── عمليات الحساب الحالي ─────────────────────────────────────────
    var EDITABLE = ['name', 'parentPhone', 'grade', 'section', 'governorate'];   // رقم الهاتف هو معرّف الدخول: لا يُغيَّر من المتصفح
    function updateProfile(patch) {
        if (!state.user) return Promise.resolve({ ok: false, code: 'unknown' });
        var clean = {}; EDITABLE.forEach(function (k) { if (patch && patch[k] !== undefined) clean[k] = patch[k]; });
        return db().collection('users').doc(state.uid).update(clean).then(function () {
            Object.assign(state.user, clean); writeCache(); emit(); return { ok: true, user: state.user };
        }, function (e) { return { ok: false, code: isNetworkErr(e) ? 'network' : 'unknown', message: message(isNetworkErr(e) ? 'network' : 'unknown') }; });
    }
    function enroll(courseId) {
        if (!state.user) return Promise.resolve({ ok: false });
        var cid = String(courseId);
        return db().collection('users').doc(state.uid).update({ enrolledCourses: fv().arrayUnion(cid) }).then(function () {
            var list = (state.user.enrolledCourses || []).map(String);
            if (list.indexOf(cid) === -1) state.user.enrolledCourses = list.concat([cid]);
            writeCache(); emit(); return { ok: true };
        }, function (e) { return { ok: false, code: 'unknown', message: e && e.message }; });
    }
    function changePassword(current, next) {
        var a = fbAuth(), u = a && a.currentUser;
        if (!u) return Promise.resolve({ ok: false, code: 'unknown', message: message('unknown') });
        if (!next || String(next).length < 6) return Promise.resolve({ ok: false, code: 'weak_password', message: message('weak_password') });
        var cred = global.firebase.auth.EmailAuthProvider.credential(u.email, current);
        return u.reauthenticateWithCredential(cred).then(function () { return u.updatePassword(next); })
            .then(function () { return { ok: true }; }, function (e) { var err = mapAuthError(e); return { ok: false, code: err.code, message: err.message }; });
    }

    // ── الأدمن (لوحة التحكم) ─────────────────────────────────────────
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
        CFG: CFG, message: message, messages: MESSAGES, normalizePhone: normalizePhone, phoneToEmail: phoneToEmail,
        accountExists: accountExists, verifyPassword: verifyPassword, createSession: createSession, restoreSession: restoreSession,
        login: login, register: register, logout: logout, changePassword: changePassword, updateProfile: updateProfile, enroll: enroll,
        isAdmin: isAdmin, requireAdmin: requireAdmin, adminLogin: adminLogin,
        getCurrentUser: function () { return state.user; }, isLoggedIn: function () { return !!state.user; },
        isVerified: function () { return state.verified; }, ready: whenReady, init: init
    };

    // ابدأ استعادة الجلسة فور تحميل الصفحة
    init();
})(window);
