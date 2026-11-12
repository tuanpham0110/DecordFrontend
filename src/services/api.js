/**
    * Mock API layer.
    *
    * The UI only talks to the functions exported here. Each one returns a Promise
    * with realistic latency and error shapes ({ message, field? }), so swapping in
    * a real backend means replacing the bodies of these functions – nothing else.
    */
import { HANDBOOK, SENTENCES, VOCABULARY } from '../data/content.js';
import { engine } from './server/engine.js';

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

function sessionGet() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
function sessionSet(value) {
    try {
        if (value === null) sessionStorage.removeItem(SESSION_KEY);
        else sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    } catch {
        /* ignore */
    }
}

function users() {
    const list = safeGet(USERS_KEY, []);
    return list.some((u) => u.email === DEMO_USER.email) ? list : [DEMO_USER, ...list];
}

export class ApiError extends Error {
    constructor(message, field, extra = {}) {
        super(message);
        this.field = field;
        Object.assign(this, extra);
    }
}

const publicUser = ({ name, email }) => ({ name, email });

/* ───────────── Auth ───────────── */
export const auth = {
    currentSession() {
        // "remember me" sessions live in localStorage; others only for this tab
        return safeGet(SESSION_KEY, null) || sessionGet();
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
        sessionSet(session);
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
        sessionSet(null);
    },
};

/* ───────────── Learning ───────────── */
const TIMEOUT = 10000;

/** The signed-in learner. A real backend reads this from the auth token. */
function me() {
    const s = auth.currentSession();
    if (!s?.email) throw new ApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', undefined, { status: 401 });
    return s.email;
}

/**
 * Runs a server call with simulated latency and a timeout, normalising errors
 * to ApiError { message, status, code, field }.
 */
async function call(fn, ms = 260) {
    const work = (async () => {
        await wait(ms);
        try {
            return fn();
        } catch (e) {
            throw new ApiError(e.message || 'Đã có lỗi xảy ra.', e.field, { status: e.status ?? 500, code: e.code });
        }
    })();
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new ApiError('Máy chủ phản hồi quá lâu. Vui lòng thử lại.', undefined, { status: 408 })), TIMEOUT)
    );
    return Promise.race([work, timeout]);
}

export const learning = {
    overview: () => call(() => engine.overview(me()), 380),
    stage: (id) => call(() => engine.stage(me(), id), 280),
    lessonInfo: (id) => call(() => engine.lessonInfo(me(), id), 280),
    startLesson: (id) => call(() => engine.startLesson(me(), id), 380),
    saveStep: (lessonId, step) => call(() => engine.saveStep(me(), lessonId, step), 60),
    answer: (lessonId, itemId, response) => call(() => engine.answer(me(), lessonId, itemId, response), 220),
    rateShadow: (lessonId, itemId, rating) => call(() => engine.rateShadow(me(), lessonId, itemId, rating), 180),
    finishLesson: (lessonId) => call(() => engine.finishLesson(me(), lessonId), 500),
    restartLesson: (lessonId) => call(() => engine.restartLesson(me(), lessonId), 150),
    history: () => call(() => engine.history(me()), 250),
    setGoal: (goal) => call(() => engine.setGoal(me(), goal), 200),

    /** Public, account-free data. */
    async vocabulary() {
        await wait(200);
        return VOCABULARY;
    },
    async handbook() {
        await wait(260);
        return { articles: HANDBOOK, vocabulary: VOCABULARY, sentences: SENTENCES };
    },
};

export const review = {
    queue: (opts) => call(() => engine.reviewQueue(me(), opts), 300),
    list: () => call(() => engine.reviewList(me()), 260),
    answer: (itemId, response) => call(() => engine.reviewAnswer(me(), itemId, response), 220),
};

export const notebook = {
    catalog: () => call(() => engine.catalog(me()), 260),
    list: () => call(() => engine.notebook(me()), 260),
    save: (entry) => call(() => engine.saveToNotebook(me(), entry), 180),
    remove: (id) => call(() => engine.removeFromNotebook(me(), id), 160),
    toggleFavorite: (id) => call(() => engine.toggleFavorite(me(), id), 140),
    markCard: (id, known) => call(() => engine.markFlashcard(me(), id, known), 80),
};
