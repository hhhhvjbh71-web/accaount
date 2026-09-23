// ═══════════════════════════════════════════════════════════════════════
//  dashboard-bridge.js  — جسر الربط الكامل
//  منصة الدكتور محمد عبد الله — عميد الفيزياء
//
//  يُحمَّل هذا الملف في index.html بعد data.js وقبل app.js
//
//  المهام:
//  1. يحوّل كورسات Dashboard (بنية alsaqr_courses) إلى بنية COURSES_DATA
//  2. يدمجها مع الكورسات الثابتة في COURSES_DATA
//  3. يُزامن كل تغيير من Dashboard فور حدوثه (localStorage observer)
//  4. يربط الدروس والمحتوى (lessons / segments) بـ getEffectiveCoursePackages
//  5. يُصدِّر getAllCourses() لكي يستخدمها app.js بدلاً من COURSES_DATA مباشرة
// ═══════════════════════════════════════════════════════════════════════

(function (global) {
    'use strict';

    // ── المفاتيح ─────────────────────────────────────────────────────
    const DASH_KEY    = 'alsaqr_courses';           // dashboard.html يكتب هنا
    const IRAQI_KEY   = 'iraqiplatform_lessons';    // بنية data.js للدروس
    const CONTENT_KEY = 'iraqiplatform_contents';   // بنية data.js للمحتوى
    const USERS_DASH  = 'alsaqr_users';             // مستخدمو Dashboard
    const USERS_IRAQI = 'iraqiplatform_users';      // مستخدمو المنصة

    // ── خريطة الصفوف ─────────────────────────────────────────────────
    const GRADE_LABEL = {
        '1':'الصف الأول الثانوي', '2':'الصف الثاني الثانوي', '2prog':'الصف الثاني الثانوي — برمجة', '3':'الصف الثالث الثانوي',
        '1prep':'الصف الأول الإعدادي', '2prep':'الصف الثاني الإعدادي', '3prep':'الصف الثالث الإعدادي',
        'أولى إعدادي':'الصف الأول الإعدادي', 'تانية إعدادي':'الصف الثاني الإعدادي', 'تالتة إعدادي':'الصف الثالث الإعدادي',
        'الصف الأول الإعدادي':'الصف الأول الإعدادي', 'الصف الثاني الإعدادي':'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي':'الصف الثالث الإعدادي',
        'بكالوريا عام برمجة':'بكالوريا عام برمجة',
        'all':'جميع المراحل'
    };
    const GRADE_TAG = {
        '1':'أولى ثانوي', '2':'تانية ثانوي', '2prog':'تانية ثانوي برمجة', '3':'تالتة ثانوي',
        '1prep':'أولى إعدادي', '2prep':'تانية إعدادي', '3prep':'تالتة إعدادي',
        'أولى إعدادي':'أولى إعدادي', 'تانية إعدادي':'تانية إعدادي', 'تالتة إعدادي':'تالتة إعدادي',
        'الصف الأول الإعدادي':'أولى إعدادي', 'الصف الثاني الإعدادي':'تانية إعدادي', 'الصف الثالث الإعدادي':'تالتة إعدادي',
        'بكالوريا عام برمجة':'بكالوريا عام برمجة',
        'all':'عام'
    };
    const TERM_LABEL = {
        '1':'الترم الأول','2':'الترم الثاني','all':'عام'
    };

    // ── تحويل درس Dashboard → lesson + contents بنية data.js ──────────
    function normalizeVideoKey(url) {
        return String(url || '')
            .trim()
            .replace(/[?&]autoplay=false\b/g, '')
            .replace(/\/$/, '')
            .toLowerCase();
    }

    function dedupeSegments(segs) {
        const seen = {};
        return (Array.isArray(segs) ? segs : []).filter(function(seg) {
            if (!seg) return false;
            const bunnyId = String(seg.bunnyVideoId || '').trim();
            const videoUrl = normalizeVideoKey(seg.videoUrl || seg.content || '');
            if (!bunnyId && !videoUrl) return false;
            const key = bunnyId ? ('b:' + bunnyId) : ('u:' + videoUrl);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    function getLessonFingerprint(lesson) {
        if (!lesson) return '';
        const segs = dedupeSegments(lesson.segments || []);
        const firstSeg = segs[0] || {};
        const bunnyId = String(lesson.bunnyVideoId || firstSeg.bunnyVideoId || '').trim();
        const videoUrl = normalizeVideoKey(lesson.videoUrl || firstSeg.videoUrl || '');
        const pdfUrl = normalizeVideoKey(lesson.pdfUrl || '');
        const quizId = String(lesson.quizId || '').trim().toLowerCase();
        if (bunnyId) return 'b:' + bunnyId;
        if (videoUrl) return 'v:' + videoUrl;
        if (pdfUrl) return 'p:' + pdfUrl;
        if (quizId) return 'q:' + quizId;
        return 't:' + String(lesson.title || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function dedupeLessons(lessons) {
        const seen = {};
        return (Array.isArray(lessons) ? lessons : []).filter(function(lesson) {
            const key = getLessonFingerprint(lesson);
            if (!key) return false;
            if (seen[key]) return false;
            seen[key] = true;
            if (Array.isArray(lesson.segments)) lesson.segments = dedupeSegments(lesson.segments);
            return true;
        }).map(function(lesson, index) {
            lesson.position = index + 1;
            return lesson;
        });
    }

    function dashLessonsToIraqi(courseId, dashLessons) {
        const lessonsOut  = [];
        const contentsOut = [];
        dedupeLessons(dashLessons || []).forEach(function(dl, i) {
            const lessonId = dl.id ? String(dl.id) : ('dl_' + courseId + '_' + i);
            // درس واحد = lesson object
            lessonsOut.push({
                lessonId: lessonId,
                courseId: String(courseId),
                title: dl.title || ('درس ' + (i + 1)),
                description: dl.description || '',
                order: dl.position != null ? dl.position : (i + 1),
                status: 'published',
                quizId: dl.quizId || null,    // ← نحتفظ بـ quizId لصفحة test
                createdAt: dl.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            // segments (multi-video) → contents
            const segs = Array.isArray(dl.segments) && dl.segments.length > 0
                ? dedupeSegments(dl.segments)
                : null;
            if (segs) {
                segs.forEach(function(seg, si) {
                    contentsOut.push({
                        contentId: seg.id ? String(seg.id) : ('seg_' + lessonId + '_' + si),
                        lessonId:  lessonId,
                        type:      'video',
                        title:     seg.title  || ('مقطع ' + (si + 1)),
                        content:   seg.videoUrl || '',
                        duration:  seg.duration || '',
                        order:     seg.position != null ? seg.position : (si + 1),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                });
            } else {
                // legacy single-video or pdf lesson
                const hasVideo = dl.videoUrl && dl.videoUrl.trim();
                const hasPdf   = dl.pdfUrl   && dl.pdfUrl.trim();
                const hasQuiz  = dl.quizId   != null;
                let order = 1;
                if (hasVideo) {
                    contentsOut.push({
                        contentId: 'vid_' + lessonId,
                        lessonId:  lessonId,
                        type:      'video',
                        title:     dl.title || 'فيديو الدرس',
                        content:   dl.videoUrl,
                        duration:  dl.duration || '',
                        order:     order++,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
                if (hasPdf) {
                    contentsOut.push({
                        contentId: 'pdf_' + lessonId,
                        lessonId:  lessonId,
                        type:      'pdf',
                        title:     (dl.title || 'ملف') + ' — PDF',
                        content:   dl.pdfUrl,
                        duration:  '',
                        order:     order++,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
                if (hasQuiz) {
                    contentsOut.push({
                        contentId: 'quiz_' + lessonId,
                        lessonId:  lessonId,
                        type:      'quiz',
                        title:     'اختبار — ' + (dl.title || 'الدرس'),
                        content:   String(dl.quizId),
                        duration:  '',
                        order:     order++,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
                // درس بدون محتوى حقيقي → لا نضيف placeholder وهمية
                // سيظهر الدرس في القائمة بدون محتوى، وسيُعرض "لا يوجد محتوى" للطالب
                if (!hasVideo && !hasPdf && !hasQuiz) {
                    // لا نضيف شيئاً — الدرس يظهر بقائمة محتوى فارغة
                }
            }
        });
        return { lessons: lessonsOut, contents: contentsOut };
    }

    // ── تحويل كورس Dashboard → كورس بنية COURSES_DATA ──────────────
    function dashCourseToIraqi(dc) {
        const gStr   = String(dc.grade || 'all');
        const tStr   = String(dc.term  || 'all');
        const isFree = dc.type === 'free' || !dc.price || Number(dc.price) === 0;
        const thumb  = dc.thumbnail || dc.thumb || '';
        const color  = dc.headerColor || dc.color || dc.bg || 'linear-gradient(135deg,#1a1227,#572e9f)';
        const lessons = dedupeLessons(dc.lessons || []);
        const id = String(dc.id);

        // حساب عدد الدروس والمدة
        let lessonsCount = 0;
        let durationParts = [];
        lessons.forEach(function(l) {
            const segs = Array.isArray(l.segments) && l.segments.length ? l.segments : null;
            if (segs) {
                const validSegs = segs.filter(function(s) { return s.videoUrl && s.videoUrl.trim() !== ''; });
                lessonsCount += validSegs.length;
            } else {
                const hasVideo = l.videoUrl && l.videoUrl.trim() !== '';
                const hasPdf   = l.pdfUrl   && l.pdfUrl.trim() !== '';
                const hasQuiz  = l.quizId   != null;
                if (hasVideo || hasPdf || hasQuiz) {
                    lessonsCount += 1;
                }
            }
            if (l.duration) durationParts.push(l.duration);
        });

        // packages للعرض للطلاب (packages يرجع من getEffectiveCoursePackages)
        const packages = lessons.map(function(l, i) {
            const lessonId = String(l.id || ('l_' + id + '_' + i));
            const segs = Array.isArray(l.segments) && l.segments.length ? l.segments : [];
            const validSegs = dedupeSegments(segs);

            let pkgLessons = [];
            
            if (validSegs.length > 1) {
                pkgLessons = validSegs.map(function(seg, si) {
                    var sUrl = seg.bunnyVideoId
                        ? ('https://iframe.mediadelivery.net/embed/691851/' + seg.bunnyVideoId + '?autoplay=false')
                        : (seg.videoUrl || '');
                    return {
                        id:  seg.id ? String(seg.id) : (lessonId + '_seg_' + si),
                        lessonId: lessonId,
                        title: seg.title || (l.title + ' — مقطع ' + (si+1)),
                        type: 'video',
                        duration: seg.duration || l.duration || '—',
                        content: sUrl,
                        videoUrl: sUrl,
                        bunnyVideoId: seg.bunnyVideoId || '',
                        segments: validSegs,
                        pdfUrl: l.pdfUrl || '',
                        quizId: l.quizId || null,
                        isCompleted: false,
                        isLocked: false
                    };
                });
            } else {
                const rawV = (validSegs[0] && validSegs[0].videoUrl) || l.videoUrl || (l.bunnyVideoId ? ('https://iframe.mediadelivery.net/embed/691851/' + l.bunnyVideoId + '?autoplay=false') : ((validSegs[0] && validSegs[0].bunnyVideoId) ? ('https://iframe.mediadelivery.net/embed/691851/' + validSegs[0].bunnyVideoId + '?autoplay=false') : ''));
                const hasVideo = Boolean(rawV || validSegs.length > 0);
                const hasPdf   = Boolean(l.pdfUrl && l.pdfUrl.trim() !== '');
                const hasQuiz  = l.quizId != null && l.quizId !== '';
                const singleTitle = l.title || (validSegs[0] && validSegs[0].title) || ('درس ' + (i + 1));
                const singleDuration = (validSegs[0] && validSegs[0].duration) || l.duration || '—';
                
                pkgLessons.push({
                    id: lessonId,
                    lessonId: lessonId,
                    title: singleTitle,
                    type: hasVideo ? 'video' : (hasQuiz ? 'quiz' : (hasPdf ? 'pdf' : 'video')),
                    duration: singleDuration,
                    content: rawV || l.pdfUrl || String(l.quizId || ''),
                    videoUrl: rawV,
                    bunnyVideoId: l.bunnyVideoId || (validSegs[0] ? validSegs[0].bunnyVideoId : ''),
                    segments: validSegs,
                    pdfUrl: l.pdfUrl || '',
                    quizId: l.quizId || null,
                    isCompleted: false,
                    isLocked: false
                });
            }
            
            return {
                id: 'pkg_' + lessonId,
                title: l.title || ('درس ' + (i + 1)),
                lessons: pkgLessons
            };
        });

        return {
            id: id,
            title: dc.title || 'كورس بدون اسم',
            desc: dc.aiSmartDesc || dc.desc || dc.description || '',
            description: dc.aiSmartDesc || dc.desc || dc.description || '',
            grade: GRADE_LABEL[gStr] || gStr,
            gradeTag: GRADE_TAG[gStr] || gStr,
            term: TERM_LABEL[tStr] || tStr,
            lessonsCount: lessonsCount || lessons.length,
            duration: durationParts.length
                ? durationParts[durationParts.length - 1]
                : (lessons.length + ' دروس'),
            studentsCount: dc.studentsCount || 0,
            rating: dc.rating || 4.8,
            price: Number(dc.price) || 0,
            oldPrice: dc.oldPrice != null ? Number(dc.oldPrice) : null,
            currency: 'ج.م',
            isFree: isFree,
            status: dc.status || (isFree ? 'free' : (dc.type === 'paid' ? 'paid' : '')),
            statusTag: dc.statusTag || dc.status || (isFree ? 'free' : (dc.cardBadgeType && dc.cardBadgeType !== 'auto' ? dc.cardBadgeType : (dc.type === 'paid' ? 'paid' : ''))),
            cardBadgeType: dc.cardBadgeType || 'auto',
            isMostViewed: Boolean(dc.isMostViewed || dc.status === 'most_viewed' || dc.statusTag === 'most_viewed' || dc.cardBadgeType === 'popular' || dc.cardBadgeType === 'most_viewed'),
            courseType: dc.courseType || 'normal',
            childCourseIds: dc.childCourseIds || [],
            icon: dc.emoji || dc.icon || '📚',
            color: color,
            thumb: thumb,
            thumbnail: thumb,
            thumbnailX: dc.thumbnailX || 50,
            thumbnailY: dc.thumbnailY || 50,
            headerTitle: dc.headerTitle || dc.title || '',
            headerColor: color,
            bannerImage: dc.bannerImage || '',
            bannerBg: dc.bannerBg || '',
            bannerColor: dc.bannerColor || color,
            cardShowBadge: dc.cardShowBadge !== false,
            cardNamePosition: dc.cardNamePosition || 'top',
            cardNameBg: dc.cardNameBg || '#5426a3',
            cardNameColor: dc.cardNameColor || '#ffffff',
            cardShowStatus: dc.cardShowStatus !== false,
            cardShowHover: dc.cardShowHover !== false,
            cardRadius: dc.cardRadius || 24,
            imageLayout: dc.imageLayout || 'top',
            progress: 0,
            lessons: lessons,
            packages: packages,
            _fromDashboard: true,
            _dashId: dc.id
        };
    }

    // ── قراءة كورسات Dashboard ──────────────────────────────────────
    function getDashCourses() {
        try {
            var raw = localStorage.getItem(DASH_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch(e) { return []; }
    }

    // ── دمج الكورسات وكتابة الدروس/المحتوى في iraqiplatform keys ──
    function syncDashToIraqi() {
        var dashCourses = getDashCourses();
        if (dashCourses.length === 0) return;

        var dashCourseIds = dashCourses.map(function(c) { return String(c.id); });

        // ── اقرأ الدروس والمحتوى الحالية ────────────────────────────
        var existingLessons  = [];
        var existingContents = [];
        try { existingLessons  = JSON.parse(localStorage.getItem(IRAQI_KEY)   || '[]'); } catch(e) {}
        try { existingContents = JSON.parse(localStorage.getItem(CONTENT_KEY) || '[]'); } catch(e) {}

        // ── أزل كل ما يخص كورسات Dashboard (حسب courseId في الدروس) ─
        // أولاً: احفظ IDs الدروس المرتبطة بـ Dashboard قبل الحذف
        var dashLessonIds = new Set(existingLessons
            .filter(function(l) { return dashCourseIds.includes(l.courseId); })
            .map(function(l) { return l.lessonId; }));

        // أزل الدروس التابعة لـ Dashboard
        existingLessons = existingLessons.filter(function(l) {
            return !dashCourseIds.includes(l.courseId);
        });

        // أزل المحتوى التابع لدروس Dashboard (بدقة حسب lessonId المحذوفة)
        existingContents = existingContents.filter(function(ct) {
            return !dashLessonIds.has(ct.lessonId);
        });

        // ── أضف الدروس والمحتوى الجديدة من Dashboard (مرة واحدة فقط) ─
        dashCourses.forEach(function(dc) {
            var converted = dashLessonsToIraqi(String(dc.id), dc.lessons || []);
            // تحقق من عدم التكرار عبر lessonId قبل الإضافة
            converted.lessons.forEach(function(l) {
                if (!existingLessons.some(function(e) { return e.lessonId === l.lessonId; })) {
                    existingLessons.push(l);
                }
            });
            converted.contents.forEach(function(c) {
                if (!existingContents.some(function(e) { return e.contentId === c.contentId; })) {
                    existingContents.push(c);
                }
            });
        });

        localStorage.setItem(IRAQI_KEY, JSON.stringify(existingLessons));
        localStorage.setItem(CONTENT_KEY, JSON.stringify(existingContents));
    }

    // ── getAllCourses: الدالة الرئيسية التي تستخدمها app.js ──────────
    global.getAllCourses = function() {
        var staticCourses = global.COURSES_DATA || (typeof COURSES_DATA !== 'undefined' ? COURSES_DATA : []);
        var dashCourses   = getDashCourses();
        if (!dashCourses.length) return staticCourses;

        var staticIds = new Set(staticCourses.map(function(c) { return String(c.id); }));
        var converted = dashCourses.map(dashCourseToIraqi);

        // تحديث الكورسات الثابتة إذا تطابقت الـ ID
        var updatedStatic = staticCourses.map(function(sc) {
            var override = converted.find(function(dc) {
                return String(dc.id) === String(sc.id);
            });
            return override ? Object.assign({}, sc, override) : sc;
        });

        // الجديدة فقط (غير موجودة في static)
        var newDash = converted.filter(function(dc) {
            return !staticIds.has(String(dc.id));
        });

        return updatedStatic.concat(newDash);
    };

    // ── مزامنة الطلاب (alsaqr_users ↔ iraqiplatform_users) ──────────
    function syncStudents() {
        try {
            var dashUsers  = JSON.parse(localStorage.getItem(USERS_DASH)  || '[]');
            var iraqiUsers = JSON.parse(localStorage.getItem(USERS_IRAQI) || '[]');

            // ربط enrolledCourses: الطلاب المسجلون في Dashboard يأخذون
            // كورساتهم في iraqiplatform_users أيضاً
            dashUsers.forEach(function(du) {
                if (!du.phone && !du.qrCode) return;
                var key = du.phone || du.qrCode || du.id;
                var idx = iraqiUsers.findIndex(function(iu) {
                    return iu.phone === key || iu.id === key;
                });
                if (idx >= 0 && Array.isArray(du.enrolledCourses)) {
                    // دمج enrolledCourses بدون تكرار
                    var existing = iraqiUsers[idx].enrolledCourses || [];
                    du.enrolledCourses.forEach(function(cid) {
                        var cidStr = String(cid);
                        if (!existing.some(function(e) { return String(e) === cidStr; })) {
                            existing.push(cidStr);
                        }
                    });
                    iraqiUsers[idx].enrolledCourses = existing;
                }
            });
            localStorage.setItem(USERS_IRAQI, JSON.stringify(iraqiUsers));
        } catch(e) { /* ignore */ }
    }

    // ── مراقبة localStorage: أي تغيير في alsaqr_courses يُزامَن فوراً ─
    var _origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
        _origSetItem.call(this, key, value);
        if (key === DASH_KEY || key === USERS_DASH) {
            try {
                syncDashToIraqi();
                if (key === USERS_DASH) syncStudents();
                // إشعار app.js بالتحديث (لو كانت الصفحة مفتوحة)
                if (typeof global.refreshCoursesUI === 'function') {
                    setTimeout(function() { global.refreshCoursesUI(); }, 50);
                }
                window.dispatchEvent(new CustomEvent('iraqiCoursesUpdated'));
            } catch(e) { /* ignore */ }
        }
    };

    // ── تشغيل المزامنة عند التحميل ──────────────────────────────────
    syncDashToIraqi();
    syncStudents();

    // ── تحديث app.js عند استقبال حدث التحديث ────────────────────────
    window.addEventListener('iraqiCoursesUpdated', function() {
        syncDashToIraqi();
        if (typeof global.refreshCoursesUI === 'function') {
            global.refreshCoursesUI();
        }
    });

    // ── مزامنة مباشرة مع Firebase platform_data/courses_list ─────────
    var _bridgeStarted = false;

    function triggerUIRefresh() {
        syncDashToIraqi();
        if (typeof global.refreshCoursesUI === 'function') {
            global.refreshCoursesUI();
            setTimeout(function() { global.refreshCoursesUI(); }, 200);
            setTimeout(function() { global.refreshCoursesUI(); }, 800);
        }
        global.dispatchEvent(new CustomEvent('iraqiCoursesUpdated'));
    }

    function startFirebaseBridgeSync() {
        if (_bridgeStarted) return;
        var db = window.db;
        if (!db) return;
        _bridgeStarted = true;
        try {
            db.collection('platform_data').doc('courses_list')
                .onSnapshot({ includeMetadataChanges: false }, function(doc) {
                    if (!doc.exists) return;
                    var data = doc.data() || {};
                    var items = Array.isArray(data.items) ? data.items : [];
                    if (items.length > 0) {
                        localStorage.setItem(DASH_KEY, JSON.stringify(items));
                        localStorage.setItem('alsaqr_courses_initialized', '1');
                        triggerUIRefresh();
                    }
                }, function(err) {
                    console.warn('[Bridge] platform_data snapshot error:', err.message);
                    _bridgeStarted = false;
                });
            console.info('[Bridge] ✅ Firebase real-time listener attached');
        } catch(e) {
            console.warn('[Bridge] Firebase listener setup failed:', e.message);
            _bridgeStarted = false;
        }
    }

    // ── مزامنة الاختبارات للطالب من Firebase ──────────────────────────
    // الطالب يقرأ collection('quizzes_public') = نسخة الاختبار **بدون الإجابات الصحيحة**
    // (تُكتب من الداشبورد عند كل حفظ). الإجابات الصحيحة تبقى في collection('quizzes')
    // ولا تُجلب إلا لحظة التصحيح (QuizService.finalize).
    // fallback: لو النسخة العامة لم تُنشر بعد لاختبار قديم → يُجلب من 'quizzes' ويُجرَّد
    // من الإجابات قبل التخزين (ينتهي الاحتياج لهذا بمجرد فتح الداشبورد مرة واحدة).
    var _quizzesSyncStarted = false;
    var QUIZ_CACHE_KEY = 'iraqiplatform_quizzes';

    function stripAnswers(q) {
        if (!q) return q;
        var c = JSON.parse(JSON.stringify(q));
        (c.questionsList || c.questions || []).forEach(function (x) {
            delete x.correctOpt; delete x.correct; delete x.correctIndex; delete x.correctAnswer;
            delete x.answer; delete x.explanation; delete x.solution;
        });
        c._public = true;
        return c;
    }
    function readQuizCache() { try { return JSON.parse(localStorage.getItem(QUIZ_CACHE_KEY) || '[]'); } catch (e) { return []; } }

    function applyQuizList(list) {
        // نحتفظ بالعناصر التي جُلبت عند الطلب (_fallback) ولم تصل بعد في القائمة العامة
        var keep = readQuizCache().filter(function (x) {
            return x && x._fallback && !list.some(function (y) { return String(y.id) === String(x.id); });
        });
        localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(list.concat(keep)));
        window.__quizzesLoaded = true;
        try {
            var _hash = (window.location.hash || '').replace(/^#/, '');
            // لا نعيد رسم صفحة الاختبار الحية حتى لا نقطع الطالب أثناء الحل
            if (typeof window.handleRoute === 'function' && _hash.indexOf('test/') !== 0) window.handleRoute();
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('quizzesUpdated', { detail: { count: list.length } }));
    }

    function startQuizzesFirebaseSync() {
        if (_quizzesSyncStarted) return;
        var db = window.db;
        if (!db) return;
        _quizzesSyncStarted = true;
        try {
            db.collection('quizzes_public').onSnapshot({ includeMetadataChanges: false }, function (snapshot) {
                var list = [];
                snapshot.forEach(function (doc) {
                    var d = stripAnswers(doc.data() || {});
                    if (d.id == null) d.id = doc.id;
                    list.push(d);
                });
                if (list.length) { applyQuizList(list); return; }
                // لا توجد نسخ عامة بعد → fallback مؤقت من 'quizzes' (بعد تجريد الإجابات)
                db.collection('quizzes').get().then(function (snap) {
                    var l2 = [];
                    snap.forEach(function (doc) {
                        var d = stripAnswers(doc.data() || {});
                        if (d.id == null) d.id = doc.id;
                        d._fallback = true;
                        l2.push(d);
                    });
                    applyQuizList(l2);
                }).catch(function () { applyQuizList([]); });
            }, function (err) {
                console.warn('[Bridge] quizzes_public snapshot error:', err.message);
                _quizzesSyncStarted = false;
            });
            console.info('[Bridge] ✅ Firebase quizzes_public listener attached');
        } catch (e) {
            console.warn('[Bridge] quizzes listener setup failed:', e.message);
            _quizzesSyncStarted = false;
        }
    }

    // انتظر window.db — جرب فوراً ثم عبر الحدث ثم fallbacks متعددة
    if (window.db) {
        startFirebaseBridgeSync();
        startQuizzesFirebaseSync();
    } else {
        window.addEventListener('firebaseReady', function() {
            startFirebaseBridgeSync();
            startQuizzesFirebaseSync();
        });
        [1000, 3000, 6000].forEach(function(delay) {
            setTimeout(function() {
                if (!_bridgeStarted && window.db) startFirebaseBridgeSync();
                if (!_quizzesSyncStarted && window.db) startQuizzesFirebaseSync();
            }, delay);
        });
    }

    // ── helper: إعادة بناء packages لكورس Dashboard من localStorage ─
    // يُستدعى من getEffectiveCoursePackages في data.js عند الحاجة
    global.getDashCoursePackages = function(courseIdStr) {
        var dashCourses = getDashCourses();
        var dc = dashCourses.find(function(c) { return String(c.id) === String(courseIdStr); });
        if (!dc) return null;
        return dashCourseToIraqi(dc).packages;
    };

    // ── Expose helpers للاستخدام الخارجي ────────────────────────────
    global.IRAQI_BRIDGE = {
        sync:            syncDashToIraqi,
        syncStudents:    syncStudents,
        getDashCourses:  getDashCourses,
        convertCourse:   dashCourseToIraqi,
        syncQuizzes:     startQuizzesFirebaseSync
    };

    // ── getQuizById: من الكاش العام فقط (بدون إجابات) ───────────────
    global.getQuizById = function(quizId) {
        if (!quizId) return null;
        try {
            var found = readQuizCache().find(function(q) { return String(q.id) === String(quizId); });
            return found ? stripAnswers(found) : null;
        } catch(e) { return null; }
    };

    // ── getAllQuizzes: كل الاختبارات المتاحة للطالب (بدون إجابات) ──────
    global.getAllQuizzes = function() {
        try { return readQuizCache().map(stripAnswers); } catch(e) { return []; }
    };

    // ── saveQuizAttempt: يحفظ نتيجة الطالب في alsaqr_quiz_attempts ─
    global.saveQuizAttempt = function(attempt) {
        // attempt = { userId, userName, quizId, courseId, lessonId, score, total,
        //              correct, wrong, percentage, passed, answers, submittedAt }
        try {
            var KEY = 'alsaqr_quiz_attempts';
            var attempts = JSON.parse(localStorage.getItem(KEY) || '[]');
            // أزل المحاولة السابقة لنفس المستخدم والاختبار
            var prev = attempts.findIndex(function(a) {
                return a.userId === attempt.userId && a.quizId === attempt.quizId;
            });
            if (prev > -1) attempts[prev] = attempt;
            else attempts.push(attempt);
            localStorage.setItem(KEY, JSON.stringify(attempts));

            // ── إذا اجتاز الطالب الاختبار → سجّل إتمام الدرس المرتبط ──
            if (attempt.passed && attempt.lessonId && attempt.courseId && attempt.userId) {
                if (typeof window.markLessonCompleted === 'function') {
                    window.markLessonCompleted(attempt.userId, attempt.courseId, attempt.lessonId);
                }
            }

            // ── أطلق حدث لتحديث واجهة الدرس إذا كان الطالب داخل صفحة الدرس ──
            window.dispatchEvent(new CustomEvent('quizAttemptSaved', {
                detail: {
                    quizId: attempt.quizId,
                    courseId: attempt.courseId,
                    lessonId: attempt.lessonId,
                    passed: attempt.passed,
                    percentage: attempt.percentage
                }
            }));

                    // If passed: mark the linked lesson as completed to unlock the next lesson
            if (attempt.passed && attempt.lessonId && attempt.courseId && attempt.userId) {
                if (typeof window.markLessonCompleted === 'function') {
                    window.markLessonCompleted(attempt.userId, attempt.courseId, attempt.lessonId);
                }
            }

            // Fire event so lesson page can refresh nav state
            try {
                window.dispatchEvent(new CustomEvent('quizAttemptSaved', {
                    detail: { quizId: attempt.quizId, courseId: attempt.courseId,
                               lessonId: attempt.lessonId, passed: attempt.passed, percentage: attempt.percentage }
                }));
            } catch(_) {}

            // مزامنة مع Firebase إذا متاح
            if (window.db) {
                var docId = (attempt.userId || 'anon') + '_' + attempt.quizId;
                window.db.collection('quiz_attempts').doc(docId).set(attempt, { merge: true })
                    .catch(function(e) { console.warn('[Bridge] quiz_attempt Firebase sync:', e); });
            }
        } catch(e) { console.warn('[Bridge] saveQuizAttempt error:', e); }
    };

    // ── getQuizAttempt: يجلب نتيجة طالب محدد لاختبار محدد ──────────
    global.getQuizAttempt = function(userId, quizId) {
        try {
            var attempts = JSON.parse(localStorage.getItem('alsaqr_quiz_attempts') || '[]');
            return attempts.find(function(a) {
                return a.userId === userId && String(a.quizId) === String(quizId);
            }) || null;
        } catch(e) { return null; }
    };

    // ── إعادة المزامنة عند وصول بيانات من Firebase ─────────────────────
    // يُطلق firebase-service.js هذا الحدث عند تحديث الكورسات من السحابة
    window.addEventListener('iraqiCoursesUpdated', function() {
        try {
            syncDashToIraqi();
            console.info('[Bridge] ✅ Re-synced lessons/contents after Firebase courses update');
        } catch(e) { console.warn('[Bridge] iraqiCoursesUpdated re-sync:', e.message); }
    });

    window.addEventListener('iraqiLessonsUpdated', function() {
        try {
            syncDashToIraqi();
            console.info('[Bridge] ✅ Re-synced after iraqiLessonsUpdated');
        } catch(e) { console.warn('[Bridge] iraqiLessonsUpdated re-sync:', e.message); }
    });

    // تشغيل المزامنة الأولية مع Firebase بعد تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // مزامنة أولية: تحويل الكورسات الموجودة محلياً إلى دروس
            syncDashToIraqi();
            syncStudents();
        });
    } else {
        syncDashToIraqi();
        syncStudents();
    }

    console.info('[منصة الدكتور محمد عبد الله] ✅ dashboard-bridge.js loaded — ' + getDashCourses().length + ' كورسات Dashboard متاحة');

})(window);
