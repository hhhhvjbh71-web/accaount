/**
 * teacher-core.js
 * ════════════════════════════════════════════════════════════════
 *  Multi-Teacher Architecture — البنية المعمارية لنظام المدرسين
 *
 *  المبدأ:
 *    teachers/{teacherId}/students/{id}      ← بيانات الطلاب
 *    teachers/{teacherId}/groups/{id}        ← المجموعات
 *    teachers/{teacherId}/payments/{id}      ← المدفوعات
 *    teachers/{teacherId}/attendance/{id}    ← الحضور
 *    ... وهكذا لكل الجداول
 *    teachers/{teacherId}/meta/settings      ← إعدادات المدرس
 *
 *  IndexedDB: كل record يحمل حقل `_tid` = teacherId
 *  عند db.load() يُقرأ كل الـ IndexedDB ثم يُفلتر بـ `_tid`
 *
 *  Firestore Reads:
 *    الأدمن:  يقرأ teachers/{tid}/... لمدرس محدد فقط عند الطلب
 *    المدرس:  يقرأ teachers/{tid}/... الخاص به فقط — لا شيء آخر
 *
 *  ممنوع تماماً:
 *    - قراءة collection بدون تحديد teacherId في المسار
 *    - مشاركة البيانات بين مدرسين
 *    - كتابة بيانات مدرس في مسار مدرس آخر
 * ════════════════════════════════════════════════════════════════
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   Session — معرفة المدرس الحالي
   يُقرأ من sessionStorage فقط (موثوق ومؤقت)
══════════════════════════════════════════════════════════════ */
const TeacherSession = (() => {
    const K_ID     = 'mt_active_teacher_id';
    const K_NAME   = 'mt_active_teacher_name';
    const K_SCHOOL = 'mt_active_teacher_school';
    const K_CENTER = 'mt_active_teacher_center';

    return {
        getId()     { return sessionStorage.getItem(K_ID)   || null; },
        getName()   { return sessionStorage.getItem(K_NAME) || null; },
        getSchool() { return sessionStorage.getItem(K_SCHOOL) || ''; },
        getCenter() { return sessionStorage.getItem(K_CENTER) || ''; },
        isTeacher() { return !!sessionStorage.getItem(K_ID); },
        isAdmin()   { return sessionStorage.getItem('app_role') === 'admin' && !sessionStorage.getItem(K_ID); },

        set(account) {
            sessionStorage.setItem(K_ID,     String(account.id));
            sessionStorage.setItem(K_NAME,   account.name || '');
            sessionStorage.setItem(K_SCHOOL, account.schoolName || '');
            sessionStorage.setItem(K_CENTER, account.centerName || '');
            sessionStorage.setItem('app_role', 'teacher');
        },

        clear() {
            [K_ID, K_NAME, K_SCHOOL, K_CENTER].forEach(k => sessionStorage.removeItem(k));
        }
    };
})();

/* ══════════════════════════════════════════════════════════════
   TeacherDB — Firestore operations
   المسار الثابت: teachers/{tid}/{table}/{docId}
══════════════════════════════════════════════════════════════ */
const TeacherDB = (() => {

    // الجداول التي تُعزَل بـ teacher_id
    const SCOPED_TABLES = [
        'students', 'groups', 'attendance', 'exams', 'scores',
        'expenses', 'handouts', 'studentHandouts', 'materials',
        'quizzes', 'rewards', 'payments', 'waQueue', 'cycles',
        'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts',
        'courseCodes', 'platformCourses', 'platformSubscriptions', 'secretaries',
    ];

    let _db = null; // Firestore instance

    /* ── تهيئة Firestore (مرة واحدة فقط) ── */
    async function _getFs() {
        if (_db) return _db;
        try {
            if (typeof firebase === 'undefined') {
                await _loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
                await _loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');
            }
            const cfg = window.FIREBASE_MAIN_CONFIG || {
                apiKey: "AIzaSyCoRAhBYIz4h0ApuoVOBDhzHennEzTaios",
                authDomain: "craaet-acount.firebaseapp.com",
                projectId: "craaet-acount",
                storageBucket: "craaet-acount.firebasestorage.app",
                messagingSenderId: "551671991771",
                appId: "1:551671991771:web:b541cc9884dc90faa22bfe"
            };
            // نستخدم نفس app «deviceSyncApp» الموجود أو ننشئه
            let app = firebase.apps.find(a => a.name === 'deviceSyncApp')
                   || firebase.apps.find(a => a.name === '[DEFAULT]');
            if (!app) app = firebase.initializeApp(cfg, 'deviceSyncApp');
            _db = app.firestore();
            // نحفظه في window.deviceSyncDb عشان يشتغل مع الكود الأصلي
            if (!window.deviceSyncDb) window.deviceSyncDb = _db;
        } catch(e) {
            console.error('[TeacherDB] Firestore init failed:', e);
        }
        return _db;
    }

    function _loadScript(src) {
        return new Promise(res => {
            if (document.querySelector(`script[src="${src}"]`)) return res();
            const s = document.createElement('script');
            s.src = src; s.onload = res; s.onerror = res;
            document.head.appendChild(s);
        });
    }

    /* ── مسار Firestore للمدرس ── */
    function _col(tid, table) {
        // teachers/{tid}/{table}
        return `teachers/${tid}/${table}`;
    }

    /* ── رفع جدول كامل لمدرس معين (batch write) ── */
    async function uploadTable(tid, tableName, records) {
        if (!tid) throw new Error('teacherId required');
        const fs = await _getFs();
        if (!fs) throw new Error('Firestore not available');

        const colPath = _col(tid, tableName);
        let batch = fs.batch();
        let count = 0;
        let total = 0;

        for (const rec of records) {
            if (rec.id === undefined || rec.id === null) continue;
            const ref = fs.collection(colPath).doc(String(rec.id));
            // نحذف _tid من السجل المرفوع (ضوضاء غير ضرورية في Firestore)
            const { _tid: _, ...cleanRec } = rec;
            batch.set(ref, {
                ...cleanRec,
                _syncedAt: new Date().toISOString(),
                _tid: tid,
            }, { merge: true });
            count++; total++;
            if (count >= 450) { await batch.commit(); batch = fs.batch(); count = 0; }
        }
        if (count > 0) await batch.commit();
        return total;
    }

    /* ── استلام جدول كامل لمدرس معين ── */
    async function downloadTable(tid, tableName) {
        if (!tid) throw new Error('teacherId required');
        const fs = await _getFs();
        if (!fs) throw new Error('Firestore not available');

        const snap = await fs.collection(_col(tid, tableName)).get();
        return snap.docs.map(d => {
            const data = d.data();
            return { ...data, id: data.id || Number(d.id) || d.id, _tid: tid };
        });
    }

    /* ── حفظ سجل واحد (للعمليات الفورية) ── */
    async function saveRecord(tid, tableName, record) {
        if (!tid || !record?.id) return false;
        const fs = await _getFs();
        if (!fs) return false;
        try {
            await fs.collection(_col(tid, tableName)).doc(String(record.id)).set({
                ...record,
                _tid: tid,
                _syncedAt: new Date().toISOString()
            }, { merge: true });
            return true;
        } catch(e) { console.warn('[TeacherDB] saveRecord:', e); return false; }
    }

    /* ── حذف سجل واحد ── */
    async function deleteRecord(tid, tableName, id) {
        if (!tid || !id) return;
        const fs = await _getFs();
        if (!fs) return;
        try { await fs.collection(_col(tid, tableName)).doc(String(id)).delete(); }
        catch(e) { console.warn('[TeacherDB] deleteRecord:', e); }
    }

    /* ── رفع إعدادات المدرس ── */
    async function uploadSettings(tid, settings) {
        if (!tid) return;
        const fs = await _getFs();
        if (!fs) return;
        try {
            await fs.collection(`teachers/${tid}/meta`).doc('settings').set({
                data: JSON.stringify(settings),
                _syncedAt: new Date().toISOString()
            }, { merge: true });
        } catch(e) { console.warn('[TeacherDB] uploadSettings:', e); }
    }

    /* ── استلام إعدادات المدرس ── */
    async function downloadSettings(tid) {
        if (!tid) return null;
        const fs = await _getFs();
        if (!fs) return null;
        try {
            const doc = await fs.collection(`teachers/${tid}/meta`).doc('settings').get();
            if (!doc.exists) return null;
            return JSON.parse(doc.data().data || '{}');
        } catch(e) { console.warn('[TeacherDB] downloadSettings:', e); return null; }
    }

    /* ── رفع كل بيانات مدرس دفعة واحدة ── */
    async function uploadAll(tid, onProgress) {
        if (!tid) throw new Error('teacherId required');
        let totalRecords = 0;

        for (const table of SCOPED_TABLES) {
            if (typeof onProgress === 'function') onProgress(table);
            try {
                const records = (db[table] || await StorageEngine.getAll(table))
                    .filter(r => !r._tid || String(r._tid) === String(tid));
                const n = await uploadTable(tid, table, records);
                totalRecords += n;
            } catch(e) { console.warn(`[TeacherDB] uploadAll: skip ${table}`, e); }
        }

        // رفع الإعدادات
        const settings = (typeof db !== 'undefined' && db._settings) ? db._settings : {};
        await uploadSettings(tid, settings);

        return totalRecords;
    }

    /* ── استلام كل بيانات مدرس ── */
    async function downloadAll(tid, onProgress) {
        if (!tid) throw new Error('teacherId required');
        let totalRecords = 0;
        const result = {};

        for (const table of SCOPED_TABLES) {
            if (typeof onProgress === 'function') onProgress(table);
            try {
                const records = await downloadTable(tid, table);
                result[table] = records;
                totalRecords += records.length;
            } catch(e) { console.warn(`[TeacherDB] downloadAll: skip ${table}`, e); result[table] = []; }
        }

        // استلام الإعدادات
        result._settings = await downloadSettings(tid) || {};

        return { tables: result, total: totalRecords };
    }

    return {
        SCOPED_TABLES,
        uploadTable,
        downloadTable,
        saveRecord,
        deleteRecord,
        uploadSettings,
        downloadSettings,
        uploadAll,
        downloadAll,
        getFs: _getFs,
        colPath: _col,
    };
})();

/* ══════════════════════════════════════════════════════════════
   TeacherFilter — فلترة IndexedDB بـ _tid
   يُطبَّق بعد db.load() لعزل بيانات المدرس في الذاكرة
══════════════════════════════════════════════════════════════ */
const TeacherFilter = (() => {

    /* إضافة _tid لسجل جديد قبل حفظه */
    function tag(record) {
        const tid = TeacherSession.getId();
        if (!tid || !record || record._tid) return record;
        return { ...record, _tid: tid };
    }

    /* فلترة مصفوفة من السجلات بـ _tid الحالي */
    function filter(records) {
        const tid = TeacherSession.getId();
        if (!tid || !Array.isArray(records)) return records;
        // لو مفيش أي سجل معلّم بـ _tid → نظام قديم بدون multi-teacher، نُظهر الكل
        const hasTagged = records.some(r => r._tid !== undefined);
        if (!hasTagged) return records;
        return records.filter(r => !r._tid || String(r._tid) === String(tid));
    }

    return { tag, filter };
})();

/* ══════════════════════════════════════════════════════════════
   التكامل مع db.load()
   يُطبَّق patch على db.load لفلترة البيانات بعد تحميلها
══════════════════════════════════════════════════════════════ */
function _patchDbLoad() {
    if (typeof db === 'undefined') { setTimeout(_patchDbLoad, 300); return; }
    const origLoad = db.load.bind(db);
    db.load = async function() {
        await origLoad();
        // بعد التحميل، فلتر كل الجداول لو المدرس مسجّل
        if (TeacherSession.isTeacher()) {
            const tid = TeacherSession.getId();
            TeacherDB.SCOPED_TABLES.forEach(table => {
                if (Array.isArray(db[table])) {
                    db[table] = TeacherFilter.filter(db[table]);
                }
            });
            // تحميل إعدادات المدرس الخاصة (لو موجودة)
            const key = `_teacher_settings_${tid}`;
            const cached = localStorage.getItem(key);
            if (cached) {
                try { db._settings = Object.assign({}, db._settings || {}, JSON.parse(cached)); }
                catch(e) {}
            }
            console.info(`[TeacherFilter] db.load filtered for teacher ${tid} ✅`);
        }
    };
}

/* ══════════════════════════════════════════════════════════════
   التكامل مع db.save()
   يُطبَّق _tid تلقائياً عند حفظ أي سجل جديد
══════════════════════════════════════════════════════════════ */
function _patchDbSave() {
    if (typeof db === 'undefined') { setTimeout(_patchDbSave, 300); return; }
    const origSave = db.save.bind(db);
    db.save = async function(modifiedTable) {
        if (TeacherSession.isTeacher() && modifiedTable && Array.isArray(db[modifiedTable])) {
            const tid = TeacherSession.getId();
            // نضيف _tid لأي سجل جديد لم يُعلَّم بعد
            db[modifiedTable] = db[modifiedTable].map(r =>
                r._tid ? r : { ...r, _tid: tid }
            );
        }
        return origSave(modifiedTable);
    };
}

/* ══════════════════════════════════════════════════════════════
   التكامل مع handleStudentSubmit وإضافة الطلاب
   _tid يُضاف تلقائياً لكل طالب/مجموعة/دفعة جديدة
══════════════════════════════════════════════════════════════ */
function _patchStudentAdd() {
    if (typeof StorageEngine === 'undefined') { setTimeout(_patchStudentAdd, 300); return; }
    const origSave = StorageEngine.save.bind(StorageEngine);
    StorageEngine.save = async function(storeName, data) {
        const tid = TeacherSession.getId();
        if (tid && TeacherDB.SCOPED_TABLES.includes(storeName)) {
            if (Array.isArray(data)) {
                data = data.map(r => r._tid ? r : { ...r, _tid: tid });
            } else if (data && !data._tid) {
                data = { ...data, _tid: tid };
            }
        }
        return origSave(storeName, data);
    };
    console.info('[TeacherCore] StorageEngine.save patched ✅');
}

/* ══════════════════════════════════════════════════════════════
   إعدادات المدرس — localStorage بـ key خاص بـ tid
══════════════════════════════════════════════════════════════ */
const TeacherSettings = {
    _key(tid) { return `_teacher_settings_${tid || TeacherSession.getId()}`; },

    save(settings, tid) {
        const key = this._key(tid);
        if (!key.includes('null') && !key.includes('undefined')) {
            localStorage.setItem(key, JSON.stringify(settings));
        }
    },

    load(tid) {
        const key = this._key(tid);
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },

    /* patch db._settings لحفظه بـ key المدرس */
    patchSave() {
        if (typeof db === 'undefined') { setTimeout(() => this.patchSave(), 300); return; }
        const orig = db.save.bind(db);
        const self = this;
        // نُضيف حفظ settings المدرس عند كل db.save()
        const _alreadyWrapped = db.__settingsPatchApplied;
        if (_alreadyWrapped) return;
        db.__settingsPatchApplied = true;
        const origDbSave = db.save.bind(db);
        db.save = async function(modifiedTable) {
            const result = await origDbSave(modifiedTable);
            const tid = TeacherSession.getId();
            if (tid && db._settings) {
                self.save(db._settings, tid);
            }
            return result;
        };
    }
};

/* ══════════════════════════════════════════════════════════════
   رفع / استلام بيانات المدرس
   يستبدل uploadPaymentsToCloud / downloadPaymentsFromCloud
   بنسخة تعمل على مسار teachers/{tid}/
══════════════════════════════════════════════════════════════ */
function _patchCloudSync() {
    /* رفع كل البيانات */
    const _origUploadAll = window.uploadPaymentsToCloud;
    window.uploadPaymentsToCloud = async function() {
        const tid = TeacherSession.getId();

        // الأدمن: يستخدم الدالة الأصلية دائماً (device_students / device_groups / ...)
        if (!tid) {
            if (typeof _origUploadAll === 'function') return _origUploadAll();
            showNotification('❌ دالة الرفع الأصلية غير متاحة', 'error');
            return;
        }

        // المدرس: يرفع على مساره الخاص teachers/{tid}/...
        showNotification('🔗 جاري رفع بياناتك إلى السحابة...', 'info');
        try {
            const total = await TeacherDB.uploadAll(tid);
            if (db._settings) await TeacherDB.uploadSettings(tid, db._settings);
            showNotification(`✅ تم رفع ${total} سجل بنجاح`, 'success');
        } catch(e) {
            console.error('[Upload] Error:', e);
            showNotification('❌ خطأ أثناء الرفع: ' + e.message, 'error');
        }
    };

    /* استلام كل البيانات */
    const _origDownloadAll = window.downloadPaymentsFromCloud;
    window.downloadPaymentsFromCloud = async function() {
        const tid = TeacherSession.getId();

        // الأدمن: يستخدم الدالة الأصلية دائماً
        if (!tid) {
            if (typeof _origDownloadAll === 'function') return _origDownloadAll();
            showNotification('❌ دالة الاستلام الأصلية غير متاحة', 'error');
            return;
        }

        // المدرس: يستلم من مساره الخاص teachers/{tid}/...
        showNotification('🔗 جاري استلام بياناتك من السحابة...', 'info');
        try {
            const { tables, total } = await TeacherDB.downloadAll(tid);

            for (const [tableName, records] of Object.entries(tables)) {
                if (tableName === '_settings' || !Array.isArray(records) || !records.length) continue;
                await StorageEngine.save(tableName, records);
            }
            if (tables._settings && Object.keys(tables._settings).length) {
                db._settings = Object.assign(db._settings || {}, tables._settings);
                TeacherSettings.save(db._settings, tid);
                localStorage.setItem('edu_master_settings', JSON.stringify(db._settings));
            }
            await db.load();
            if (typeof renderStudents === 'function') renderStudents();
            showNotification(`✅ تم استلام ${total} سجل بنجاح`, 'success');
        } catch(e) {
            console.error('[Download] Error:', e);
            showNotification('❌ خطأ أثناء الاستلام: ' + e.message, 'error');
        }
    };

    /* رفع الطلاب فقط */
    const _origUploadStudents = window.uploadStudentsToCloud;
    window.uploadStudentsToCloud = async function() {
        const tid = TeacherSession.getId();
        // الأدمن → الدالة الأصلية
        if (!tid) return typeof _origUploadStudents === 'function' ? _origUploadStudents() : null;

        // المدرس → يرفع طلابه فقط على مساره
        showNotification('🔗 جاري رفع طلابك ومجموعاتك...', 'info');
        try {
            const myStudents = TeacherFilter.filter(db.students || []);
            const myGroups   = TeacherFilter.filter(db.groups   || []);
            const n1 = await TeacherDB.uploadTable(tid, 'students', myStudents);
            const n2 = await TeacherDB.uploadTable(tid, 'groups', myGroups);
            showNotification(`✅ تم رفع ${n1} طالب و ${n2} مجموعة`, 'success');
        } catch(e) {
            showNotification('❌ خطأ في رفع الطلاب: ' + e.message, 'error');
        }
    };

    /* استلام الطلاب فقط */
    const _origDownloadStudents = window.downloadStudentsFromCloud;
    window.downloadStudentsFromCloud = async function() {
        const tid = TeacherSession.getId();
        // الأدمن → الدالة الأصلية
        if (!tid) return typeof _origDownloadStudents === 'function' ? _origDownloadStudents() : null;

        // المدرس → يستلم طلابه فقط من مساره
        showNotification('🔗 جاري استلام طلابك ومجموعاتك...', 'info');
        try {
            const students = await TeacherDB.downloadTable(tid, 'students');
            const groups   = await TeacherDB.downloadTable(tid, 'groups');
            if (students.length) await StorageEngine.save('students', students);
            if (groups.length)   await StorageEngine.save('groups', groups);
            await db.load();
            if (typeof renderStudents === 'function') renderStudents();
            showNotification(`✅ تم استلام ${students.length} طالب و ${groups.length} مجموعة`, 'success');
        } catch(e) {
            showNotification('❌ خطأ في استلام الطلاب: ' + e.message, 'error');
        }
    };

    console.info('[TeacherCore] Cloud sync patched ✅');
}

/* ══════════════════════════════════════════════════════════════
   حماية واجهة المدرس — إخفاء العمليات الحساسة
══════════════════════════════════════════════════════════════ */
function _applyTeacherUIRestrictions() {
    if (!TeacherSession.isTeacher()) return;

    // إضافة CSS لإخفاء عناصر الأدمن فقط
    const style = document.createElement('style');
    style.textContent = `
        /* عناصر مخفية عن المدرس */
        [data-admin-only],
        #btn-clear-all-students,
        #nav-teacher-accounts,
        .ta-btn-delete-all,
        [onclick*="clearAllStudents"],
        [onclick*="uploadPaymentsToCloud"],
        [onclick*="downloadPaymentsFromCloud"] {
            /* سيتم تطبيق الإخفاء بعد تحديد العناصر بدقة */
        }
    `;
    document.head.appendChild(style);

    // إضافة class للـ body لتطبيق CSS restrictions
    document.body.classList.add('teacher-mode');

    // تحديث الـ UI header
    const tid = TeacherSession.getId();
    const name = TeacherSession.getName();
    const center = TeacherSession.getCenter();

    // badge في الـ header
    let badge = document.getElementById('tc-teacher-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'tc-teacher-badge';
        badge.style.cssText = [
            'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
            'background:linear-gradient(135deg,#4f46e5,#7c3aed)',
            'color:#fff', 'padding:5px 16px', 'border-radius:20px',
            'font-size:0.8rem', 'font-weight:700', 'z-index:1000',
            'display:flex', 'align-items:center', 'gap:8px',
            'box-shadow:0 4px 14px rgba(79,70,229,0.35)'
        ].join(';');
        document.body.appendChild(badge);
    }
    badge.innerHTML = `<i class="fas fa-chalkboard-teacher"></i> ${name} · ${center}`;

    console.info(`[TeacherCore] UI restricted for teacher ${tid} (${name}) ✅`);
}

/* ══════════════════════════════════════════════════════════════
   إضافة teacher info في واجهة الإعدادات
   المدرس يقدر يشوف اسمه ومدرسته ومركزه
══════════════════════════════════════════════════════════════ */
function _injectTeacherProfileUI() {
    if (!TeacherSession.isTeacher()) return;

    // نضيف بطاقة المعلومات في صفحة الإعدادات
    const settingsSection = document.getElementById('settings-section');
    if (!settingsSection) return;

    // نتحقق إذا كانت موجودة بالفعل
    if (document.getElementById('teacher-profile-card')) return;

    const card = document.createElement('div');
    card.id = 'teacher-profile-card';
    card.style.cssText = [
        'background:linear-gradient(135deg,rgba(79,70,229,0.08),rgba(124,58,237,0.05))',
        'border:1.5px solid rgba(99,102,241,0.25)', 'border-radius:18px',
        'padding:1.6rem 2rem', 'margin-bottom:1.5rem'
    ].join(';');
    card.innerHTML = `
        <h3 style="margin:0 0 1.2rem;color:#4f46e5;font-size:1rem;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-user-circle"></i> بياناتك كمدرس
        </h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <div>
                <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:4px;">الاسم</div>
                <div style="font-weight:700;font-size:1rem;">${TeacherSession.getName()}</div>
            </div>
            <div>
                <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:4px;">المدرسة</div>
                <div style="font-weight:700;">${TeacherSession.getSchool()}</div>
            </div>
            <div>
                <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:4px;">المركز</div>
                <div style="font-weight:700;">${TeacherSession.getCenter()}</div>
            </div>
            <div>
                <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:4px;">معرف الحساب</div>
                <div style="font-family:monospace;font-size:.85rem;color:var(--text-muted);">#${TeacherSession.getId()}</div>
            </div>
        </div>`;
    settingsSection.insertBefore(card, settingsSection.firstChild);
}

/* ══════════════════════════════════════════════════════════════
   التحقق من صلاحيات الوظائف الحساسة
══════════════════════════════════════════════════════════════ */
function _guardSensitiveFunctions() {
    // clearAllStudents: متاحة لكن تمسح بيانات المدرس فقط
    const origClear = window.clearAllStudents;
    if (origClear) {
        window.clearAllStudents = async function() {
            if (TeacherSession.isTeacher()) {
                const tid = TeacherSession.getId();
                const confirmed = confirm(`⚠️ هل تريد مسح جميع طلابك؟\nلن يتأثر أي مدرس آخر.`);
                if (!confirmed) return;
                // مسح طلاب هذا المدرس فقط من الذاكرة
                db.students = db.students.filter(s => String(s._tid) !== String(tid));
                await StorageEngine.save('students', db.students);
                db.attendance = db.attendance.filter(a => String(a._tid) !== String(tid));
                await StorageEngine.save('attendance', db.attendance);
                if (typeof renderStudents === 'function') renderStudents();
                showNotification('✅ تم مسح طلابك بنجاح', 'success');
                return;
            }
            return origClear();
        };
    }
}

/* ══════════════════════════════════════════════════════════════
   نقطة الدخول الرئيسية — init()
══════════════════════════════════════════════════════════════ */
async function _init() {
    console.info('[TeacherCore] Initializing...');

    // انتظر جهوزية db و StorageEngine
    let attempts = 0;
    while ((typeof db === 'undefined' || !StorageEngine.db) && attempts < 60) {
        await new Promise(r => setTimeout(r, 200));
        attempts++;
    }

    // تطبيق الـ patches
    _patchStudentAdd();   // tag _tid على كل سجل جديد
    _patchDbLoad();       // فلترة بعد db.load()
    _patchDbSave();       // tag _tid عند db.save()
    TeacherSettings.patchSave(); // حفظ settings بـ key المدرس

    // بعد جهوزية الـ UI
    setTimeout(() => {
        _patchCloudSync();       // ربط upload/download بـ teachers/{tid}/
        _guardSensitiveFunctions();

        if (TeacherSession.isTeacher()) {
            _applyTeacherUIRestrictions();
            setTimeout(_injectTeacherProfileUI, 1000);
        }
    }, 1500);

    console.info('[TeacherCore] ✅ Architecture ready', {
        teacherId: TeacherSession.getId() || 'Admin mode',
        isTeacher: TeacherSession.isTeacher(),
        firestorePath: TeacherSession.isTeacher()
            ? `teachers/${TeacherSession.getId()}/...`
            : 'Admin — can access all paths'
    });
}

// ── تصدير للـ global scope ──
window.TeacherSession  = TeacherSession;
window.TeacherDB       = TeacherDB;
window.TeacherFilter   = TeacherFilter;
window.TeacherSettings = TeacherSettings;

// ── بدء التهيئة ──
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(_init, 800));
} else {
    setTimeout(_init, 800);
}
