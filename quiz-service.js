// ═══════════════════════════════════════════════════════════════════════
//  quiz-service.js — منصة الدكتور محمد عبد الله | عميد الفيزياء
//  خدمة محاولات الاختبارات (الطالب) — Firestore هو المصدر الوحيد للحقيقة
//
//  ما الذي تحله هذه الخدمة؟
//   1) المحاولات كانت تُقرأ من localStorage فقط  → الآن تُقرأ من Firestore
//      (أي جهاز/متصفح/تسجيل دخول جديد يرى نفس الحالة).
//   2) المؤقت كان عدّاداً في المتصفح           → الآن مربوط بـ serverTimestamp
//      لوقت بدء المحاولة، ويُستأنف من نفس الوقت الحقيقي على أي جهاز.
//   3) عدد المحاولات كان بلا حد                → الآن يُفرض داخل Transaction.
//   4) الإجابات الصحيحة كانت تصل لكل طالب       → الآن الطالب يستلم نسخة
//      بدون الإجابات (quizzes_public) ولا تُجلب الإجابات إلا لحظة التصحيح.
//
//  حدود مهمة (موثَّقة في التقرير): المنصة لا تستخدم Firebase Auth ولا يوجد
//  سيرفر، فكل ما هنا يمنع التحايل العادي (Refresh / Logout / جهاز آخر /
//  فتح الأدوات بسهولة)، لكنه لا يمنع مطوّراً متمرّساً يكلّم Firestore مباشرة.
//  الحل النهائي لذلك هو Cloud Function + Firebase Auth (انظر التقرير).
// ═══════════════════════════════════════════════════════════════════════
(function (global) {
    'use strict';

    var GRACE_MS = 3000;                       // سماح لتأخر الشبكة عند انتهاء الوقت
    var CACHE_PREFIX = 'iraqi_qs_attempts_';   // كاش أول رسمة فقط — ليس مصدر الحقيقة
    var QUIZ_CACHE_KEY = 'iraqiplatform_quizzes';

    var state = {
        anchorServerMs: null,   // وقت السيرفر عند آخر مزامنة
        anchorPerf: 0,          // performance.now() عند نفس اللحظة
        attempts: {},           // studentId -> { quizId -> attempt }
        attemptsLoaded: {},     // studentId -> bool
        listenerFor: null,
        unsubs: [],
        missing: {}             // quizId -> true (ثبت غيابه من قاعدة البيانات)
    };

    // ── helpers ────────────────────────────────────────────────────
    function db() { return global.db; }
    function fv() { return global.firebase && global.firebase.firestore && global.firebase.firestore.FieldValue; }
    function serverTs() { return fv().serverTimestamp(); }
    function del() { return fv().delete(); }
    function str(x) { return x == null ? '' : String(x); }

    function tsMs(t) {
        if (t == null) return null;
        if (typeof t === 'number') return t;
        if (typeof t.toMillis === 'function') return t.toMillis();
        if (typeof t.seconds === 'number') return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
        if (typeof t === 'string') { var p = Date.parse(t); return isNaN(p) ? null : p; }
        return null;
    }
    function iso(ms) { return ms == null ? null : new Date(ms).toISOString(); }

    // الوقت الحالي بتوقيت السيرفر — يعتمد على ساعة رتيبة (performance.now)
    // فتغيير ساعة الجهاز أثناء الاختبار لا يؤثر على العدّاد.
    function now() {
        if (state.anchorServerMs == null) return Date.now();
        return state.anchorServerMs + (performance.now() - state.anchorPerf);
    }

    function attemptId(sid, qid) { return 'ATT_' + sid + '_' + qid; }
    function legacyId(sid, qid) { return sid + '_' + qid; }
    function qKey(q, i) { return (q && q.id != null && q.id !== '') ? String(q.id) : 'i' + i; }
    function passRateOf(quiz) { return quiz ? (Number(quiz.averageGrade || quiz.passingGrade) || 50) : 50; }
    function maxAttemptsOf(quiz) { var n = parseInt(quiz && quiz.maxAttempts, 10); return isNaN(n) || n < 0 ? 0 : n; } // 0 = مفتوح حتى النجاح
    function durationSecOf(quiz) { var m = parseInt(quiz && quiz.time, 10); return isNaN(m) || m <= 0 ? 0 : m * 60; }

    // ── نسخة الطالب من الاختبار (بدون إجابات) ───────────────────────
    function stripQuiz(q) {
        if (!q) return q;
        var c = JSON.parse(JSON.stringify(q));
        var list = c.questionsList || c.questions || [];
        list.forEach(function (x) {
            delete x.correctOpt; delete x.correct; delete x.correctIndex; delete x.correctAnswer;
            delete x.answer; delete x.explanation; delete x.solution;
        });
        c._public = true;
        return c;
    }

    function readQuizCache() { try { return JSON.parse(localStorage.getItem(QUIZ_CACHE_KEY) || '[]'); } catch (e) { return []; } }
    function cachePutQuiz(q, fallback) {
        var list = readQuizCache();
        var item = stripQuiz(q);
        if (fallback) item._fallback = true;
        var i = list.findIndex(function (x) { return str(x.id) === str(q.id); });
        if (i > -1) list[i] = item; else list.push(item);
        try { localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(list)); } catch (e) {}
    }

    // ── مزامنة ساعة السيرفر ─────────────────────────────────────────
    function syncClock(studentId) {
        if (!db() || !fv()) return Promise.resolve(false);
        var ref = db().collection('quiz_clock').doc(str(studentId || 'anon'));
        var t0 = performance.now();
        return ref.set({ t: serverTs() })
            .then(function () { return ref.get({ source: 'server' }); })
            .then(function (snap) {
                var t1 = performance.now();
                var ms = tsMs(snap.data() && snap.data().t);
                if (ms == null) return false;
                state.anchorServerMs = ms;              // وقت الكتابة على السيرفر ≈ منتصف الرحلة
                state.anchorPerf = (t0 + t1) / 2;
                return true;
            })
            .catch(function () { return false; });
    }

    // ── تطبيع مستند المحاولة للواجهة القديمة والجديدة ────────────────
    function normalize(d) {
        if (!d) return null;
        var o = Object.assign({}, d);
        o.total = d.total != null ? d.total : (d.totalPoints != null ? d.totalPoints : 0);
        o.totalPoints = o.total;
        o.percentage = d.percentage != null ? d.percentage : (o.total > 0 ? Math.round((d.score || 0) / o.total * 100) : 0);
        o.submitted = d.status ? d.status === 'submitted' : (d.score != null);   // المستندات القديمة بلا status
        o.attemptsUsed = d.attemptsUsed != null ? d.attemptsUsed : (o.submitted ? 1 : 0);
        return o;
    }

    // ── الكاش المحلي (لأول رسمة فقط) ────────────────────────────────
    function loadCache(sid) {
        if (state.attempts[sid]) return state.attempts[sid];
        var map = {};
        try { map = JSON.parse(localStorage.getItem(CACHE_PREFIX + sid) || '{}') || {}; } catch (e) {}
        state.attempts[sid] = map;
        return map;
    }
    function saveCache(sid) {
        var slim = {};
        Object.keys(state.attempts[sid] || {}).forEach(function (k) {
            var a = Object.assign({}, state.attempts[sid][k]);
            delete a.answers; delete a.history; delete a.currentRun;
            slim[k] = a;
        });
        try { localStorage.setItem(CACHE_PREFIX + sid, JSON.stringify(slim)); } catch (e) {}
    }

    // ── مستمع محاولات الطالب من Firestore ────────────────────────────
    function ensureListener(studentId) {
        var sid = str(studentId);
        if (!sid) return;
        loadCache(sid);
        if (state.listenerFor === sid) return;
        if (!db()) {
            global.addEventListener('firebaseReady', function () { ensureListener(sid); }, { once: true });
            return;
        }
        state.unsubs.forEach(function (u) { try { u(); } catch (e) {} });
        state.unsubs = [];
        state.listenerFor = sid;
        state.attemptsLoaded[sid] = false;

        var ids = [sid];
        if (/^\d+$/.test(sid)) ids.push(Number(sid));
        var buckets = { a: {}, b: {} };
        var seen = { a: false, b: false };

        function merge() {
            var out = {};
            [buckets.b, buckets.a].forEach(function (bk) {      // a (ATT_) يغلب b (القديم)
                Object.keys(bk).forEach(function (qid) {
                    var cur = out[qid], nxt = bk[qid];
                    if (!cur) { out[qid] = nxt; return; }
                    var curIsNew = !!(cur.currentRun || cur.attemptsUsed != null && cur.status);
                    var nxtIsNew = !!(nxt.currentRun || nxt.attemptsUsed != null && nxt.status);
                    if (nxtIsNew && !curIsNew) out[qid] = nxt;
                });
            });
            var before = JSON.stringify(state.attempts[sid] || {});
            var map = {};
            Object.keys(out).forEach(function (qid) { map[qid] = normalize(out[qid]); });
            state.attempts[sid] = map;
            if (seen.a && seen.b) state.attemptsLoaded[sid] = true;
            saveCache(sid);
            var changed = before !== JSON.stringify(map);
            global.dispatchEvent(new CustomEvent('quizAttemptsUpdated', { detail: { studentId: sid, changed: changed } }));
            // حدّث قفل/فتح الدروس فور وصول الحقيقة من السيرفر (إلا داخل صفحة الاختبار نفسها)
            var h = (global.location.hash || '').replace(/^#/, '');
            if (changed && typeof global.handleRoute === 'function' && h.indexOf('test/') !== 0) {
                try { global.handleRoute(); } catch (e) {}
            }
        }
        function bucketOf(name) {
            return function (snap) {
                var bk = {};
                snap.forEach(function (doc) { var d = doc.data() || {}; if (d.quizId != null) bk[str(d.quizId)] = d; });
                buckets[name] = bk; seen[name] = true; merge();
            };
        }
        function onErr(name) { return function (e) { seen[name] = true; console.warn('[QuizService] attempts listener:', e && e.message); merge(); }; }

        var col = db().collection('quiz_attempts');
        try {
            state.unsubs.push(col.where('studentId', 'in', ids).onSnapshot(bucketOf('a'), onErr('a')));
            state.unsubs.push(col.where('userId', 'in', ids).onSnapshot(bucketOf('b'), onErr('b')));
        } catch (e) { console.warn('[QuizService] listener setup failed:', e.message); }
    }

    // نتيجة الطالب المسجّلة (فقط المحاولات المنتهية) — تستخدمها كل واجهات القفل
    function getAttemptSync(userId, quizId) {
        var sid = str(userId);
        if (!sid) return null;
        ensureListener(sid);
        var a = loadCache(sid)[str(quizId)];
        return a && a.submitted ? a : null;
    }
    function getAnyAttemptSync(userId, quizId) {
        var sid = str(userId); if (!sid) return null;
        ensureListener(sid);
        return loadCache(sid)[str(quizId)] || null;
    }

    // ── قرار قفل الدرس التالي (يعتمد على النتيجة المحفوظة) ──────────────
    function evaluateGate(userId, quizId) {
        var quiz = global.getQuizById ? global.getQuizById(quizId) : null;
        var passRate = passRateOf(quiz);
        if (!quiz) {
            // الاختبار غير موجود في قاعدة البيانات: لا نقفل الطالب إلى الأبد بسبب ID خاطئ/محذوف،
            // لكن لا نفتح قبل التأكد فعلاً من غيابه.
            if (state.missing[str(quizId)]) return { locked: false, state: 'no_quiz', passRate: passRate };
            fetchPublicQuiz(quizId);
            return { locked: true, state: 'loading', passRate: passRate };
        }
        var a = getAttemptSync(userId, quizId);
        if (!a) {
            // قبل وصول أول لقطة من Firestore لا نحكم (تجنّب وميض "مقفول" على جهاز جديد)
            if (!state.attemptsLoaded[str(userId)]) return { locked: true, state: 'loading', passRate: passRate };
            return { locked: true, state: 'no_attempt', passRate: passRate };
        }
        var passed = a.passed === true || (a.passed == null && a.percentage >= passRate);
        if (passed) return { locked: false, state: 'passed', passRate: passRate, achieved: a.percentage };
        return { locked: true, state: 'failed', passRate: passRate, achieved: a.percentage };
    }

    // ── جلب الاختبار (نسخة الطالب) عند الطلب ─────────────────────────
    var _inflight = {};
    function fetchPublicQuiz(quizId) {
        var id = str(quizId);
        if (!id || !db()) return Promise.resolve(null);
        if (_inflight[id]) return _inflight[id];
        _inflight[id] = db().collection('quizzes_public').doc(id).get().then(function (snap) {
            if (snap.exists) { cachePutQuiz(snap.data()); return snap.data(); }
            return db().collection('quizzes').doc(id).get().then(function (s2) {
                if (s2.exists) { cachePutQuiz(s2.data(), true); return stripQuiz(s2.data()); }
                state.missing[id] = true;
                return null;
            });
        }).catch(function (e) { console.warn('[QuizService] fetchPublicQuiz:', e && e.message); return null; })
          .then(function (q) { delete _inflight[id]; if (q || state.missing[id]) global.dispatchEvent(new CustomEvent('quizzesUpdated', { detail: { id: id } })); return q; });
        return _inflight[id];
    }

    // النسخة الكاملة (بالإجابات) — لا تُجلب إلا لحظة التصحيح أو لمراجعة مسموح بها
    function fetchFullQuiz(quizId) {
        if (!db()) return Promise.reject({ code: 'offline' });
        return db().collection('quizzes').doc(str(quizId)).get().then(function (snap) {
            if (!snap.exists) throw { code: 'quiz_missing' };
            return snap.data();
        });
    }

    // ── قراءة مباشرة من السيرفر لمحاولة واحدة ─────────────────────────
    function loadAttempt(studentId, quizId) {
        var sid = str(studentId);
        var ref = db().collection('quiz_attempts').doc(attemptId(sid, quizId));
        return ref.get({ source: 'server' }).catch(function () { return ref.get(); }).then(function (snap) {
            if (snap.exists) return { ref: ref, data: snap.data(), legacy: false };
            var lref = db().collection('quiz_attempts').doc(legacyId(sid, quizId));
            return lref.get({ source: 'server' }).catch(function () { return lref.get(); }).then(function (ls) {
                return ls.exists ? { ref: ref, data: ls.data(), legacy: true } : { ref: ref, data: null, legacy: false };
            });
        });
    }

    // حالة المحاولة كما تراها الواجهة
    function describe(quiz, data, legacy) {
        var maxA = maxAttemptsOf(quiz), dur = durationSecOf(quiz);
        var d = data ? normalize(data) : null;
        var used = d ? d.attemptsUsed : 0;
        var out = { maxAttempts: maxA, durationSec: dur, attemptsUsed: used, attemptsLeft: maxA > 0 ? Math.max(0, maxA - used) : null,
                    data: d, kind: 'not_started', remainingMs: null, deadlineMs: null };
        if (!d) return out;
        if (data.status === 'in_progress' && data.currentRun) {
            var st = tsMs(data.currentRun.startedAt);
            var dl = (dur > 0 && st != null) ? st + dur * 1000 : null;
            out.deadlineMs = dl;
            out.remainingMs = dl != null ? dl - now() : null;
            out.kind = (dl != null && out.remainingMs <= -GRACE_MS) ? 'expired' : 'in_progress';
            return out;
        }
        if (d.submitted) {
            var passed = d.passed === true || (d.passed == null && d.percentage >= passRateOf(quiz));
            if (passed) out.kind = 'passed';
            else if (maxA > 0 && used >= maxA) out.kind = 'no_attempts_left';
            else out.kind = 'failed_can_retry';
        }
        return out;
    }

    // ── بدء المحاولة أو استئنافها (Transaction) ─────────────────────
    function startOrResume(ctx) {
        var quiz = ctx.quiz, sid = str(ctx.studentId);
        var ref = db().collection('quiz_attempts').doc(attemptId(sid, quiz.id));
        var lref = db().collection('quiz_attempts').doc(legacyId(sid, quiz.id));
        var dur = durationSecOf(quiz), maxA = maxAttemptsOf(quiz);

        return syncClock(sid).then(function () {
            return db().runTransaction(function (tx) {
                return tx.get(ref).then(function (snap) {
                    return tx.get(lref).then(function (ls) {
                        var d = snap.exists ? snap.data() : null;
                        var legacy = (!d && ls.exists) ? ls.data() : null;
                        var used = d ? (d.attemptsUsed || 0) : (legacy ? 1 : 0);
                        var passedEver = d ? !!d.passed : (legacy ? !!legacy.passed : false);

                        if (d && d.status === 'in_progress' && d.currentRun) {
                            var st = tsMs(d.currentRun.startedAt);
                            if (dur > 0 && st != null && now() - st >= dur * 1000 + GRACE_MS) return { mode: 'expired' };
                            return { mode: 'resume' };
                        }
                        if (passedEver) throw { code: 'already_passed' };
                        if (maxA > 0 && used >= maxA) throw { code: 'no_attempts_left' };

                        var n = used + 1;
                        var base = {};
                        if (legacy) {                                    // نحافظ على نتيجة المحاولة القديمة
                            ['score', 'total', 'correct', 'wrong', 'percentage', 'passed', 'answers', 'submittedAt'].forEach(function (k) { if (legacy[k] !== undefined) base[k] = legacy[k]; });
                        }
                        var doc = Object.assign(base, {
                            id: ref.id, studentId: sid, userId: sid,
                            studentName: ctx.studentName || '', userName: ctx.studentName || '',
                            studentCode: ctx.studentCode || sid,
                            quizId: str(quiz.id), quizTitle: quiz.title || '',
                            courseId: str(ctx.courseId), lessonId: str(ctx.lessonId),
                            status: 'in_progress', attemptsUsed: n, maxAttempts: maxA,
                            passRate: passRateOf(quiz),
                            currentRun: { n: n, startedAt: serverTs(), durationSec: dur, answers: {} },
                            updatedAt: serverTs()
                        });
                        tx.set(ref, doc, { merge: true });
                        return { mode: 'new' };
                    });
                });
            });
        }).then(function (res) {
            return ref.get({ source: 'server' }).then(function (s) { return { mode: res.mode, data: s.data(), ref: ref }; });
        });
    }

    // ── حفظ الإجابات أثناء الحل (تُستأنف من أي جهاز) ─────────────────
    function saveAnswers(ref, answers) {
        return ref.update({ 'currentRun.answers': answers, lastSeenAt: serverTs() });
    }

    // ── التصحيح ──────────────────────────────────────────────────────
    function gradeAnswers(full, answers) {
        var list = full.questionsList || full.questions || [];
        var total = 0, earned = 0, correct = 0, wrong = 0, skipped = 0;
        list.forEach(function (q, i) {
            var pts = Number(q.points) || 1; total += pts;
            var ch = answers ? answers[qKey(q, i)] : undefined;
            if (ch === undefined || ch === null || ch === '') { skipped++; wrong++; return; }
            if (Number(ch) === Number(q.correctOpt)) { correct++; earned += pts; } else { wrong++; }
        });
        var pct = total > 0 ? Math.round(earned / total * 100) : 0;
        return { earned: earned, total: total, correct: correct, wrong: wrong, skipped: skipped, pct: pct, count: list.length };
    }

    // ── إنهاء المحاولة وتصحيحها وحفظ النتيجة (Transaction — آمن للتكرار) ──
    function finalize(ref, quiz, reason) {
        return fetchFullQuiz(quiz.id).then(function (full) {
            return db().runTransaction(function (tx) {
                return tx.get(ref).then(function (snap) {
                    var d = snap.exists ? snap.data() : null;
                    if (!d) throw { code: 'no_attempt' };
                    if (d.status !== 'in_progress' || !d.currentRun) return { already: true, data: d };   // انتهت بالفعل (جهاز آخر/نافذة أخرى)
                    var run = d.currentRun, answers = run.answers || {};
                    var g = gradeAnswers(full, answers);
                    var st = tsMs(run.startedAt), nowMs = Math.round(now());
                    var dur = run.durationSec || 0;
                    var elapsed = st != null ? Math.max(0, Math.round((nowMs - st) / 1000)) : 0;
                    if (dur > 0) elapsed = Math.min(elapsed, dur);
                    var passRate = passRateOf(full);
                    var passed = g.pct >= passRate;
                    var hist = (d.history || []).concat([{
                        n: run.n, score: g.earned, total: g.total, percentage: g.pct, passed: passed,
                        correct: g.correct, wrong: g.wrong, startedAtMs: st, submittedAtMs: nowMs, elapsedTime: elapsed, reason: reason || 'submit'
                    }]);
                    var patch = {
                        status: 'submitted', score: g.earned, total: g.total, totalPoints: g.total,
                        correct: g.correct, wrong: g.wrong, skipped: g.skipped, percentage: g.pct,
                        passed: (d.passed === true) || passed, lastPassed: passed, passRate: passRate,
                        answers: answers, startedAt: iso(st), submittedAt: iso(nowMs), submittedAtServer: serverTs(),
                        elapsedTime: elapsed, finishReason: reason || 'submit', history: hist,
                        currentRun: del(), updatedAt: serverTs(), quizTitle: full.title || d.quizTitle || ''
                    };
                    tx.update(ref, patch);
                    var ret = Object.assign({}, d, patch);
                    delete ret.currentRun; delete ret.submittedAtServer; delete ret.updatedAt;
                    return { already: false, data: ret };
                });
            });
        }).then(function (res) {
            var data = normalize(res.data);
            if (data && data.submitted && data.passed && data.courseId && data.lessonId && typeof global.markLessonCompleted === 'function') {
                try { global.markLessonCompleted(str(data.studentId || data.userId), data.courseId, data.lessonId); } catch (e) {}
            }
            var sid = str(data && (data.studentId || data.userId));
            if (sid && data) { loadCache(sid)[str(data.quizId)] = data; saveCache(sid); }
            global.dispatchEvent(new CustomEvent('quizAttemptSaved', { detail: { quizId: data && data.quizId, courseId: data && data.courseId, lessonId: data && data.lessonId, passed: data && data.passed, percentage: data && data.percentage } }));
            return { already: res.already, data: data };
        });
    }

    // ينتظر وصول أول لقطة من Firestore لمحاولات الطالب (حتى لا نحكم بالقفل من كاش قديم)
    function whenReady(userId, timeoutMs) {
        var sid = str(userId);
        ensureListener(sid);
        if (state.attemptsLoaded[sid]) return Promise.resolve(true);
        return new Promise(function (resolve) {
            var t = setTimeout(function () { off(); resolve(false); }, timeoutMs || 4000);
            function on() { if (state.attemptsLoaded[sid]) { clearTimeout(t); off(); resolve(true); } }
            function off() { global.removeEventListener('quizAttemptsUpdated', on); }
            global.addEventListener('quizAttemptsUpdated', on);
        });
    }

    // ── تجاوز الدوال القديمة (كانت تكتب مستندات بصيغة مختلفة) ────────────
    global.getQuizAttempt = function (userId, quizId) { return getAttemptSync(userId, quizId); };
    global.saveQuizAttempt = function () {
        console.warn('[QuizService] saveQuizAttempt القديمة لم تعد مستخدمة — النتائج تُحفظ عبر QuizService.finalize داخل Transaction.');
    };

    global.QuizService = {
        GRACE_MS: GRACE_MS, now: now, syncClock: syncClock, tsMs: tsMs, iso: iso,
        attemptId: attemptId, qKey: qKey, passRateOf: passRateOf, maxAttemptsOf: maxAttemptsOf, durationSecOf: durationSecOf,
        stripQuiz: stripQuiz, ensureListener: ensureListener, getAttemptSync: getAttemptSync, getAnyAttemptSync: getAnyAttemptSync,
        evaluateGate: evaluateGate, whenReady: whenReady, fetchPublicQuiz: fetchPublicQuiz, fetchFullQuiz: fetchFullQuiz,
        loadAttempt: loadAttempt, describe: describe, startOrResume: startOrResume, saveAnswers: saveAnswers,
        gradeAnswers: gradeAnswers, finalize: finalize, normalize: normalize
    };

    // ابدأ الاستماع لنتائج الطالب فور فتح المنصة (قبل أن يفتح أي درس) حتى يكون قفل/فتح الدروس جاهزاً
    function autoStart() {
        var u = global.AuthService && global.AuthService.getCurrentUser();
        if (u && u.id) { ensureListener(u.id); return; }
        // خرج المستخدم: أوقف المستمع وامسح الحالة الخاصة به من الذاكرة
        state.unsubs.forEach(function (fn) { try { fn(); } catch (e) {} });
        state.unsubs = []; state.listenerFor = null; state.attempts = {}; state.attemptsLoaded = {};
    }
    if (global.AuthService) global.AuthService.ready().then(autoStart);
    global.addEventListener('authchange', autoStart);

    // حذف نسخة قديمة كاملة (بالإجابات) من كاش متصفح الطالب إذا لم تكن هذه جلسة مدرس
    try {
        if (!localStorage.getItem('alsaqr_current_user')) {
            var old = localStorage.getItem('alsaqr_quizzes');
            if (old && old.indexOf('correctOpt') > -1) localStorage.removeItem('alsaqr_quizzes');
        }
    } catch (e) {}
})(window);
