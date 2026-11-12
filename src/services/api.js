/**
    * Mock API layer.
    *
    * The UI only talks to the functions exported here. Each one returns a Promise
    * with realistic latency and error shapes ({ message, field? }), so swapping in
    * a real backend means replacing the bodies of these functions – nothing else.
    */
import { STAGES, VOCABULARY, HANDBOOK, DEMO_PROGRESS } from '../data/content.js';

const LATENCY = 450;
const wait = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));

const USERS_KEY = 'muonglab.users';
const SESSION_KEY = 'muonglab.session';
const PENDING_KEY = 'muonglab.pending';

const DEMO_USER = { name: 'Minh Anh', email: 'demo@muonglab.vn', password: 'muonglab123', verified: true };

/** The demo OTP. A real backend sends this by email. */
export const DEMO_OTP = '123456';

function safeGet(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}
function safeSet(key, value) {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* storage unavailable – session simply won't persist */
    }
}

function users() {
    const list = safeGet(USERS_KEY, []);
    return list.some((u) => u.email === DEMO_USER.email) ? list : [DEMO_USER, ...list];
}

class ApiError extends Error {
    constructor(message, field) {
        super(message);
        this.field = field;
    }
}

const publicUser = ({ name, email }) => ({ name, email });

/* ───────────── Auth ───────────── */
export const auth = {
    currentSession() {
        return safeGet(SESSION_KEY, null);
    },

    async login({ email, password, remember }) {
        await wait();
        const user = users().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!user || user.password !== password) {
            throw new ApiError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
        }
        if (!user.verified) {
            safeSet(PENDING_KEY, { email: user.email, purpose: 'verify' });
            throw new ApiError('Tài khoản chưa được xác thực.', 'unverified');
        }
        const session = publicUser(user);
        if (remember) safeSet(SESSION_KEY, session);
        return session;
    },

    async register({ name, email, password }) {
        await wait();
        const list = safeGet(USERS_KEY, []);
        if (users().some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
            throw new ApiError('Email này đã được đăng ký.', 'email');
        }
        list.push({ name: name.trim(), email: email.trim(), password, verified: false });
        safeSet(USERS_KEY, list);
        safeSet(PENDING_KEY, { email: email.trim(), purpose: 'verify' });
        return { email: email.trim() };
    },

    async requestReset({ email }) {
        await wait();
        const exists = users().some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!exists) throw new ApiError('Không tìm thấy tài khoản với email này.', 'email');
        safeSet(PENDING_KEY, { email: email.trim(), purpose: 'reset' });
        return { email: email.trim() };
    },

    pending() {
        return safeGet(PENDING_KEY, null);
    },

    async resendOtp() {
        await wait(300);
        return true;
    },

    async verifyOtp({ code }) {
        await wait();
        const pending = safeGet(PENDING_KEY, null);
        if (!pending) throw new ApiError('Phiên xác thực đã hết hạn. Vui lòng thực hiện lại.');
        if (code !== DEMO_OTP) throw new ApiError('Mã xác thực không đúng.', 'code');
        if (pending.purpose === 'verify') {
            const list = safeGet(USERS_KEY, []).map((u) => (u.email === pending.email ? { ...u, verified: true } : u));
            safeSet(USERS_KEY, list);
            safeSet(PENDING_KEY, null);
        } else {
            safeSet(PENDING_KEY, { ...pending, verified: true });
        }
        return pending;
    },

    async resetPassword({ password }) {
        await wait();
        const pending = safeGet(PENDING_KEY, null);
        if (!pending?.verified) throw new ApiError('Phiên đặt lại mật khẩu đã hết hạn.');
        if (pending.email === DEMO_USER.email) {
            // demo account is immutable – accept but don't persist
        } else {
            const list = safeGet(USERS_KEY, []).map((u) => (u.email === pending.email ? { ...u, password } : u));
            safeSet(USERS_KEY, list);
        }
        safeSet(PENDING_KEY, null);
        return true;
    },

    persist(session) {
        safeSet(SESSION_KEY, session);
    },

    logout() {
        safeSet(SESSION_KEY, null);
    },
};

/* ───────────── Learning ───────────── */
function decorateStages(progress) {
    const done = new Set(progress.completedLessonIds);
    return STAGES.map((s) => {
        const completed = s.lessons.filter((l) => done.has(l.id)).length;
        const lessons = s.lessons.map((l) => ({
            ...l,
            status: done.has(l.id) ? 'done' : l.id === progress.currentLessonId ? 'current' : 'todo',
        }));
        const percent = Math.round((completed / s.lessons.length) * 100);
        return {
            ...s,
            lessons,
            completed,
            total: s.lessons.length,
            percent,
            status: percent === 100 ? 'done' : completed > 0 || lessons.some((l) => l.status === 'current') ? 'active' : 'locked',
        };
    });
}

export const learning = {
    async overview() {
        await wait();
        const stages = decorateStages(DEMO_PROGRESS);
        const total = stages.reduce((n, s) => n + s.total, 0);
        const completed = stages.reduce((n, s) => n + s.completed, 0);
        const currentStage = stages.find((s) => s.lessons.some((l) => l.id === DEMO_PROGRESS.currentLessonId));
        const currentLesson = currentStage?.lessons.find((l) => l.id === DEMO_PROGRESS.currentLessonId);
        return {
            stages,
            total,
            completed,
            percent: Math.round((completed / total) * 100),
            current: currentLesson ? { stage: currentStage, lesson: currentLesson } : null,
            streakDays: DEMO_PROGRESS.streakDays,
            averageScore: DEMO_PROGRESS.averageScore,
            activity: DEMO_PROGRESS.activity,
            badges: DEMO_PROGRESS.badges,
        };
    },

    async stage(id) {
        await wait(300);
        const stage = decorateStages(DEMO_PROGRESS).find((s) => s.id === Number(id));
        if (!stage) throw new ApiError('Không tìm thấy chặng học.');
        return stage;
    },

    async vocabulary() {
        await wait(250);
        return VOCABULARY;
    },

    async searchVocabulary(q) {
        await wait(220);
        const norm = (s) => s.normalize('NFC').toLowerCase().trim();
        const query = norm(q);
        if (!query) return VOCABULARY;
        return VOCABULARY.filter((v) => norm(v.word).includes(query) || norm(v.meaning).includes(query));
    },

    async handbook() {
        await wait(300);
        return HANDBOOK;
    },
};
