#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   auth-admin.js — أدوات إدارة المصادقة (تُشغَّل على جهازك فقط، ليست جزءاً من الموقع)

   المتطلبات:   npm i firebase-admin
   المفتاح:     Firebase Console → Project settings → Service accounts → Generate new private key
                (لا ترفع هذا الملف ولا تضعه داخل مجلد الموقع)

   الأوامر:
     node auth-admin.js migrate --key ./serviceAccount.json [--dry-run] [--strip-passwords]
          ينشئ حساب Firebase Authentication لكل مستخدم موجود بنفس المعرّف (uid = id القديم)
          وبنفس كلمة مروره الحالية، ويكتب phone_index/{phone}. لا يمسح شيئاً إلا مع --strip-passwords.
     node auth-admin.js make-admin --key ./serviceAccount.json --phone 01xxxxxxxxx
          يجعل هذا الحساب أدمن (مستند admins/{uid}) — لا يمكن لأي عميل كتابته.
     node auth-admin.js reset-password --key ./serviceAccount.json --phone 01xxxxxxxxx --password "NewPass123"
          يعيّن كلمة مرور جديدة (نسيان كلمة المرور / طالب طلب من الدعم).
     node auth-admin.js remove-user --key ./serviceAccount.json --phone 01xxxxxxxxx
          يحذف الحساب من Authentication وphone_index (وليس ملف users/{uid}).
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const EMAIL_DOMAIN = 'phone.drmohamed-physics.app';           // لازم يطابق CFG.emailDomain في auth-service.js
const LEGACY_ADMIN_EMAIL = 'admin@iraqi.com';
const LEGACY_DEFAULT_ADMIN_PASSWORD = 'adm123';

function normalizePhone(raw) {
    let s = String(raw == null ? '' : raw)
        .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
        .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
        .replace(/[^0-9]/g, '');
    if (s.length === 12 && s.startsWith('20')) s = '0' + s.slice(2);
    return /^01\d{9}$/.test(s) ? s : null;
}
const phoneToEmail = p => `${p}@${EMAIL_DOMAIN}`;
const randomPassword = () => require('crypto').randomBytes(12).toString('base64url');

async function collectRecords(fs) {
    const byId = new Map();
    for (const col of ['users', 'students']) {                     // المنصة كانت تخزّن الطلاب في المجموعتين
        const snap = await fs.collection(col).get();
        snap.forEach(doc => {
            const d = doc.data() || {};
            const cur = byId.get(doc.id) || { id: doc.id };
            byId.set(doc.id, Object.assign(cur, Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined && v !== null && v !== '')), { id: doc.id, _in: (cur._in || []).concat([col]) }));
        });
    }
    return [...byId.values()];
}

async function migrate(admin, opts, log = console.log) {
    const auth = admin.auth(), fs = admin.firestore(), FV = admin.firestore.FieldValue;
    const report = { created: 0, existing: 0, indexed: 0, admins: 0, stripped: 0, skipped: [], duplicates: [], needsReset: [], adminNeedsPassword: [] };
    const records = await collectRecords(fs);
    const seenPhones = new Map();
    for (const rec of records) {
        const uid = String(rec.id);
        const phone = normalizePhone(rec.phone);
        if (!phone) { report.skipped.push({ id: uid, reason: 'no_valid_phone', phone: rec.phone }); continue; }
        if (seenPhones.has(phone) && seenPhones.get(phone) !== uid) { report.duplicates.push({ phone, ids: [seenPhones.get(phone), uid] }); continue; }
        seenPhones.set(phone, uid);
        const email = phoneToEmail(phone);
        const isAdmin = rec.role === 'admin' || rec.email === LEGACY_ADMIN_EMAIL;
        let password = rec.password != null ? String(rec.password) : '';
        if (isAdmin && password === LEGACY_DEFAULT_ADMIN_PASSWORD && !opts.adminPassword) {
            report.adminNeedsPassword.push({ id: uid, phone }); continue;               // لا نُنشئ أدمن بكلمة مرور معروفة للجميع
        }
        if (isAdmin && opts.adminPassword) password = String(opts.adminPassword);
        let needsReset = false;
        if (password.length < 6) { needsReset = true; password = randomPassword(); report.needsReset.push({ id: uid, phone }); }
        let exists = true;
        try { await auth.getUser(uid); } catch (e) { if (e && e.code === 'auth/user-not-found') exists = false; else throw e; }
        if (!opts.dryRun) {
            if (!exists) { await auth.createUser({ uid, email, password, displayName: rec.name || undefined, disabled: false }); report.created++; }
            else { await auth.updateUser(uid, { email }); report.existing++; }
            await fs.collection('phone_index').doc(phone).set({ uid, createdAt: new Date().toISOString() }); report.indexed++;
            const patch = { id: uid, phone, authMigratedAt: new Date().toISOString() };
            if (needsReset) patch.mustResetPassword = true;
            await fs.collection('users').doc(uid).set(patch, { merge: true });
            if (isAdmin) { await fs.collection('admins').doc(uid).set({ phone, name: rec.name || '', createdAt: new Date().toISOString() }); report.admins++; }
            if (opts.stripPasswords) {
                for (const col of rec._in || ['users']) { await fs.collection(col).doc(uid).update({ password: FV.delete() }).catch(() => {}); }
                report.stripped++;
            }
        } else { exists ? report.existing++ : report.created++; }
        log(`${opts.dryRun ? '[dry-run] ' : ''}${uid}  ${phone}  ${exists ? 'exists' : 'create'}${isAdmin ? '  ADMIN' : ''}${needsReset ? '  (needs password reset)' : ''}`);
    }
    return report;
}

async function findUidByPhone(admin, phone) {
    const snap = await admin.firestore().collection('phone_index').doc(phone).get();
    if (snap.exists) return snap.data().uid;
    const u = await admin.auth().getUserByEmail(phoneToEmail(phone));
    return u.uid;
}
async function makeAdmin(admin, phoneRaw) {
    const phone = normalizePhone(phoneRaw); if (!phone) throw new Error('invalid phone');
    const uid = await findUidByPhone(admin, phone);
    await admin.firestore().collection('admins').doc(uid).set({ phone, createdAt: new Date().toISOString() });
    return { uid, phone };
}
async function resetPassword(admin, phoneRaw, password) {
    const phone = normalizePhone(phoneRaw); if (!phone) throw new Error('invalid phone');
    if (!password || String(password).length < 6) throw new Error('password must be at least 6 characters');
    const uid = await findUidByPhone(admin, phone);
    await admin.auth().updateUser(uid, { password: String(password) });
    await admin.firestore().collection('users').doc(uid).set({ mustResetPassword: admin.firestore.FieldValue.delete() }, { merge: true }).catch(() => {});
    return { uid, phone };
}
async function removeUser(admin, phoneRaw) {
    const phone = normalizePhone(phoneRaw); if (!phone) throw new Error('invalid phone');
    const uid = await findUidByPhone(admin, phone);
    await admin.auth().deleteUser(uid);
    await admin.firestore().collection('phone_index').doc(phone).delete();
    return { uid, phone };
}

module.exports = { normalizePhone, phoneToEmail, migrate, makeAdmin, resetPassword, removeUser, EMAIL_DOMAIN };

if (require.main === module) {
    const args = process.argv.slice(2); const cmd = args[0];
    const opt = n => { const i = args.indexOf('--' + n); return i > -1 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : undefined; };
    const admin = require('firebase-admin');
    const key = opt('key'); if (!key || key === true) { console.error('--key <serviceAccount.json> is required'); process.exit(1); }
    admin.initializeApp({ credential: admin.credential.cert(require(require('path').resolve(key))) });
    (async () => {
        if (cmd === 'migrate') {
            const r = await migrate(admin, { dryRun: !!opt('dry-run'), stripPasswords: !!opt('strip-passwords'), adminPassword: opt('admin-password') });
            console.log('\n' + JSON.stringify(r, null, 2));
            if (r.adminNeedsPassword.length) console.log('\n⚠️ حساب الأدمن ما زال بكلمة المرور الافتراضية القديمة — أعد التشغيل مع --admin-password "كلمة-قوية-جديدة".');
        } else if (cmd === 'make-admin') console.log(await makeAdmin(admin, opt('phone')));
        else if (cmd === 'reset-password') console.log(await resetPassword(admin, opt('phone'), opt('password')));
        else if (cmd === 'remove-user') console.log(await removeUser(admin, opt('phone')));
        else { console.error('commands: migrate | make-admin | reset-password | remove-user'); process.exit(1); }
    })().catch(e => { console.error(e); process.exit(1); });
}
