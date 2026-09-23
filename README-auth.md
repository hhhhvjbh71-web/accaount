# نظام الدخول الجديد — خطوات التفعيل (مرة واحدة)

الدخول الآن: **رقم الهاتف + كلمة المرور** يُفحصان من قاعدة البيانات ومن Firebase Authentication. لا كلمات مرور في المتصفح ولا في Firestore.

1. **فعّل Email/Password:** Firebase Console ← Authentication ← Sign-in method ← Email/Password ← Enable.
2. **انقل المستخدمين الحاليين** (قبل رفع الموقع الجديد؛ الموقع القديم يستمر بالعمل أثناء ذلك):
   ```
   npm i firebase-admin
   node auth-admin.js migrate --key ./serviceAccount.json --dry-run        # معاينة
   node auth-admin.js migrate --key ./serviceAccount.json --admin-password "كلمة-قوية-جديدة"
   ```
   يحافظ على نفس معرّف كل طالب (uid = id القديم) فتبقى محاولات الاختبارات والتقدّم والكورسات مربوطة به.
3. **اضبط الأدمن:** حساب الأدمن يُنشأ بالخطوة 2 (`admins/{uid}`). لجعل حساب آخر أدمن:
   `node auth-admin.js make-admin --key ./serviceAccount.json --phone 01xxxxxxxxx`
4. **انشر قواعد Firestore:** ادمج `firestore.rules.auth-snippet.txt` في قواعدك ثم `firebase deploy --only firestore:rules`.
5. **ارفع الموقع** (ما عدا `auth-admin.js` و`firestore.rules.auth-snippet.txt` و`README-auth.md`؛ الأولان أُضيفا لقائمة ignore في firebase.json).
6. بعد التأكد أن الجميع يدخلون: `node auth-admin.js migrate --key ... --strip-passwords` لمسح كلمات المرور القديمة (النص الصريح) من Firestore.
7. نسيان كلمة المرور: `node auth-admin.js reset-password --key ... --phone 01xxxxxxxxx --password "NewPass123"`.

⚠️ لا تنشر الموقع الجديد قبل الخطوتين 1 و2، وإلا لن يستطيع أحد الدخول.
