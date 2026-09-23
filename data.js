// ═══════════════════════════════════════════════════════════════
// منصة الدكتور محمد عبد الله — عميد الفيزياء — Physics Platform — Data
// ═══════════════════════════════════════════════════════════════

const SITE_CONFIG = {
    name: 'منصة الدكتور محمد عبد الله',
    fullName: 'منصة الدكتور محمد عبد الله — عميد الفيزياء',
    subtitle: 'عميد الفيزياء',
    description: 'The premier educational platform for Physics with Dr. Mohamed Abdullah, Dean of Physics — clear explanations, interactive exercises, and comprehensive exams for all grade levels.',
    teacher: 'الدكتور محمد عبد الله',
    year: 2026,
};

// ── Brand mark (wave-M inside an orbit) — one source of truth for header / footer / auth ──
// variant: 'light' (for light & dark headers) | 'dark' (for deep-purple tiles). uid keeps gradient ids unique.
function physicsLogoMark(uid, cls, variant) {
    const u = 'pm' + (uid || Math.random().toString(36).slice(2, 6));
    const inner = variant === 'dark' ? `<defs>
<linearGradient id="${u}m" x1="10" y1="34" x2="38" y2="14" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D8C4FF"/></linearGradient>
<linearGradient id="${u}o" x1="3" y1="34" x2="45" y2="12" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#C9A8FF"/><stop offset="1" stop-color="#8C62DB"/></linearGradient>
</defs>
<circle cx="24" cy="24" r="21.4" stroke="url(#${u}o)" stroke-width="1.7" fill="none" opacity="1.0"/>
<path d="M10 34 C10 24 12 14 17 14 C20.5 14 21 30 24 30 C27 30 27.5 14 31 14 C36 14 38 24 38 34" stroke="url(#${u}m)" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<circle cx="39.9" cy="9.68" r="4.9" fill="#D9B6F5" opacity=".22"/>
<circle cx="39.9" cy="9.68" r="2.7" fill="#F0DBFF"/>` : `<defs>
<linearGradient id="${u}m" x1="10" y1="34" x2="38" y2="14" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6A3FBD"/><stop offset="1" stop-color="#A468DA"/></linearGradient>
<linearGradient id="${u}o" x1="3" y1="34" x2="45" y2="12" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#B07CE6"/><stop offset="1" stop-color="#6A3FBD"/></linearGradient>
</defs>
<circle cx="24" cy="24" r="21.4" stroke="url(#${u}o)" stroke-width="1.7" fill="none" opacity="0.95"/>
<path d="M10 34 C10 24 12 14 17 14 C20.5 14 21 30 24 30 C27 30 27.5 14 31 14 C36 14 38 24 38 34" stroke="url(#${u}m)" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<circle cx="39.9" cy="9.68" r="4.9" fill="#B47AE6" opacity=".22"/>
<circle cx="39.9" cy="9.68" r="2.7" fill="#B47AE6"/>`;
    return `<svg class="${cls || ''}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${inner}</svg>`;
}

const QUIZ_DATA = {
    title: 'Unit 1 Exam — Mechanics',
    questions: [
        {
            id: 'q1',
            text: 'What is the SI unit of force ?',
            options: ['Joule', 'Newton', 'Watt', 'Pascal'],
            correct: 1
        },
        {
            id: 'q2',
            text: 'A car accelerates uniformly from rest at 3 m/s². What is its speed after 4 s ?',
            options: ['7 m/s', '9 m/s', '12 m/s', '16 m/s'],
            correct: 2
        },
        {
            id: 'q3',
            text: 'Which law of motion is expressed by the equation F = ma ?',
            options: ['Newton\'s first law', 'Newton\'s second law', 'Newton\'s third law', 'Law of universal gravitation'],
            correct: 1
        },
        {
            id: 'q4',
            text: 'A resistor of 4 Ω is connected to a 12 V source. What is the current through it ?',
            options: ['3 A', '8 A', '16 A', '48 A'],
            correct: 0
        },
        {
            id: 'q5',
            text: 'Which of the following quantities is a vector ?',
            options: ['Speed', 'Mass', 'Velocity', 'Energy'],
            correct: 2
        }
    ]
};

const TESTIMONIALS_DATA = [
    {
        name: 'Ahmed Mohamed',
        initials: 'AM',
        text: 'The explanations are clear and easy to understand. The exams help me truly gauge my level. I got the highest score in Physics thanks to this platform.',
        rating: 5,
        grade: '3rd Year Secondary'
    },
    {
        name: 'Fatma Ali',
        initials: 'FA',
        text: 'This platform completely changed my view of Physics. I used to hate the subject, and now it\'s one of my favourites!',
        rating: 5,
        grade: '1st Year Secondary'
    },
    {
        name: 'Omar Hassan',
        initials: 'OH',
        text: 'The teacher\'s approach is excellent — step-by-step explanations. The summaries and PDF notes are very helpful during revision.',
        rating: 5,
        grade: '2nd Year Secondary'
    },
    {
        name: 'Nour Eldin',
        initials: 'NE',
        text: 'The platform is easy to use and the courses are very well organised. I recommend it to every student.',
        rating: 4,
        grade: '3rd Year Preparatory'
    },
    {
        name: 'Yasmine Khaled',
        initials: 'YK',
        text: 'The best physics platform I have used. The interactive exams are outstanding and prepare me well for actual exams.',
        rating: 5,
        grade: '3rd Year Secondary'
    },
    {
        name: 'Karim Saeed',
        initials: 'KS',
        text: 'The explanations are clear and the exercises are progressive. I noticed a significant improvement in my level in just one month.',
        rating: 5,
        grade: '1st Year Secondary'
    }
];

const FEATURES_DATA = [
    {
        icon: '💡',
        title: 'Conceptual & Simplified Explanations',
        description: 'Step-by-step explanations from the fundamentals, clarifying physical concepts with practical examples — no blind memorisation.',
        colorClass: 'green'
    },
    {
        icon: '📚',
        title: 'Full Coverage of External Textbooks',
        description: 'Comprehensive coverage of external textbook exercises and the most challenging questions from past ministry and exam papers.',
        colorClass: 'yellow'
    },
    {
        icon: '📝',
        title: 'Interactive Electronic Exams',
        description: 'Simulated end-of-year exams with instant grading and a model answer that explains every solution step in detail.',
        colorClass: 'blue'
    },
    {
        icon: '📄',
        title: 'Exclusive PDF Notes & Summaries',
        description: 'Colour-coded notes summarising all laws and formulas, plus mind maps for every lesson — ready to download and print.',
        colorClass: 'green'
    },
    {
        icon: '📊',
        title: 'Performance Reports & Continuous Tracking',
        description: 'Detailed monitoring of each student\'s progress and exam scores to ensure the highest levels of academic excellence.',
        colorClass: 'yellow'
    },
    {
        icon: '💬',
        title: 'Educational Support & Q&A',
        description: 'A dedicated support team available around the clock to answer all student questions and solve difficult problems.',
        colorClass: 'blue'
    }
];

const STAGES_DATA = [
    {
        id: 'stage-3sec',
        title: '3rd Year Secondary',
        subtitle: 'Physics — Thanaweya Amma',
        gradeTag: 'تالتة ثانوي',
        icon: '🎯',
        description: 'Complete curriculum with exam night revisions, ministry question banks, and booklet model exams.',
        tags: ['Current Electricity', 'Magnetism', 'Modern Physics', 'Semiconductors']
    },
    {
        id: 'stage-2sec',
        title: '2nd Year Secondary',
        subtitle: 'Scientific & Literary',
        gradeTag: 'تانية ثانوي',
        icon: '📊',
        description: 'Detailed explanation of mechanics, heat and thermodynamics, waves, and optics.',
        tags: ['Mechanics', 'Thermodynamics', 'Waves', 'Optics']
    },
    {
        id: 'stage-1sec',
        title: '1st Year Secondary',
        subtitle: 'General & Al-Azhar',
        gradeTag: 'أولى ثانوي',
        icon: '⚛️',
        description: 'Solid foundation for secondary school physics in measurement, motion, forces, and energy.',
        tags: ['Measurement', 'Kinematics', 'Dynamics', 'Work & Energy']
    },
    {
        id: 'stage-1prep',
        title: '1st Year Preparatory',
        subtitle: 'Preparatory Stage',
        gradeTag: 'أولى إعدادي',
        icon: '💡',
        description: 'The start of excellence in preparatory stage — matter, motion, and the first laws of physics.',
        tags: ['Matter & Density', 'Motion', 'Forces', 'Energy']
    },
    {
        id: 'stage-2prep',
        title: '2nd Year Preparatory',
        subtitle: 'Preparatory Stage',
        gradeTag: 'تانية إعدادي',
        icon: '📊',
        description: 'Strong foundation in heat, light, sound, and simple machines.',
        tags: ['Heat', 'Light', 'Sound', 'Simple Machines']
    },
    {
        id: 'stage-3prep',
        title: '3rd Year Preparatory',
        subtitle: 'Preparatory Certificate',
        gradeTag: 'تالتة إعدادي',
        icon: '🔭',
        description: 'In-depth explanation of preparatory curriculum ensuring full marks and qualifying for secondary.',
        tags: ['Electricity', 'Magnetism', 'Light & Lenses', 'Exercises']
    },
    {
        id: 'stage-free',
        title: 'Free Foundation Courses',
        subtitle: 'Available to Everyone 🎁',
        gradeTag: 'مجاني',
        icon: '🎁',
        description: '100% free introductory & foundation course to experience the teaching method and master physics essentials.',
        tags: ['Units & Measurement', 'Motion Basics', 'Forces & Energy', 'Platform Gift']
    }
];

const FAQ_DATA = [
    {
        q: 'How can I register and start watching courses?',
        a: 'Click the "Create Account" button at the top of the page and enter your details (name, phone number, grade level, and a 6-character password). After registration you can immediately watch the free courses or activate your grade\'s course with an activation code.'
    },
    {
        q: 'What is the activation code and how do I get it?',
        a: 'The activation code is a unique code used to unlock a paid course on the platform for life. You can obtain it from Dr. Mohamed Abdullah\'s centre or by contacting the technical support team directly via WhatsApp.'
    },
    {
        q: 'Are the videos and notes available throughout the academic term?',
        a: 'Yes! Once you activate a course, all videos, interactive quizzes, and PDF notes remain available to you 24 hours a day for the entire academic term — you can watch and review them as many times as you like.'
    },
    {
        q: 'Does the platform include electronic exams with instant grading?',
        a: 'Absolutely! After every unit and lesson there is an interactive electronic exam that simulates the latest Ministry of Education exam specifications, with instant grading and a detailed model answer showing every correct step.'
    },
    {
        q: 'Does the platform work on mobile, tablet, and desktop?',
        a: 'Yes. Dr. Mohamed Abdullah\'s platform is designed to run smoothly and responsively on all devices: smartphones, tablets, laptops, and desktop computers.'
    },
    {
        q: 'How can I contact Dr. Mohamed Abdullah to ask questions and follow up on assignments?',
        a: 'There is a dedicated educational team along with WhatsApp and Telegram groups for enrolled students to answer all questions, solve difficult problems, and follow up on assignments and periodic exams.'
    }
];

const STATS_DATA = [
    { icon: '👨‍🎓', number: 5000, suffix: '+', label: 'Successful Students' },
    { icon: '📚', number: 150, suffix: '+', label: 'Lessons & Lectures' },
    { icon: '⏱️', number: 120, suffix: '+', label: 'Hours of Interactive Content' },
    { icon: '⭐', number: 99, suffix: '%', label: 'Success & Excellence Rate' },
];

const CURRENT_USER = {
    name: 'Ahmed Mohamed',
    initials: 'AM',
    email: 'student@example.com',
    phone: '01012345678',
    grade: '1st Year Secondary',
    enrolledCourses: ['math-grade1-term1', 'math-grade2-term1'],
    completedLessons: 5,
    totalLessons: 54,
    avgScore: 87,
};

const ACTIVITY_DATA = [
    { icon: '✅', text: 'Completed lesson "Laws of Motion"', time: '2 hours ago', color: 'green' },
    { icon: '📝', text: 'Scored 90% on Kinematics Quiz', time: '5 hours ago', color: 'yellow' },
    { icon: '🎥', text: 'Watched lesson "Electric Fields"', time: 'Yesterday', color: 'blue' },
    { icon: '📄', text: 'Downloaded Unit 1 Summary PDF', time: '2 days ago', color: 'red' },
    { icon: '🏆', text: 'Successfully finished Unit 1', time: '3 days ago', color: 'green' },
];

// ═══════════════════════════════════════════════════════════════
// ADMIN CONFIG
// ═══════════════════════════════════════════════════════════════
const ADMIN_EMAIL = 'admin@iraqi.com';
// (حُذفت كلمة مرور الأدمن المكتوبة في الكود — الأدمن حساب حقيقي في Firebase Authentication + مستند admins/{uid})

// ═══════════════════════════════════════════════════════════════
// LESSONS DATABASE — localStorage CRUD
// ═══════════════════════════════════════════════════════════════
const LESSONS_KEY = 'iraqiplatform_lessons';
const CONTENTS_KEY = 'iraqiplatform_contents';

// ── Lessons ──────────────────────────────────────────────────

function getLessons() {
    try { return JSON.parse(localStorage.getItem(LESSONS_KEY)) || []; }
    catch (e) { return []; }
}

function saveLessons(lessons) {
    localStorage.setItem(LESSONS_KEY, JSON.stringify(lessons));
    if (typeof window.FirebaseService !== 'undefined' && window.FirebaseService.lessons) {
        try { (lessons || []).forEach(l => window.FirebaseService.lessons.saveLesson(l)); } catch (e) { }
    }
}

function getCourseLessons(courseId) {
    return getLessons()
        .filter(l => l.courseId === courseId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function createLesson(courseId, data) {
    const lessons = getLessons();
    const courseLessons = getCourseLessons(courseId);
    const newLesson = {
        lessonId: 'lesson_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        courseId: courseId,
        title: data.title || 'New Lesson',
        description: data.description || '',
        order: data.order || (courseLessons.length + 1),
        status: data.status || 'published',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    lessons.push(newLesson);
    saveLessons(lessons);
    return newLesson;
}

function updateLesson(lessonId, data) {
    const lessons = getLessons();
    const idx = lessons.findIndex(l => l.lessonId === lessonId);
    if (idx === -1) return null;
    lessons[idx] = {
        ...lessons[idx],
        ...data,
        lessonId: lessonId, // لا نغيّر الـ ID
        updatedAt: new Date().toISOString(),
    };
    saveLessons(lessons);
    return lessons[idx];
}

function deleteLesson(lessonId) {
    // حذف الدرس وجميع محتوياته
    const lessons = getLessons().filter(l => l.lessonId !== lessonId);
    saveLessons(lessons);
    const contents = getContents().filter(c => c.lessonId !== lessonId);
    saveContents(contents);
}

function reorderLessons(courseId, orderedIds) {
    const lessons = getLessons();
    orderedIds.forEach((id, index) => {
        const idx = lessons.findIndex(l => l.lessonId === id);
        if (idx !== -1) {
            lessons[idx].order = index + 1;
            lessons[idx].updatedAt = new Date().toISOString();
        }
    });
    saveLessons(lessons);
}

// ── Contents ─────────────────────────────────────────────────

function getContents() {
    try { return JSON.parse(localStorage.getItem(CONTENTS_KEY)) || []; }
    catch (e) { return []; }
}

function saveContents(contents) {
    localStorage.setItem(CONTENTS_KEY, JSON.stringify(contents));
    if (typeof window.FirebaseService !== 'undefined' && window.FirebaseService.lessons) {
        try { (contents || []).forEach(c => window.FirebaseService.lessons.saveContent(c)); } catch (e) { }
    }
}

function getLessonContents(lessonId) {
    return getContents()
        .filter(c => c.lessonId === lessonId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function createContent(lessonId, data) {
    const contents = getContents();
    const lessonContents = getLessonContents(lessonId);
    const newContent = {
        contentId: 'content_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        lessonId: lessonId,
        type: data.type || 'video',
        title: data.title || 'New Content',
        content: data.content || '',
        duration: data.duration || '',
        order: data.order || (lessonContents.length + 1),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    contents.push(newContent);
    saveContents(contents);
    return newContent;
}

function updateContent(contentId, data) {
    const contents = getContents();
    const idx = contents.findIndex(c => c.contentId === contentId);
    if (idx === -1) return null;
    contents[idx] = {
        ...contents[idx],
        ...data,
        contentId: contentId,
        updatedAt: new Date().toISOString(),
    };
    saveContents(contents);
    return contents[idx];
}

function deleteContent(contentId) {
    const contents = getContents().filter(c => c.contentId !== contentId);
    saveContents(contents);
}

function reorderContents(lessonId, orderedIds) {
    const contents = getContents();
    orderedIds.forEach((id, index) => {
        const idx = contents.findIndex(c => c.contentId === id);
        if (idx !== -1) {
            contents[idx].order = index + 1;
            contents[idx].updatedAt = new Date().toISOString();
        }
    });
    saveContents(contents);
}

// ── Content Type Config ───────────────────────────────────────
const CONTENT_TYPES = [
    { value: 'video', label: 'Video', icon: '🎥', badge: 'badge-primary' },
    { value: 'pdf', label: 'PDF Document', icon: '📄', badge: 'badge-danger' },
    { value: 'quiz', label: 'Quiz', icon: '📝', badge: 'badge-accent' },
    { value: 'text', label: 'Text / Notes', icon: '📋', badge: 'badge-success' },
];

function getContentTypeConfig(type) {
    return CONTENT_TYPES.find(t => t.value === type) || CONTENT_TYPES[0];
}

// ── Bridge Helper for Student View ────────────────────────────
function getEffectiveCoursePackages(course, isEnrolled) {
    if (!course) return [];

    function normalizeVideoUrl(url) {
        return String(url || '')
            .trim()
            .replace(/[?&]autoplay=false\b/g, '')
            .replace(/\/$/, '')
            .toLowerCase();
    }

    function uniqueSegments(segs) {
        var seen = {};
        return (Array.isArray(segs) ? segs : []).filter(function (s) {
            if (!s) return false;
            var bunnyId = String(s.bunnyVideoId || '').trim();
            var videoUrl = normalizeVideoUrl(s.videoUrl || s.content || '');
            if (!bunnyId && !videoUrl) return false;
            var key = bunnyId ? ('b:' + bunnyId) : ('u:' + videoUrl);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    // ── Check Enrollment Status ────────────────────────────────
    var enrolled = isEnrolled;
    if (enrolled === undefined) {
        try {
            var session = (window.AuthService && window.AuthService.getCurrentUser()) || null;   // من الحساب الموثَّق، لا من كاش المتصفح
            if (session && Array.isArray(session.enrolledCourses)) {
                enrolled = session.enrolledCourses.some(function (id) {
                    return String(id) === String(course.id);
                });
            }
        } catch (e) { enrolled = false; }
    }
    var courseUnlocked = !!course.isFree || !!enrolled;

    // ── 1. If course has direct lessons (Firebase / Dashboard) ──
    if (Array.isArray(course.lessons) && course.lessons.length > 0) {
        var pkgs = course.lessons.map(function (dl, idx) {
            var lessonId = String(dl.id || ('l_' + course.id + '_' + idx));
            var segs = Array.isArray(dl.segments) && dl.segments.length > 0 ? dl.segments : [];
            var validSegs = uniqueSegments(segs);

            var rawVideo = dl.videoUrl || '';
            if (!rawVideo && dl.bunnyVideoId) {
                rawVideo = 'https://iframe.mediadelivery.net/embed/691851/' + dl.bunnyVideoId + '?autoplay=false';
            }
            if (rawVideo && validSegs.length === 1) {
                var onlySegUrl = validSegs[0].bunnyVideoId
                    ? ('https://iframe.mediadelivery.net/embed/691851/' + validSegs[0].bunnyVideoId)
                    : (validSegs[0].videoUrl || '');
                if (normalizeVideoUrl(onlySegUrl) === normalizeVideoUrl(rawVideo)) rawVideo = onlySegUrl;
            }
            if (!rawVideo && validSegs.length > 0) {
                var firstS = validSegs[0];
                rawVideo = firstS.bunnyVideoId
                    ? ('https://iframe.mediadelivery.net/embed/691851/' + firstS.bunnyVideoId + '?autoplay=false')
                    : (firstS.videoUrl || '');
            }

            var hasVideo = Boolean(rawVideo || validSegs.length > 0);
            var hasPdf = Boolean(dl.pdfUrl && dl.pdfUrl.trim() !== '');
            var hasQuiz = Boolean(dl.quizId != null && dl.quizId !== '');
            var contentType = hasVideo ? 'video' : (hasQuiz ? 'quiz' : (hasPdf ? 'pdf' : 'video'));

            var pkgLessons = [];

            // Multiple video segments
            if (validSegs.length > 1) {
                validSegs.forEach(function (seg, si) {
                    var sUrl = seg.bunnyVideoId
                        ? ('https://iframe.mediadelivery.net/embed/691851/' + seg.bunnyVideoId + '?autoplay=false')
                        : (seg.videoUrl || '');
                    pkgLessons.push({
                        id: String(seg.id || (lessonId + '_seg_' + si)),
                        lessonId: lessonId,
                        title: seg.title || (dl.title + ' — Part ' + (si + 1)),
                        description: dl.description || '',
                        type: 'video',
                        duration: seg.duration || dl.duration || '—',
                        content: sUrl,
                        videoUrl: sUrl,
                        bunnyVideoId: seg.bunnyVideoId || '',
                        segments: validSegs,
                        pdfUrl: dl.pdfUrl || '',
                        pdfName: dl.pdfName || '',
                        quizId: dl.quizId || null,
                        isCompleted: false,
                        isLocked: !courseUnlocked && (idx > 0 || si > 0)
                    });
                });
            } else {
                // Single segment or standard lesson
                var singleTitle = dl.title || (validSegs[0] && validSegs[0].title) || ('Lesson ' + (idx + 1));
                var singleDuration = (validSegs[0] && validSegs[0].duration) || dl.duration || '—';
                pkgLessons.push({
                    id: lessonId,
                    lessonId: lessonId,
                    title: singleTitle,
                    description: dl.description || '',
                    type: contentType,
                    duration: singleDuration,
                    content: rawVideo || dl.pdfUrl || String(dl.quizId || ''),
                    videoUrl: rawVideo,
                    bunnyVideoId: dl.bunnyVideoId || (validSegs[0] ? validSegs[0].bunnyVideoId : ''),
                    segments: validSegs,
                    pdfUrl: dl.pdfUrl || '',
                    pdfName: dl.pdfName || '',
                    quizId: dl.quizId || null,
                    isCompleted: false,
                    isLocked: !courseUnlocked && idx > 0
                });
            }

            return {
                id: 'pkg_' + lessonId,
                title: dl.title || ('Lesson ' + (idx + 1)),
                description: dl.description || '',
                lessons: pkgLessons
            };
        });

        if (pkgs.length > 0) return pkgs;
    }

    // ── 2. Bridge dashboard courses (getDashCoursePackages) ──
    if (typeof window.getDashCoursePackages === 'function') {
        var dashPkgs = window.getDashCoursePackages(course.id);
        if (dashPkgs && dashPkgs.length > 0) {
            return dashPkgs.map(function (pkg, pIdx) {
                return Object.assign({}, pkg, {
                    lessons: (pkg.lessons || []).map(function (l, idx) {
                        return Object.assign({}, l, {
                            isLocked: !courseUnlocked && (pIdx > 0 || idx > 0)
                        });
                    })
                });
            });
        }
    }

    // ── 3. Packages embedded in course ──
    if (Array.isArray(course.packages) && course.packages.length > 0) {
        return course.packages.map(function (pkg, pIdx) {
            return Object.assign({}, pkg, {
                lessons: (pkg.lessons || []).map(function (l, idx) {
                    return Object.assign({}, l, {
                        isLocked: l.isLocked || (!courseUnlocked && (pIdx > 0 || idx > 0))
                    });
                })
            });
        });
    }

    // ── 4. Dynamic local storage lessons (fallback) ──
    var dynamicLessons = typeof getCourseLessons === 'function' ? getCourseLessons(course.id) : [];
    if (dynamicLessons && dynamicLessons.length > 0) {
        return dynamicLessons.map(function (dl, idx) {
            var contents = typeof getLessonContents === 'function' ? getLessonContents(dl.lessonId) : [];
            return {
                id: dl.lessonId,
                title: dl.title || ('Lesson ' + (idx + 1)),
                description: dl.description || '',
                lessons: contents.length > 0
                    ? contents.map(function (c, cIdx) {
                        return {
                            id: c.contentId,
                            lessonId: dl.lessonId,
                            title: c.title || ('Content ' + (cIdx + 1)),
                            type: c.type || 'video',
                            duration: c.duration || '—',
                            content: c.content || '',
                            videoUrl: c.type === 'video' ? c.content : '',
                            pdfUrl: c.type === 'pdf' ? c.content : '',
                            quizId: c.type === 'quiz' ? c.content : null,
                            isCompleted: false,
                            isLocked: !courseUnlocked && (idx > 0 || cIdx > 0)
                        };
                    })
                    : [{
                        id: dl.lessonId,
                        lessonId: dl.lessonId,
                        title: dl.title || 'Lesson Content',
                        type: 'video',
                        duration: '—',
                        content: '',
                        isCompleted: false,
                        isLocked: !courseUnlocked && idx > 0
                    }]
            };
        });
    }

    return [];
}


// ── getAllCourses: fallback إذا لم يُحمَّل dashboard-bridge.js ──
if (typeof window !== 'undefined') {
    window.SITE_CONFIG = SITE_CONFIG;
    // ⚠️ إصلاح جذري: COURSES_DATA غير معرّف في هذا المشروع (الكورسات تأتي من Firestore عبر dashboard-bridge).
    // السطر القديم `window.COURSES_DATA = COURSES_DATA` كان يرمي ReferenceError فيتوقف تنفيذ data.js هنا،
    // ولا تُعرَّف أبداً دوال نظام التقدّم (markLessonCompleted / getLessonAccessStatus / enrichLessonsWithProgress)
    // ولذلك لم يكن قفل الدرس التالي بعد الاختبار يعمل من الأساس.
    window.COURSES_DATA = (typeof COURSES_DATA !== 'undefined') ? COURSES_DATA : [];
    window.STAGES_DATA = STAGES_DATA;
    window.FAQ_DATA = typeof FAQ_DATA !== 'undefined' ? FAQ_DATA : [];
    window.FEATURES_DATA = typeof FEATURES_DATA !== 'undefined' ? FEATURES_DATA : [];
    if (typeof window.getAllCourses !== 'function') {
        window.getAllCourses = function () { return window.COURSES_DATA; };
    }
}

// ================================================================
// Lesson Progress & Quiz-Gate System
// ================================================================
(function () {
    var PROGRESS_KEY = 'iraqi_lesson_progress';

    function getProgress() {
        try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch(e) { return {}; }
    }

    window.isLessonCompleted = function(userId, courseId, lessonId) {
        if (!userId || !courseId || !lessonId) return false;
        return !!getProgress()[userId + '_' + courseId + '_' + lessonId];
    };

    window.markLessonCompleted = function(userId, courseId, lessonId) {
        if (!userId || !courseId || !lessonId) return;
        var p = getProgress();
        var k = userId + '_' + courseId + '_' + lessonId;
        if (p[k]) return;
        p[k] = true;
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
        if (window.db) {
            window.db.collection('lesson_progress').doc(k).set(
                { userId: userId, courseId: courseId, lessonId: lessonId, completedAt: new Date().toISOString() },
                { merge: true }
            ).catch(function() {});
        }
        try { window.dispatchEvent(new CustomEvent('lessonCompleted', { detail: { userId: userId, courseId: courseId, lessonId: lessonId } })); } catch(_) {}
    };

    // Returns { canAccess:bool, reason?:string, quizId?:string, passRate?:number, achieved?:number }
    window.getLessonAccessStatus = function(userId, courseId, allLessons, targetLesson) {
        if (!allLessons || !allLessons.length || !targetLesson) return { canAccess: true };
        var idx = allLessons.findIndex(function(l) { return String(l.id) === String(targetLesson.id); });
        if (idx <= 0) return { canAccess: true };
        var prev = allLessons[idx - 1];
        if (!prev || !prev.quizId) return { canAccess: true };
        var quizId  = prev.quizId;
        var quiz    = (typeof window.getQuizById === 'function') ? window.getQuizById(quizId) : null;
        var passRate = quiz ? (quiz.averageGrade || quiz.passingGrade || 50) : 50;
        var attempt  = (typeof window.getQuizAttempt === 'function' && userId)
            ? window.getQuizAttempt(userId, quizId) : null;
        if (!attempt) return { canAccess: false, reason: 'quiz_required', quizId: quizId, passRate: passRate, prevLessonTitle: prev.title };
        var pct = attempt.percentage !== undefined ? attempt.percentage
            : (attempt.total > 0 ? Math.round(attempt.score / attempt.total * 100) : 0);
        if (pct < passRate) return { canAccess: false, reason: 'quiz_failed', quizId: quizId, passRate: passRate, achieved: pct, prevLessonTitle: prev.title };
        return { canAccess: true, quizPassed: true };
    };

    window.enrichLessonsWithProgress = function(userId, courseId, lessons) {
        if (!lessons || !lessons.length) return lessons;
        return lessons.map(function(lesson, idx) {
            var completed = userId ? window.isLessonCompleted(userId, courseId, lesson.id) : false;
            var access    = window.getLessonAccessStatus(userId, courseId, lessons, lesson);
            return Object.assign({}, lesson, {
                isCompleted: completed,
                isLocked: !access.canAccess,
                _accessStatus: access
            });
        });
    };

    console.info('[Progress] Lesson progress & quiz-gate system ready.');
})();

// ═══════════════════════════════════════════════════════════════
// نظام تتبع تقدم الطالب وربط الاختبارات بفتح الدروس
// Lesson Progress & Quiz-Gate System
// ═══════════════════════════════════════════════════════════════
(function () {
    var PROGRESS_KEY = 'iraqi_lesson_progress'; // { userId_courseId_lessonId: true }

    // ── جلب تقدم الطالب ─────────────────────────────────────────
    function getLessonProgress() {
        try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); }
        catch (e) { return {}; }
    }

    // ── هل أتم الطالب الدرس؟ ────────────────────────────────────
    window.isLessonCompleted = function (userId, courseId, lessonId) {
        if (!userId || !courseId || !lessonId) return false;
        var key = userId + '_' + courseId + '_' + lessonId;
        return !!getLessonProgress()[key];
    };

    // ── تسجيل إتمام الدرس ───────────────────────────────────────
    window.markLessonCompleted = function (userId, courseId, lessonId) {
        if (!userId || !courseId || !lessonId) return;
        var progress = getLessonProgress();
        var key = userId + '_' + courseId + '_' + lessonId;
        if (progress[key]) return; // already marked
        progress[key] = true;
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
        // مزامنة مع Firebase إذا متاح
        if (window.db) {
            window.db.collection('lesson_progress').doc(key).set({
                userId: userId, courseId: courseId, lessonId: lessonId,
                completedAt: new Date().toISOString()
            }, { merge: true }).catch(function () {});
        }
        // أطلق حدث عشان الواجهة تتحدث
        window.dispatchEvent(new CustomEvent('lessonCompleted', {
            detail: { userId: userId, courseId: courseId, lessonId: lessonId }
        }));
    };

    // ── هل يحق للطالب الوصول للدرس؟ (مع منطق الاختبار) ─────────
    // يعود بـ { canAccess: bool, reason: string, quizId: string|null }
    window.getLessonAccessStatus = function (userId, courseId, allLessons, targetLesson) {
        if (!allLessons || !allLessons.length || !targetLesson) return { canAccess: true };
        var idx = allLessons.findIndex(function (l) {
            return String(l.id) === String(targetLesson.id);
        });
        if (idx <= 0) return { canAccess: true }; // أول درس دايمًا متاح

        // فحص الدرس السابق
        var prevLesson = allLessons[idx - 1];
        if (!prevLesson) return { canAccess: true };

        // إذا الدرس السابق مش مرتبط باختبار → الوصول مفتوح (ولكن بعد الإتمام)
        if (!prevLesson.quizId) {
            // إذا في tracking للإتمام — نتحقق، وإلا نسمح
            var completed = userId ? window.isLessonCompleted(userId, courseId, prevLesson.id) : false;
            // للدروس بدون اختبار → السماح بالوصول تلقائيًا (لا نقفل)
            return { canAccess: true };
        }

        // الدرس السابق مرتبط باختبار → نتحقق من النتيجة
        var quizId = prevLesson.quizId;
        if (window.QuizService && userId) {
            // النتيجة المحفوظة في قاعدة البيانات هي التي تقرر فتح/قفل الدرس التالي
            var g = window.QuizService.evaluateGate(userId, quizId);
            if (!g.locked) return { canAccess: true, quizPassed: g.state === 'passed' };
            return {
                canAccess: false,
                reason: g.state === 'failed' ? 'quiz_failed' : 'quiz_required',
                quizId: quizId, passRate: g.passRate, achieved: g.achieved, prevLessonTitle: prevLesson.title
            };
        }
        var quiz = (typeof window.getQuizById === 'function') ? window.getQuizById(quizId) : null;
        var passRate = quiz ? (quiz.averageGrade || quiz.passingGrade || 50) : 50;
        var attempt = (typeof window.getQuizAttempt === 'function' && userId)
            ? window.getQuizAttempt(userId, quizId) : null;

        if (!attempt) {
            return {
                canAccess: false,
                reason: 'quiz_required',
                quizId: quizId,
                passRate: passRate,
                prevLessonTitle: prevLesson.title
            };
        }

        var pct = attempt.percentage !== undefined ? attempt.percentage
            : (attempt.total > 0 ? Math.round(attempt.score / attempt.total * 100) : 0);

        if (pct < passRate) {
            return {
                canAccess: false,
                reason: 'quiz_failed',
                quizId: quizId,
                passRate: passRate,
                achieved: pct,
                prevLessonTitle: prevLesson.title
            };
        }

        return { canAccess: true, quizPassed: true };
    };

    // ── تحديث isCompleted و isLocked على قائمة الدروس ────────────
    window.enrichLessonsWithProgress = function (userId, courseId, lessons) {
        if (!userId || !courseId || !lessons || !lessons.length) return lessons;
        return lessons.map(function (lesson, idx) {
            var completed = window.isLessonCompleted(userId, courseId, lesson.id);
            var access = window.getLessonAccessStatus(userId, courseId, lessons, lesson);
            return Object.assign({}, lesson, {
                isCompleted: completed,
                isLocked: lesson.isLocked || !access.canAccess,
                _accessStatus: access
            });
        });
    };

    console.info('[Progress System] ✅ Lesson progress & quiz-gate system loaded');
})();
