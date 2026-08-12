// ============================================================
//  firebase-config.js
//  إعدادات Firebase — craaet-acount
//
//  القاعدة النشطة: craaet-acount
//    (مزامنة الأجهزة + حسابات المدرسين + كل بيانات البرنامج)
//
//  ملاحظة مهمة:
//    - هذا الملف لا يُهيئ Firebase مباشرةً (لأن SDKs تُحمَّل async)
//    - التهيئة الفعلية تتم داخل ensureDeviceSyncFirebaseInitialized()
//      في app.js عند أول استخدام فعلي للشبكة
//    - window.FIREBASE_MAIN_CONFIG: يُخزَّن هنا للرجوع إليه إذا لزم
// ============================================================

window.FIREBASE_MAIN_CONFIG = {
    apiKey:            "AIzaSyCoRAhBYIz4h0ApuoVOBDhzHennEzTaios",
    authDomain:        "craaet-acount.firebaseapp.com",
    projectId:         "craaet-acount",
    storageBucket:     "craaet-acount.firebasestorage.app",
    messagingSenderId: "551671991771",
    appId:             "1:551671991771:web:b541cc9884dc90faa22bfe",
    measurementId:     "G-0Z3MYBXLT1"
};

// قاعدة المنصة التعليمية — معطّلة (الإعدادات فارغة عمداً)
window.FIREBASE_PLATFORM_CONFIG = null;

console.info('[firebase-config.js] ✅ إعدادات Firebase محمّلة — القاعدة النشطة: craaet-acount');
