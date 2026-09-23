// ═══════════════════════════════════════════════════════════════════════
//  quiz-ui.js — منصة الدكتور محمد عبد الله | عميد الفيزياء
//  واجهة الطالب للاختبار: صفحة التعريف ← الحل بمؤقت السيرفر ← صفحة النتيجة
//
//  لماذا ملف مستقل؟
//  صفحة الاختبار القديمة كانت تعتمد على <script> داخل innerHTML، والمتصفحات
//  لا تنفّذ السكربتات المُدرجة بهذه الطريقة أبداً — فكانت الصفحة تظهر
//  لكن لا يمكن اختيار إجابة ولا يعمل المؤقت ولا التسليم.
//  الآن الصفحة تُرسم من JavaScript فعلي (mount) وتتحدث مع QuizService.
// ═══════════════════════════════════════════════════════════════════════
(function (global) {
    'use strict';

    var BASE_CSS = "/* ═══════════════════════════════════════════════\n           TEST PAGE — Premium Redesign\n           كل الـ id/class الوظيفية (زي .test-option, .selected,\n           .correct, .wrong, .test-q-nav-dot, .answered, .current)\n           اتسابت زي ما هي بالظبط عشان الـ JS شغال عليها مباشرة —\n           التعديل هنا بصري (CSS) فقط.\n           ═══════════════════════════════════════════════ */\n        body { overflow-x: hidden; }\n        .test-page {\n            min-height: 100vh;\n            display: flex; flex-direction: column;\n            background:\n                radial-gradient(1200px 600px at 15% -10%, rgba(116,61,210,0.06), transparent 60%),\n                radial-gradient(1000px 500px at 100% 0%, rgba(136,89,216,0.05), transparent 55%),\n                var(--bg-alt, #faf8fc);\n            padding-top: var(--header-height, 70px);\n            font-family: 'Tajawal', sans-serif;\n        }\n        /* Header */\n        .test-header {\n            background: var(--bg-surface, #fff);\n            border-bottom: 1px solid var(--border, #e8e4ee);\n            padding: 14px 24px;\n            display: flex; align-items: center; gap: 14px;\n            position: sticky; top: var(--header-height, 70px); z-index: 100;\n            box-shadow: 0 2px 16px rgba(26,18,39,.05);\n        }\n        .test-back-btn {\n            width: 38px; height: 38px; border: 1.5px solid var(--border, #e8e4ee);\n            border-radius: 12px; background: var(--bg-alt, #faf8fc);\n            font-size: 1.1rem; cursor: pointer; display: flex;\n            align-items: center; justify-content: center;\n            color: var(--text-primary, #1a1227); transition: background .2s, border-color .2s;\n        }\n        .test-back-btn:hover { background: var(--primary-50, #F5F0FC); border-color: var(--primary-300, #AD8DE4); }\n        .test-header-info { flex: 1; min-width: 0; }\n        .test-title { font-size: 1rem; font-weight: 900; color: var(--text-primary, #1a1227); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n        .test-subject { font-size: .8rem; color: var(--text-secondary, #736887); margin-top: 2px; }\n        .test-timer-badge {\n            background: linear-gradient(135deg, #F2E7F7, #D8B9E8);\n            color: #431E82; border: 1px solid #AD6BCE;\n            border-radius: 20px; padding: 6px 14px;\n            font-size: .85rem; font-weight: 800; white-space: nowrap;\n            box-shadow: 0 2px 8px rgba(173,107,206,.25);\n        }\n        .test-timer-badge.warning { background: linear-gradient(135deg,#fee2e2,#fecaca); color: #dc2626; border-color: #fca5a5; animation: timerPulse 1s infinite; }\n        @keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:.6} }\n\n        /* Progress */\n        .test-progress-bar-wrap {\n            height: 6px; background: var(--border, #e8e4ee); position: relative;\n        }\n        .test-progress-bar {\n            height: 100%; background: var(--accent-gradient, linear-gradient(90deg, #743DD2, #672FC7));\n            border-radius: 0 4px 4px 0; transition: width .4s ease;\n        }\n        .test-progress-info {\n            display: flex; justify-content: space-between; align-items: center;\n            padding: 10px 24px; font-size: .82rem;\n            color: var(--text-secondary, #736887); font-weight: 700;\n        }\n\n        /* Body */\n        .test-body {\n            flex: 1; max-width: 720px; width: 100%;\n            margin: 0 auto; padding: 24px 20px 0;\n        }\n\n        /* Question slides */\n        .test-questions-wrap { position: relative; }\n        .test-question-slide { display: none; animation: slideIn .3s ease; }\n        .test-question-slide.active { display: block; }\n        @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }\n\n        /* ── Question badge (was a plain uppercase label) ── */\n        .test-q-num {\n            display: inline-flex; align-items: center; gap: 6px;\n            font-size: .75rem; font-weight: 900; letter-spacing: .03em;\n            color: #fff; text-transform: uppercase;\n            background: var(--accent-gradient, linear-gradient(135deg, #743DD2, #672FC7));\n            padding: 6px 14px; border-radius: 999px;\n            margin-bottom: 16px;\n            box-shadow: 0 4px 12px rgba(116,61,210,.28);\n        }\n        .test-q-img { text-align: center; margin-bottom: 16px; }\n\n        /* ── Question card: مساحة منفصلة تمامًا عن الاختيارات ── */\n        .test-q-text {\n            font-size: 1.15rem; font-weight: 800; line-height: 1.75;\n            color: var(--text-primary, #1a1227);\n            margin-bottom: 22px;\n            background: var(--bg-surface, #fff);\n            border: 1px solid var(--border, #e8e4ee);\n            border-radius: 20px; padding: 24px 26px;\n            box-shadow: 0 6px 24px rgba(26,18,39,.05);\n            position: relative;\n        }\n        .test-q-text::before {\n            content: '';\n            position: absolute; inset-inline-start: 0; top: 14px; bottom: 14px;\n            width: 4px; border-radius: 4px;\n            background: var(--accent-gradient, linear-gradient(180deg, #743DD2, #672FC7));\n        }\n\n        .test-options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }\n\n        /* ── Option card ── default / hover / selected حالات منفصلة تمامًا ── */\n        .test-option {\n            position: relative;\n            display: flex; align-items: center; gap: 16px;\n            background: var(--bg-surface, #fff);\n            border: 2px solid var(--border, #e8e4ee);\n            border-radius: 16px; padding: 16px 20px;\n            cursor: pointer; text-align: right;\n            font-family: 'Tajawal', sans-serif; font-size: .98rem; font-weight: 700;\n            color: var(--text-primary, #1a1227);\n            transition: border-color .18s ease, box-shadow .18s ease, transform .12s ease, background-color .18s ease;\n            width: 100%;\n        }\n        /* Hover = حركة بسيطة وناعمة فقط، ومحدود بالحالة غير المختارة عشان\n           ميتخلطش بصريًا مع .selected أبدًا مهما تحرك الماوس */\n        .test-option:not(.selected):not(.correct):not(.wrong):hover {\n            border-color: var(--primary-300, #AD8DE4);\n            box-shadow: 0 6px 18px rgba(26,18,39,.07);\n            transform: translateY(-2px);\n        }\n        .test-option:active { transform: translateY(0) scale(.995); }\n\n        /* Selected = حالة قوية وواضحة جدًا، مستقلة تمامًا عن hover */\n        .test-option.selected {\n            border-color: var(--primary-500, #743DD2);\n            background: var(--primary-50, #F5F0FC);\n            box-shadow: 0 8px 22px rgba(116,61,210,.16);\n        }\n        .test-option.correct  { border-color: #16a34a; background: #f0fdf4; }\n        .test-option.wrong    { border-color: #dc2626; background: #fef2f2; }\n\n        .test-opt-letter {\n            min-width: 38px; height: 38px; border-radius: 50%;\n            background: var(--bg-alt, #f4f2f8);\n            display: flex; align-items: center; justify-content: center;\n            font-size: .88rem; font-weight: 900; color: var(--primary-600, #672FC7);\n            flex-shrink: 0; transition: background .18s, color .18s, transform .18s;\n        }\n        .test-option.selected .test-opt-letter {\n            background: var(--accent-gradient, linear-gradient(135deg,#743DD2,#672FC7));\n            color: #fff; transform: scale(1.06);\n        }\n        .test-option.correct  .test-opt-letter { background: #16a34a; color: #fff; }\n        .test-option.wrong    .test-opt-letter { background: #dc2626; color: #fff; }\n        .test-opt-text { flex: 1; line-height: 1.6; }\n\n        /* Check indicator — بيظهر بس مع .selected (نفس الكلاس اللي الجافاسكريبت\n           بيحطه فعلاً، مفيش أي منطق جديد، مجرد عنصر بصري إضافي) */\n        .test-opt-check {\n            width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;\n            display: none; align-items: center; justify-content: center;\n            background: var(--primary-500, #743DD2); color: #fff;\n            font-size: .78rem; font-weight: 900;\n        }\n        .test-option.selected .test-opt-check { display: flex; }\n        .test-option.correct  .test-opt-check { display: flex; background: #16a34a; }\n        .test-option.wrong    .test-opt-check { display: none; }\n\n        .test-option:focus-visible {\n            outline: 2.5px solid var(--primary-400, #8B5ED9); outline-offset: 2px;\n        }\n\n        .test-q-hint {\n            padding: 10px 14px; border-radius: 10px;\n            font-size: .85rem; font-weight: 700; margin-top: 6px;\n        }\n        .test-q-hint.correct { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }\n        .test-q-hint.wrong   { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }\n\n        /* ── Question Nav Grid — أرقام أنيقة بحالات واضحة ── */\n        .test-q-nav-grid {\n            display: flex; flex-wrap: wrap; gap: 10px;\n            padding: 18px 0 6px; margin-top: 10px;\n            border-top: 1px dashed var(--border, #e8e4ee);\n        }\n        .test-q-nav-dot {\n            width: 40px; height: 40px; border-radius: 12px;\n            border: 2px solid var(--border, #e8e4ee);\n            background: var(--bg-surface, #fff);\n            font-size: .85rem; font-weight: 800; cursor: pointer;\n            color: var(--text-secondary, #736887); transition: all .18s;\n            position: relative;\n        }\n        .test-q-nav-dot:hover { border-color: var(--primary-300, #AD8DE4); transform: translateY(-1px); }\n        /* Answered = تم الإجابة (مش بالضرورة السؤال الحالي) */\n        .test-q-nav-dot.answered { background: var(--primary-100, #E7DDF7); border-color: var(--primary-300, #AD8DE4); color: var(--primary-700, #5627A7); }\n        /* Current = السؤال المعروض دلوقتي — Ring مميز يتراكب فوق أي حالة تانية */\n        .test-q-nav-dot.current {\n            border-color: var(--primary-500, #743DD2);\n            background: var(--accent-gradient, linear-gradient(135deg,#743DD2,#672FC7));\n            color: #fff;\n            box-shadow: 0 0 0 4px rgba(116,61,210,.18);\n        }\n\n        /* Footer */\n        .test-footer {\n            max-width: 720px; width: 100%; margin: 0 auto;\n            padding: 16px 20px 12px;\n            display: flex; gap: 12px; justify-content: space-between;\n        }\n        .test-note {\n            max-width: 720px; width: 100%; margin: 0 auto 20px;\n            padding: 0 20px; display: flex; justify-content: space-between;\n            font-size: .8rem; color: var(--text-muted, #a298b4);\n        }\n\n        /* Result Modal */\n        .test-result-overlay {\n            position: fixed; inset: 0; background: rgba(26,18,39,.6);\n            z-index: 9999; display: flex; align-items: center; justify-content: center;\n            backdrop-filter: blur(6px); padding: 16px;\n        }\n        .test-result-modal {\n            background: var(--bg-surface, #fff); border-radius: 28px;\n            padding: 40px 32px; max-width: 480px; width: 100%;\n            text-align: center; box-shadow: 0 32px 80px rgba(26,18,39,.25);\n            animation: resultIn .4s cubic-bezier(.34,1.56,.64,1);\n        }\n        @keyframes resultIn { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }\n        .trm-icon { font-size: 4rem; margin-bottom: 12px; }\n        .trm-title { font-size: 1.4rem; font-weight: 900; margin-bottom: 8px; color: var(--text-primary, #1a1227); }\n        .trm-score { font-size: 3rem; font-weight: 900; margin: 12px 0; color: var(--primary-600, #672FC7); }\n        .trm-meta { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 16px; font-size: .9rem; }\n        .trm-meta-item { padding: 6px 14px; border-radius: 20px; font-weight: 700; }\n        .trm-correct { background: #dcfce7; color: #16a34a; }\n        .trm-wrong   { background: #fef2f2; color: #dc2626; }\n        .trm-pct     { background: #F5F0FC; color: #5627A7; }\n        .trm-review { max-height: 260px; overflow-y: auto; text-align: right; margin-bottom: 20px; }\n        .trm-q-row {\n            display: flex; align-items: flex-start; gap: 10px;\n            padding: 10px 0; border-bottom: 1px solid var(--border, #e8e4ee);\n            font-size: .85rem;\n        }\n        .trm-q-row:last-child { border-bottom: none; }\n        .trm-q-mark { font-size: 1rem; flex-shrink: 0; }\n        .trm-q-info { flex: 1; }\n        .trm-q-text { font-weight: 700; margin-bottom: 3px; }\n        .trm-q-answer { color: var(--text-secondary, #736887); }\n        .trm-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }\n\n        /* Dark mode */\n        [data-theme=dark] .test-page { background: #130d1e; }\n        [data-theme=dark] .test-header { background: #1A1325; border-color: #292234; }\n        [data-theme=dark] .test-q-text { background: #1A1325; border-color: #292234; color: #e8e4ee; }\n        [data-theme=dark] .test-option { background: #1A1325; border-color: #292234; color: #e8e4ee; }\n        [data-theme=dark] .test-option:not(.selected):not(.correct):not(.wrong):hover { border-color: var(--primary-500, #743DD2); box-shadow: 0 6px 18px rgba(0,0,0,.35); }\n        [data-theme=dark] .test-option.selected { background: rgba(116,61,210,.12); }\n        [data-theme=dark] .test-opt-letter { background: #292138; }\n        [data-theme=dark] .test-q-nav-dot { background: #292138; border-color: #403751; color: #a298b4; }\n        [data-theme=dark] .test-q-nav-dot.answered { background: rgba(116,61,210,.18); border-color: var(--primary-500,#743DD2); color: var(--primary-300,#AD8DE4); }\n        [data-theme=dark] .test-result-modal { background: #1A1325; }\n        [data-theme=dark] .trm-title { color: #e8e4ee; }\n\n        @media (max-width: 600px) {\n            .test-header { padding: 12px 14px; }\n            .test-body { padding: 16px 12px 0; }\n            .test-q-text { font-size: 1rem; padding: 18px 18px; }\n            .test-option { padding: 14px 16px; font-size: .92rem; }\n            .test-footer { padding: 12px 12px; }\n            .test-result-modal { padding: 28px 20px; }\n            .trm-score { font-size: 2.2rem; }\n        }";

    var EXTRA_CSS = [
        '.qz-page{min-height:100vh;padding:calc(var(--header-height,70px) + 44px) 16px 72px;background:var(--bg-alt);}',
        '.qz-wrap{max-width:780px;margin:0 auto;}',
        '.qz-card{background:var(--surface);border:1px solid var(--border-light);border-radius:24px;box-shadow:var(--shadow-lg);overflow:hidden;}',
        '.qz-hero{padding:34px 32px 22px;text-align:center;background:linear-gradient(160deg,#F7F3FD 0%,#FFFFFF 72%);}',
        '[data-theme="dark"] .qz-hero{background:linear-gradient(160deg,#24154A 0%,#1E1236 72%);}',
        '.qz-icon{width:74px;height:74px;border-radius:22px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:2rem;background:var(--grad-brand,linear-gradient(135deg,#7F56D0,#5B33A8));color:#fff;box-shadow:0 12px 28px rgba(106,63,189,.35);}',
        '.qz-title{font-family:var(--font-display,inherit);font-size:clamp(1.4rem,3.4vw,1.95rem);font-weight:800;letter-spacing:-.02em;line-height:1.25;color:var(--text-primary);margin:0 0 8px;}',
        '.qz-sub{color:var(--text-secondary);line-height:1.75;margin:0 auto;max-width:580px;font-size:.98rem;}',
        '.qz-status{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:8px 18px;border-radius:999px;font-weight:800;font-size:.86rem;}',
        '.qz-status.st-new{background:#F7F3FD;color:#55309A;}.qz-status.st-run{background:#FFF6DD;color:#8A5A00;}',
        '.qz-status.st-pass{background:#DCFCE7;color:#15803D;}.qz-status.st-fail{background:#FEF2F2;color:#DC2626;}.qz-status.st-lock{background:#F1EFF6;color:#5E5474;}',
        '.qz-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:12px;padding:6px 28px 8px;}',
        '.qz-tile{background:var(--bg-alt);border:1px solid var(--border-light);border-radius:16px;padding:15px 12px;text-align:center;}',
        '.qz-tile b{display:block;font-size:1.4rem;font-weight:900;color:var(--pu-600,#6A3FBD);font-family:var(--font-display,inherit);line-height:1.2;}',
        '.qz-tile span{display:block;margin-top:4px;font-size:.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;}',
        '.qz-section{padding:20px 32px 6px;}',
        '.qz-h{font-size:.8rem;font-weight:800;color:var(--pu-700,#55309A);text-transform:uppercase;letter-spacing:.1em;margin:0 0 12px;}',
        '.qz-list{margin:0;padding:0;list-style:none;display:grid;gap:10px;}',
        '.qz-list li{display:flex;gap:11px;align-items:flex-start;color:var(--text-secondary);line-height:1.65;font-size:.95rem;}.qz-list li span{flex:1;min-width:0;}',
        '.qz-list li::before{content:"";flex:0 0 8px;height:8px;margin-top:9px;border-radius:50%;background:linear-gradient(135deg,#7F56D0,#B071E8);}',
        '.qz-note{margin:14px 28px 0;padding:13px 16px;border-radius:14px;font-weight:700;font-size:.9rem;line-height:1.6;}',
        '.qz-note.ok{background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;}.qz-note.bad{background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;}',
        '.qz-note.info{background:#F7F3FD;color:#55309A;border:1px solid #EEE7FA;}',
        '.qz-actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:22px 28px 32px;}',
        '.qz-back{display:inline-flex;align-items:center;gap:8px;margin:0 0 16px;font-weight:800;color:var(--pu-700,#55309A);cursor:pointer;background:none;border:none;font-size:.92rem;}',
        '.qz-back:hover{color:var(--pu-500,#7F56D0);}',
        '.qz-ring{--p:0;--c:#16A34A;width:156px;height:156px;border-radius:50%;margin:4px auto 16px;display:flex;align-items:center;justify-content:center;',
        'background:conic-gradient(var(--c) calc(var(--p) * 1%),#EEE7FA 0);}',
        '.qz-ring>div{width:126px;height:126px;border-radius:50%;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;}',
        '.qz-ring b{font-family:var(--font-display,inherit);font-size:2.1rem;font-weight:900;color:var(--text-primary);line-height:1;}',
        '.qz-ring small{font-size:.72rem;font-weight:800;color:var(--text-muted);margin-top:4px;letter-spacing:.06em;text-transform:uppercase;}',
        '.qz-stats{display:grid;gap:0;margin:8px 28px 0;border:1px solid var(--border-light);border-radius:16px;overflow:hidden;}',
        '.qz-stats div{display:flex;justify-content:space-between;gap:12px;padding:12px 16px;font-size:.93rem;}',
        '.qz-stats div:nth-child(odd){background:var(--bg-alt);}',
        '.qz-stats span{color:var(--text-secondary);font-weight:600;}.qz-stats strong{color:var(--text-primary);font-weight:800;text-align:right;}',
        '.qz-review{margin:20px 28px 0;border:1px solid var(--border-light);border-radius:16px;overflow:hidden;}',
        '.qz-review h4{margin:0;padding:14px 18px;font-size:.9rem;font-weight:800;border-bottom:1px solid var(--border-light);}',
        '.qz-loading{display:flex;flex-direction:column;align-items:center;gap:14px;padding:70px 20px;color:var(--text-secondary);font-weight:700;}',
        '.qz-spin{width:38px;height:38px;border-radius:50%;border:4px solid #EEE7FA;border-top-color:#7F56D0;animation:qzspin .8s linear infinite;}',
        '@keyframes qzspin{to{transform:rotate(360deg);}}',
        '.test-page .test-timer-badge.qz-nolimit{opacity:.6;}',
        '@media(max-width:600px){.qz-hero{padding:26px 18px 18px;}.qz-section{padding:16px 20px 4px;}.qz-meta{padding:6px 18px 6px;}.qz-note,.qz-stats,.qz-review{margin-left:18px;margin-right:18px;}.qz-actions{padding:20px 18px 26px;}.qz-actions .btn{width:100%;justify-content:center;}}'
    ].join('\n');

    var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    var run = null;          // حالة الحل الجارية (مؤقتات إلخ)
    var mountToken = 0;

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function $(id) { return document.getElementById(id); }
    function go(hash) { global.location.hash = hash; }
    function fmtDur(sec) { sec = Math.max(0, Math.round(sec || 0)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
    function fmtDate(iso) { try { return iso ? new Date(iso).toLocaleString() : '—'; } catch (e) { return '—'; } }

    function injectStyles() {
        if (document.getElementById('quizUiStyles')) return;
        var st = document.createElement('style');
        st.id = 'quizUiStyles';
        st.textContent = BASE_CSS + '\n' + EXTRA_CSS;
        document.head.appendChild(st);
    }

    function stopRun() {
        if (!run) return;
        if (run.tick) clearInterval(run.tick);
        if (run.saveT) clearTimeout(run.saveT);
        if (run.syncT) clearInterval(run.syncT);
        if (run.onVis) document.removeEventListener('visibilitychange', run.onVis);
        run.dead = true;
        run = null;
    }

    function backUrl(ctx) {
        return ctx.courseId && ctx.lessonId ? 'lesson/' + ctx.courseId + '/' + ctx.lessonId : ctx.courseId ? 'course/' + ctx.courseId : 'courses';
    }

    // ── شاشات مساعدة ────────────────────────────────────────────────
    function loadingHTML(msg) {
        return '<div class="qz-page"><div class="qz-wrap"><div class="qz-card"><div class="qz-loading"><div class="qz-spin"></div><div>' + esc(msg || 'Loading quiz…') + '</div></div></div></div></div>';
    }
    function messageHTML(ctx, icon, title, text, extraBtn) {
        return '<div class="qz-page"><div class="qz-wrap"><div class="qz-card"><div class="qz-hero">' +
            '<div class="qz-icon" style="background:linear-gradient(135deg,#8A819C,#5E5474);">' + icon + '</div>' +
            '<h2 class="qz-title">' + esc(title) + '</h2><p class="qz-sub">' + esc(text) + '</p></div>' +
            '<div class="qz-actions">' + (extraBtn || '') + '<button class="btn btn-outline btn-lg" id="qzBackBtn">&larr; Back</button></div></div></div></div>';
    }
    function bindBack(root, ctx) { var b = root.querySelector('#qzBackBtn'); if (b) b.onclick = function () { go(backUrl(ctx)); }; }

    // ── نقطة الدخول ─────────────────────────────────────────────────
    function mount(root, opts, user) {
        stopRun();
        if (!root) return;
        injectStyles();
        var token = ++mountToken;
        var ctx = {
            quizId: opts.quizId, courseId: opts.courseId || '', lessonId: opts.lessonId || '',
            user: user, sid: String(user && user.id), link: opts.link || { ok: false, reason: 'not_linked' }
        };
        var alive = function () { return token === mountToken && root.isConnected; };
        root.innerHTML = loadingHTML();
        var QS = global.QuizService;
        if (!QS || !global.db) { root.innerHTML = messageHTML(ctx, '⚠️', 'Connection required', 'The quiz needs a live connection to the platform database. Please check your internet connection and try again.'); bindBack(root, ctx); return; }

        // 1) الاختبار لا يظهر بمجرد كتابة ID: لازم يكون مربوطاً بهذا الدرس في بيانات الكورس
        if (!ctx.link.ok) {
            var reasons = {
                not_linked: ['🔗', 'Quiz not linked to this lesson', 'This quiz is not attached to the lesson you opened. Open it from the lesson page.'],
                lesson_locked: ['🔒', 'Lesson is locked', 'Pass the previous lesson\'s quiz first to unlock this one.'],
                no_access: ['🔑', 'Course not activated', 'Activate this course to access its quizzes.'],
                lesson_not_found: ['❓', 'Lesson not found', 'We could not find the lesson linked to this quiz.']
            };
            var r = reasons[ctx.link.reason] || reasons.not_linked;
            root.innerHTML = messageHTML(ctx, r[0], r[1], r[2]); bindBack(root, ctx); return;
        }

        QS.ensureListener(ctx.sid);
        var quiz = global.getQuizById(ctx.quizId);
        var pQuiz = quiz ? Promise.resolve(quiz) : QS.fetchPublicQuiz(ctx.quizId).then(function () { return global.getQuizById(ctx.quizId); });

        pQuiz.then(function (q) {
            if (!alive()) return;
            if (!q) { root.innerHTML = messageHTML(ctx, '📝', 'Quiz not found', 'This quiz (' + ctx.quizId + ') does not exist in the platform database.'); bindBack(root, ctx); return; }
            ctx.quiz = q;
            return QS.syncClock(ctx.sid).then(function () { return QS.loadAttempt(ctx.sid, q.id); }).then(function (att) {
                if (!alive()) return;
                ctx.ref = att.ref;
                var d = QS.describe(q, att.data, att.legacy);
                route(root, ctx, d, alive);
            });
        }).catch(function (e) {
            if (!alive()) return;
            console.warn('[QuizUI] mount error:', e);
            root.innerHTML = messageHTML(ctx, '⚠️', 'Could not load the quiz', 'Something went wrong while loading the quiz. Please try again in a moment.',
                '<button class="btn btn-primary btn-lg" id="qzRetryLoad">Try again</button>');
            bindBack(root, ctx);
            var rb = root.querySelector('#qzRetryLoad'); if (rb) rb.onclick = function () { mount(root, opts, user); };
        });
    }

    function route(root, ctx, d, alive) {
        var QS = global.QuizService;
        if (d.kind === 'expired') {
            root.innerHTML = loadingHTML('Time is over — grading your answers…');
            return QS.finalize(ctx.ref, ctx.quiz, 'timeout').then(function (res) {
                if (!alive()) return;
                showResult(root, ctx, res.data, { timedOut: true });
            }).catch(function (e) { if (alive()) showGradingError(root, ctx, function () { route(root, ctx, d, alive); }); });
        }
        if (d.kind === 'passed' || d.kind === 'no_attempts_left') return showResult(root, ctx, d.data, {});
        return showIntro(root, ctx, d);
    }

    // ═════════ 1) صفحة تعريف الاختبار ═════════
    function showIntro(root, ctx, d) {
        var q = ctx.quiz, QS = global.QuizService;
        var qCount = (q.questionsList || q.questions || []).length;
        var pass = QS.passRateOf(q);
        var dur = d.durationSec;
        var status = { cls: 'st-new', text: '● Not started' };
        var btn = { label: '⚡ Start Quiz', cls: 'btn-primary' };
        var note = '';
        if (d.kind === 'in_progress') {
            status = { cls: 'st-run', text: '⏱ In progress' };
            btn.label = '▶ Continue Quiz';
            note = '<div class="qz-note info">Your attempt is already running' + (d.remainingMs != null ? ' — <strong>' + fmtDur(Math.max(0, d.remainingMs) / 1000) + '</strong> left.' : '.') + ' It continues on the platform clock even if you closed the page.</div>';
        } else if (d.kind === 'failed_can_retry') {
            var last = d.data;
            status = { cls: 'st-fail', text: '✕ Not passed yet — ' + last.percentage + '%' };
            btn.label = '↻ Retry Quiz';
            note = '<div class="qz-note bad">Last score: ' + last.percentage + '% — you need ' + pass + '% to unlock the next lesson.' + (d.attemptsLeft != null ? ' Attempts left: <strong>' + d.attemptsLeft + '</strong>.' : '') + '</div>';
        }
        var attemptsTxt = d.maxAttempts > 0 ? (d.attemptsUsed + ' / ' + d.maxAttempts) : 'Until you pass';
        var instr = [];
        instr.push(dur > 0 ? 'You have <strong>' + Math.round(dur / 60) + ' minutes</strong>. The timer starts when you press Start and runs on the platform clock — closing the page or refreshing does not pause or reset it.' : 'This quiz has no time limit.');
        instr.push('Your answers are saved automatically while you work, so you can continue from another device.');
        instr.push(d.maxAttempts === 1 ? 'You have <strong>one attempt only</strong>. Once you start, it cannot be repeated.' :
            d.maxAttempts > 1 ? 'You have <strong>' + d.maxAttempts + ' attempts</strong>. Passing ends the quiz; the best result unlocks the next lesson.' : 'You can retry until you reach the passing score.');
        instr.push('You need <strong>' + pass + '%</strong> to pass and unlock the next lesson.');
        instr.push(q.showAnswers === true ? 'Correct answers will be available after you finish.' : 'Correct answers are not shown after the quiz.');
        instr.push('When the time ends the quiz is submitted and graded automatically.');

        root.innerHTML =
            '<div class="qz-page"><div class="qz-wrap">' +
            '<button class="qz-back" id="qzBackBtn">&larr; Back to lesson</button>' +
            '<div class="qz-card">' +
            '<div class="qz-hero"><div class="qz-icon">📝</div>' +
            '<h1 class="qz-title">' + esc(q.title || 'Quiz') + '</h1>' +
            (q.description ? '<p class="qz-sub">' + esc(q.description) + '</p>' : (q.subject ? '<p class="qz-sub">' + esc(q.subject) + '</p>' : '')) +
            '<div class="qz-status ' + status.cls + '">' + status.text + '</div></div>' +
            '<div class="qz-meta">' +
            '<div class="qz-tile"><b>' + qCount + '</b><span>Questions</span></div>' +
            '<div class="qz-tile"><b>' + (dur > 0 ? Math.round(dur / 60) + ' min' : '—') + '</b><span>Time limit</span></div>' +
            '<div class="qz-tile"><b>' + pass + '%</b><span>Pass mark</span></div>' +
            '<div class="qz-tile"><b>' + esc(attemptsTxt) + '</b><span>Attempts</span></div></div>' +
            note +
            '<div class="qz-section"><h3 class="qz-h">Instructions</h3><ul class="qz-list">' + instr.map(function (t) { return '<li><span>' + t + '</span></li>'; }).join('') + '</ul></div>' +
            '<div class="qz-actions"><button class="btn ' + btn.cls + ' btn-lg" id="qzStartBtn" ' + (qCount === 0 ? 'disabled' : '') + '>' + btn.label + '</button></div>' +
            (qCount === 0 ? '<div class="qz-note bad" style="margin-bottom:24px;">This quiz has no questions yet.</div>' : '') +
            '</div></div></div>';
        bindBack(root, ctx);
        var sb = root.querySelector('#qzStartBtn');
        if (sb) sb.onclick = function () {
            sb.disabled = true; sb.textContent = 'Starting…';
            var alive = function () { return root.isConnected; };
            global.QuizService.startOrResume({
                quiz: ctx.quiz, studentId: ctx.sid, studentName: ctx.user.name, studentCode: ctx.user.qrCode || ctx.user.code || ctx.user.id,
                courseId: ctx.courseId, lessonId: ctx.lessonId
            }).then(function (res) {
                if (!alive()) return;
                if (res.mode === 'expired') { return route(root, ctx, global.QuizService.describe(ctx.quiz, res.data, false), alive); }
                ctx.ref = res.ref;
                startRun(root, ctx, res.data);
            }).catch(function (e) {
                if (!alive()) return;
                var code = e && e.code;
                if (code === 'already_passed') { global.QuizService.loadAttempt(ctx.sid, ctx.quiz.id).then(function (a) { showResult(root, ctx, a.data, {}); }); return; }
                if (code === 'no_attempts_left') {
                    global.QuizService.loadAttempt(ctx.sid, ctx.quiz.id).then(function (a) { showResult(root, ctx, a.data, {}); }); return;
                }
                console.warn('[QuizUI] start failed', e);
                sb.disabled = false; sb.textContent = 'Try again';
                var n = document.createElement('div'); n.className = 'qz-note bad'; n.textContent = 'Could not start the quiz. Check your connection and try again.';
                sb.parentNode.parentNode.insertBefore(n, sb.parentNode);
            });
        };
    }

    // ═════════ 2) الحل — مؤقت مربوط بوقت بدء السيرفر ═════════
    function startRun(root, ctx, data) {
        stopRun();
        var QS = global.QuizService, q = ctx.quiz;
        var questions = q.questionsList || q.questions || [];
        var qCount = questions.length;
        var runData = data.currentRun || {};
        var answers = Object.assign({}, runData.answers || {});
        var startedMs = QS.tsMs(runData.startedAt);
        var durSec = runData.durationSec != null ? runData.durationSec : QS.durationSecOf(q);
        var deadline = (durSec > 0 && startedMs != null) ? startedMs + durSec * 1000 : null;
        var cur = 0, submitting = false, dirty = false, dirtyAt = 0;
        run = { tick: null, saveT: null, syncT: null, onVis: null, dead: false };
        var me = run;

        function keyOf(i) { return QS.qKey(questions[i], i); }
        function answeredCount() { return Object.keys(answers).filter(function (k) { return answers[k] !== undefined && answers[k] !== null; }).length; }

        root.innerHTML =
            '<div class="test-page" id="testPageRoot">' +
            '<div class="test-header"><button class="test-back-btn" id="qzRunBack" title="Back">&larr;</button>' +
            '<div class="test-header-info"><div class="test-title">' + esc(q.title || 'Quiz') + '</div>' + (q.subject ? '<div class="test-subject">' + esc(q.subject) + '</div>' : '') + '</div>' +
            '<div class="test-header-meta"><span id="testTimerBadge" class="test-timer-badge' + (deadline == null ? ' qz-nolimit' : '') + '">⏱️ <span id="testTimerDisplay">' + (deadline == null ? 'No limit' : fmtDur(durSec)) + '</span></span></div></div>' +
            '<div class="test-progress-bar-wrap"><div class="test-progress-bar" id="testProgressBar" style="width:0%"></div></div>' +
            '<div class="test-progress-info"><span>Question <strong id="testCurNum">1</strong> of <strong>' + qCount + '</strong></span><span id="testProgressPct">0%</span></div>' +
            '<div class="test-body"><div class="test-questions-wrap" id="testQuestionsWrap">' +
            questions.map(function (qq, qi) {
                var opts = Array.isArray(qq.opts) ? qq.opts : [];
                return '<div class="test-question-slide' + (qi === 0 ? ' active' : '') + '" id="testQ_' + qi + '" data-qi="' + qi + '">' +
                    '<div class="test-q-num">Question ' + (qi + 1) + ' of ' + qCount + '</div>' +
                    (qq.mediaUrl ? '<div class="test-q-img"><img src="' + esc(qq.mediaUrl) + '" style="max-width:' + (qq.imageWidth || 360) + 'px;' + (qq.imageHeight ? 'height:' + qq.imageHeight + 'px;' : '') + '" alt=""></div>' : '') +
                    '<div class="test-q-text">' + (qq.q || '') + '</div>' +
                    '<div class="test-options" id="testOpts_' + qi + '">' + opts.map(function (opt, oi) {
                        var sel = String(answers[keyOf(qi)]) === String(oi);
                        return '<button class="test-option' + (sel ? ' selected' : '') + '" data-qi="' + qi + '" data-oi="' + oi + '">' +
                            '<span class="test-opt-letter">' + (LETTERS[oi] || (oi + 1)) + '</span><span class="test-opt-text">' + opt + '</span><span class="test-opt-check">✓</span></button>';
                    }).join('') + '</div></div>';
            }).join('') + '</div>' +
            '<div class="test-q-nav-grid" id="testQNavGrid">' + questions.map(function (qq, qi) {
                var an = answers[keyOf(qi)] !== undefined && answers[keyOf(qi)] !== null;
                return '<button class="test-q-nav-dot' + (qi === 0 ? ' current' : '') + (an ? ' answered' : '') + '" id="testNav_' + qi + '" data-go="' + qi + '" title="Q' + (qi + 1) + '">' + (qi + 1) + '</button>';
            }).join('') + '</div></div>' +
            '<div class="test-footer"><button class="btn btn-outline" id="testPrevBtn" disabled>&larr; Previous</button>' +
            '<button class="btn btn-primary" id="testNextBtn"' + (qCount <= 1 ? ' style="display:none"' : '') + '>Next &rarr;</button>' +
            '<button class="btn btn-accent" id="testSubmitBtn" style="' + (qCount > 1 ? 'display:none' : '') + '">Submit Quiz ✅</button></div>' +
            '<div class="test-note"><span>📌 Your answers are saved automatically</span><span id="testAnsweredCount">0 / ' + qCount + ' Answered</span></div>' +
            '</div><div id="qzToast" class="qz-note bad" style="display:none;position:fixed;left:50%;bottom:24px;transform:translateX(-50%);margin:0;z-index:9999;max-width:90vw;"></div>';

        function refreshCounters() {
            var cnt = answeredCount(), pct = qCount ? Math.round(cnt / qCount * 100) : 0;
            $('testAnsweredCount').textContent = cnt + ' / ' + qCount + ' Answered';
            $('testProgressBar').style.width = pct + '%'; $('testProgressPct').textContent = pct + '%';
        }
        function toast(msg) { var t = $('qzToast'); if (!t) return; t.textContent = msg; t.style.display = 'block'; setTimeout(function () { if (t) t.style.display = 'none'; }, 4000); }
        function goTo(qi) {
            if (qi < 0 || qi >= qCount) return;
            var o = $('testQ_' + cur); if (o) o.classList.remove('active');
            var on = $('testNav_' + cur); if (on) on.classList.remove('current');
            cur = qi;
            $('testQ_' + cur).classList.add('active'); $('testNav_' + cur).classList.add('current');
            $('testCurNum').textContent = cur + 1;
            $('testPrevBtn').disabled = cur === 0;
            $('testNextBtn').style.display = cur < qCount - 1 ? '' : 'none';
            $('testSubmitBtn').style.display = cur === qCount - 1 ? '' : 'none';
            global.scrollTo({ top: 0, behavior: 'smooth' });
        }
        function flush() {
            if (!dirty) return Promise.resolve();
            dirty = false;
            return QS.saveAnswers(ctx.ref, answers).catch(function (e) { dirty = true; console.warn('[QuizUI] autosave failed', e && e.message); });
        }
        function scheduleSave() { dirty = true; dirtyAt = QS.now(); clearTimeout(me.saveT); me.saveT = setTimeout(flush, 350); }

        root.querySelector('#testQuestionsWrap').addEventListener('click', function (ev) {
            var b = ev.target.closest('.test-option'); if (!b || submitting) return;
            var qi = +b.getAttribute('data-qi'), oi = +b.getAttribute('data-oi');
            if (deadline != null && QS.now() > deadline + QS.GRACE_MS) return;      // بعد انتهاء الوقت لا تُقبل تغييرات
            answers[keyOf(qi)] = oi;
            b.parentNode.querySelectorAll('.test-option').forEach(function (x) { x.classList.remove('selected'); });
            b.classList.add('selected');
            $('testNav_' + qi).classList.add('answered');
            refreshCounters(); scheduleSave();
        });
        root.querySelector('#testQNavGrid').addEventListener('click', function (ev) { var b = ev.target.closest('[data-go]'); if (b) goTo(+b.getAttribute('data-go')); });
        $('testPrevBtn').onclick = function () { goTo(cur - 1); };
        $('testNextBtn').onclick = function () { goTo(cur + 1); };
        $('qzRunBack').onclick = function () { flush(); go(backUrl(ctx)); };
        $('testSubmitBtn').onclick = function () {
            var un = qCount - answeredCount();
            if (un > 0 && !global.confirm('You have ' + un + ' unanswered question(s). Submit now?')) return;
            doSubmit('submit');
        };

        function doSubmit(reason) {
            if (submitting || me.dead) return;
            submitting = true;
            clearInterval(me.tick); clearInterval(me.syncT);
            root.querySelectorAll('.test-option,.test-footer .btn').forEach(function (b) { b.disabled = true; });
            var overdue = deadline != null && QS.now() > deadline + QS.GRACE_MS;
            // آخر تغييرات: تُحفظ فقط إن حصلت قبل نهاية الوقت الحقيقي
            var canFlush = dirty && (deadline == null || dirtyAt <= deadline + QS.GRACE_MS) && !(overdue && reason === 'submit');
            var pre = canFlush ? QS.saveAnswers(ctx.ref, answers).catch(function () {}) : Promise.resolve();
            pre.then(function () { return QS.finalize(ctx.ref, q, overdue ? 'timeout' : reason); }).then(function (res) {
                if (me.dead) return;
                stopRun();
                showResult(root, ctx, res.data, { timedOut: reason === 'timeout' || overdue });
            }).catch(function (e) {
                if (me.dead) return;
                console.warn('[QuizUI] submit failed', e);
                submitting = false;
                root.querySelectorAll('.test-option,.test-footer .btn').forEach(function (b) { b.disabled = false; });
                toast('Could not submit — check your connection and press Submit again.');
                if (deadline != null) me.tick = setInterval(tick, 250);
            });
        }

        var lastShown = -1;
        function tick() {
            if (me.dead) return;
            if (deadline == null) return;
            var left = Math.ceil((deadline - QS.now()) / 1000);
            if (left !== lastShown) {
                lastShown = left;
                var el = $('testTimerDisplay'); if (el) el.textContent = fmtDur(Math.max(0, left));
                var badge = $('testTimerBadge'); if (badge) badge.classList.toggle('warning', left <= 60);
            }
            if (left <= 0) doSubmit('timeout');
        }
        if (deadline != null) { me.tick = setInterval(tick, 250); tick(); }
        // إعادة مزامنة ساعة السيرفر دورياً وعند العودة للتبويب (السكون قد يوقف الساعة الرتيبة)
        me.syncT = setInterval(function () { QS.syncClock(ctx.sid); }, 45000);
        me.onVis = function () { if (!document.hidden) QS.syncClock(ctx.sid).then(tick); };
        document.addEventListener('visibilitychange', me.onVis);
        global.addEventListener('hashchange', function stop() { global.removeEventListener('hashchange', stop); flush(); if (run === me) stopRun(); }, { once: true });

        refreshCounters();
        var firstUn = 0; for (var i = 0; i < qCount; i++) { if (answers[keyOf(i)] === undefined) { firstUn = i; break; } }
        if (firstUn > 0) goTo(firstUn);
    }

    function showGradingError(root, ctx, retry) {
        root.innerHTML = messageHTML(ctx, '⚠️', 'We could not grade your quiz yet', 'Your answers are saved. Check your connection and try again — your attempt is not lost.',
            '<button class="btn btn-primary btn-lg" id="qzRetryGrade">Try again</button>');
        bindBack(root, ctx);
        var b = root.querySelector('#qzRetryGrade'); if (b) b.onclick = retry;
    }

    // ═════════ 3) صفحة النتيجة ═════════
    function showResult(root, ctx, data, opt) {
        var QS = global.QuizService, q = ctx.quiz;
        var d = QS.normalize(data) || {};
        var pass = QS.passRateOf(q);
        var passed = d.passed === true;
        var lastPassed = d.lastPassed != null ? d.lastPassed : passed;
        var maxA = QS.maxAttemptsOf(q);
        var used = d.attemptsUsed || 1;
        var canRetry = !passed && (maxA === 0 || used < maxA);
        var qCount = (q.questionsList || q.questions || []).length;
        var ringColor = passed ? '#16A34A' : '#E11D48';

        var gate = passed
            ? '<div class="qz-note ok">✓ Passed! The next lesson is now unlocked.</div>'
            : '<div class="qz-note bad">🔒 Score ' + d.percentage + '% — you need ' + pass + '% to unlock the next lesson.' +
              (canRetry ? (maxA > 0 ? ' Attempts left: <strong>' + (maxA - used) + '</strong>.' : ' You can try again.') : ' You have used all your attempts.') + '</div>';

        var reviewSlot = (q.showAnswers === true) ? '<div id="qzReviewSlot"></div>' : '';
        root.innerHTML =
            '<div class="qz-page"><div class="qz-wrap"><button class="qz-back" id="qzBackBtn">&larr; Back to lesson</button><div class="qz-card">' +
            '<div class="qz-hero" style="padding-bottom:12px;"><h1 class="qz-title" style="margin-bottom:4px;">' + esc(q.title || d.quizTitle || 'Quiz') + '</h1>' +
            '<p class="qz-sub">Quiz result' + (opt && opt.timedOut ? ' — time ran out, your saved answers were submitted automatically' : '') + '</p></div>' +
            '<div style="text-align:center;padding-top:14px;"><div class="qz-ring" style="--p:' + Math.max(0, Math.min(100, d.percentage || 0)) + ';--c:' + ringColor + ';"><div><b>' + (d.percentage || 0) + '%</b><small>' + (passed ? 'Passed' : 'Not passed') + '</small></div></div>' +
            '<div class="qz-status ' + (passed ? 'st-pass' : 'st-fail') + '" style="margin-top:0;">' + (passed ? '✅ Passed' : '❌ Failed') + '</div></div>' +
            '<div class="qz-stats" style="margin-top:18px;">' +
            '<div><span>Score</span><strong>' + (d.score != null ? d.score : 0) + ' / ' + (d.total || 0) + '</strong></div>' +
            '<div><span>Percentage</span><strong>' + (d.percentage || 0) + '% (pass mark ' + pass + '%)</strong></div>' +
            '<div><span>Correct answers</span><strong style="color:#16A34A;">' + (d.correct != null ? d.correct : 0) + '</strong></div>' +
            '<div><span>Wrong answers</span><strong style="color:#DC2626;">' + (d.wrong != null ? d.wrong : 0) + (d.skipped ? ' (' + d.skipped + ' unanswered)' : '') + '</strong></div>' +
            '<div><span>Started</span><strong>' + fmtDate(d.startedAt) + '</strong></div>' +
            '<div><span>Finished</span><strong>' + fmtDate(d.submittedAt) + '</strong></div>' +
            '<div><span>Time taken</span><strong>' + fmtDur(d.elapsedTime) + '</strong></div>' +
            '<div><span>Attempt</span><strong>' + used + (maxA > 0 ? ' of ' + maxA : '') + '</strong></div></div>' +
            gate + reviewSlot +
            '<div class="qz-actions">' + (canRetry ? '<button class="btn btn-primary btn-lg" id="qzRetryBtn">↻ Try again</button>' : '') +
            '<button class="btn ' + (canRetry ? 'btn-outline' : 'btn-primary') + ' btn-lg" id="qzToLesson">Back to lesson</button></div>' +
            '</div></div></div>';
        bindBack(root, ctx);
        var tl = root.querySelector('#qzToLesson'); if (tl) tl.onclick = function () { go(backUrl(ctx)); };
        var rt = root.querySelector('#qzRetryBtn');
        if (rt) rt.onclick = function () {
            rt.disabled = true;
            QS.loadAttempt(ctx.sid, q.id).then(function (a) { showIntro(root, ctx, QS.describe(q, a.data, a.legacy)); });
        };

        // مراجعة الإجابات الصحيحة: فقط لو الاختبار يسمح بذلك (الإعداد من الداشبورد)
        if (q.showAnswers === true) {
            QS.fetchFullQuiz(q.id).then(function (full) {
                var slot = root.querySelector('#qzReviewSlot'); if (!slot) return;
                var list = full.questionsList || full.questions || [];
                var ans = d.answers || {};
                slot.innerHTML = '<div class="qz-review"><h4>📋 Review (' + list.length + ' questions)</h4>' + list.map(function (qq, i) {
                    var ch = ans[QS.qKey(qq, i)], opts = qq.opts || [];
                    var ok = ch !== undefined && Number(ch) === Number(qq.correctOpt);
                    return '<div style="display:flex;gap:12px;padding:13px 18px;border-top:1px solid var(--border-light);">' +
                        '<div style="font-size:1.1rem;">' + (ok ? '✅' : (ch === undefined ? '⬜' : '❌')) + '</div><div style="flex:1;min-width:0;">' +
                        '<div style="font-weight:700;color:var(--text-primary);margin-bottom:4px;">' + (i + 1) + '. ' + (qq.q || '') + '</div>' +
                        '<div style="font-size:.85rem;color:' + (ok ? '#16A34A' : '#DC2626') + ';">Your answer: ' + (ch !== undefined && opts[ch] != null ? LETTERS[ch] + '. ' + opts[ch] : '—') + '</div>' +
                        (!ok ? '<div style="font-size:.85rem;color:#16A34A;">Correct answer: ' + (opts[qq.correctOpt] != null ? LETTERS[qq.correctOpt] + '. ' + opts[qq.correctOpt] : '—') + '</div>' : '') +
                        '</div></div>';
                }).join('') + '</div>';
            }).catch(function () {});
        }
    }

    global.QuizUI = { mount: mount, unmount: stopRun, injectStyles: injectStyles };
})(window);
