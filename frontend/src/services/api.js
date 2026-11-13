/**
 * HTTP client for the MUONGLAB backend (../backend).
 *
 * Pages only call the functions exported here. Every error is normalised to
 * ApiError { message, status, code, field } so the UI can show it directly.
 *
 * Base URL: VITE_API_URL (default "/api" – Vite proxies it to the backend in dev).
 */
export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TIMEOUT = 15000;

const SESSION_KEY = 'muonglab.session';
const PENDING_KEY = 'muonglab.pending';
export const CHAT_KEY = 'muonglab.chat';
export const UNAUTHORIZED_EVENT = 'muonglab:unauthorized';

export class ApiError extends Error {
    constructor(message, field, extra = {}) {
        super(message);
        this.field = field;
        Object.assign(this, extra);
    }
}

/* ───────────── storage helpers ───────────── */
function read(store, key) {
    try {
        const raw = store.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
function write(store, key, value) {
    try {
        if (value == null) store.removeItem(key);
        else store.setItem(key, JSON.stringify(value));
    } catch {
        /* storage unavailable – the session simply won't persist */
    }
}

/** { token, user } – "remember me" sessions live in localStorage, others only in this tab. */
function session() {
    return read(localStorage, SESSION_KEY) || read(sessionStorage, SESSION_KEY);
}
function clearSession() {
    write(localStorage, SESSION_KEY, null);
    write(sessionStorage, SESSION_KEY, null);
    write(sessionStorage, CHAT_KEY, null); // the AI chat belongs to the account that just left
}
/** Stores a fresh session; `remember` keeps it across browser restarts. */
function openSession({ token, user }, remember) {
    clearSession();
    write(remember ? localStorage : sessionStorage, SESSION_KEY, { token, user });
    write(localStorage, PENDING_KEY, null);
    return user;
}
/** Updates the stored session in place (same storage it already lives in). */
function patchSession(patch) {
    for (const store of [localStorage, sessionStorage]) {
        const cur = read(store, SESSION_KEY);
        if (cur) write(store, SESSION_KEY, { ...cur, ...patch });
    }
}
export const authToken = () => session()?.token ?? null;

/* ───────────── core request ───────────── */
/**
 * @param {string} method
 * @param {string} path  e.g. "/me/overview"
 * @param {{ body?: any, form?: FormData, auth?: boolean, signal?: AbortSignal, raw?: boolean, timeout?: number }} opts
 */
export async function request(method, path, { body, form, auth = true, signal, raw = false, timeout = TIMEOUT } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = auth ? authToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const ctrl = new AbortController();
    const timer = timeout ? setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeout) : null;
    const onAbort = () => ctrl.abort(signal.reason);
    signal?.addEventListener('abort', onAbort);

    let res;
    try {
        res = await fetch(API_URL + path, {
            method,
            headers,
            body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
            signal: ctrl.signal,
        });
    } catch (e) {
        if (signal?.aborted) throw e; // caller cancelled
        if (ctrl.signal.reason?.name === 'TimeoutError') throw new ApiError('Máy chủ phản hồi quá lâu. Vui lòng thử lại.', undefined, { status: 408 });
        throw new ApiError('Không kết nối được máy chủ. Kiểm tra mạng hoặc thử lại sau.', undefined, { status: 0, code: 'network' });
    } finally {
        if (timer && !raw) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
    }

    if (!res.ok) {
        if (timer) clearTimeout(timer);
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && token) {
            clearSession();
            window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
        }
        throw new ApiError(data.message || 'Đã có lỗi xảy ra.', data.field, { status: res.status, code: data.code });
    }
    if (raw) {
        if (timer) clearTimeout(timer);
        return res;
    }
    return res.status === 204 ? null : res.json();
}

const get = (p, o) => request('GET', p, o);
const post = (p, body, o) => request('POST', p, { ...o, body: body ?? {} });
const put = (p, body, o) => request('PUT', p, { ...o, body });
const patch = (p, body, o) => request('PATCH', p, { ...o, body });
const del = (p, body, o) => request('DELETE', p, { ...o, body });

/* ───────────── Auth ───────────── */
export const auth = {
    /** The signed-in user ({ id, name, email }) or null. */
    currentSession() {
        return session()?.user ?? null;
    },

    async login({ email, password, remember }) {
        try {
            return openSession(await post('/auth/login', { email: email.trim(), password, remember: !!remember }, { auth: false }), remember);
        } catch (e) {
            if (e.code === 'unverified') write(localStorage, PENDING_KEY, { email: email.trim(), purpose: 'verify' });
            throw e;
        }
    },

    /** Sign in / sign up with the ID token from Google Identity Services. Returns the user. */
    async google(credential) {
        return openSession(await post('/auth/google', { credential }, { auth: false }), true);
    },

    /**
     * Creates the account. Returns { user } when the server signs the learner in right away
     * (email verification off), otherwise { user: null } and an OTP is waiting to be entered.
     */
    async register({ name, email, password }) {
        const r = await post('/auth/register', { name, email: email.trim(), password }, { auth: false });
        if (r.session) return { user: openSession(r.session, true) };
        write(localStorage, PENDING_KEY, { email: r.email, purpose: 'verify' });
        return { user: null };
    },

    async requestReset({ email }) {
        const r = await post('/auth/password/forgot', { email: email.trim() }, { auth: false });
        write(localStorage, PENDING_KEY, { email: r.email, purpose: 'reset' });
        return r;
    },

    /** The email waiting for an OTP: { email, purpose, verified?, resetToken? }. */
    pending() {
        return read(localStorage, PENDING_KEY);
    },

    async resendOtp() {
        const p = auth.pending();
        if (!p) throw new ApiError('Phiên xác thực đã hết hạn. Vui lòng thực hiện lại.');
        await post('/auth/otp/resend', { email: p.email, purpose: p.purpose }, { auth: false });
        return true;
    },

    /** Confirms the OTP. For sign-up the learner is signed in: returns { purpose: 'verify', user }. */
    async verifyOtp({ code }) {
        const p = auth.pending();
        if (!p) throw new ApiError('Phiên xác thực đã hết hạn. Vui lòng thực hiện lại.');
        const r = await post('/auth/otp/verify', { email: p.email, purpose: p.purpose, code }, { auth: false });
        if (p.purpose === 'reset') {
            write(localStorage, PENDING_KEY, { ...p, verified: true, resetToken: r.resetToken });
            return { purpose: 'reset', user: null };
        }
        return { purpose: 'verify', user: r.token ? openSession(r, true) : null };
    },

    async resetPassword({ password }) {
        const p = auth.pending();
        if (!p?.resetToken) throw new ApiError('Phiên đặt lại mật khẩu đã hết hạn.');
        await post('/auth/password/reset', { resetToken: p.resetToken, password }, { auth: false });
        write(localStorage, PENDING_KEY, null);
        return true;
    },

    logout() {
        clearSession();
    },

    /* ── signed-in account ── */
    /** { id, name, email, createdAt, hasPassword, google, verified, dailyGoal } */
    me: () => get('/auth/me'),

    async updateProfile({ name }) {
        const user = await patch('/auth/me', { name });
        patchSession({ user });
        return user;
    },

    /** Other devices are signed out; this one keeps working with the new token. */
    async changePassword({ currentPassword, newPassword }) {
        const { token, user } = await post('/auth/password/change', { currentPassword: currentPassword || undefined, newPassword });
        patchSession({ token, user });
        return user;
    },

    async deleteAccount({ password, confirmEmail }) {
        await del('/auth/me', { password: password || undefined, confirmEmail: confirmEmail || undefined });
        clearSession();
        return true;
    },
};

/* ───────────── Learning ───────────── */
const S = (id) => `/me/lessons/${id}/session`;

export const learning = {
    overview: () => get('/me/overview'),
    stage: (id) => get(`/me/stages/${id}`),
    lessonInfo: (id) => get(`/me/lessons/${id}`),
    startLesson: (id) => post(S(id)),
    saveStep: (lessonId, step) => patch(`${S(lessonId)}/step`, { step }),
    answer: (lessonId, itemId, response) => post(`${S(lessonId)}/answers`, { itemId, response }),
    rateShadow: (lessonId, itemId, rating) => post(`${S(lessonId)}/shadow`, { itemId, rating }),
    finishLesson: (lessonId) => post(`${S(lessonId)}/finish`),
    restartLesson: (lessonId) => del(S(lessonId)),
    history: () => get('/me/history'),
    setGoal: (goal) => put('/me/goal', { goal }).then((r) => r.goal),

    /** Public, account-free data. */
    vocabulary: () => get('/content/vocabulary', { auth: false }),
    handbook: () => get('/content/handbook', { auth: false }),
};

export const content = {
    summary: () => get('/content/summary', { auth: false }),
    trial: () => get('/content/trial', { auth: false }),
    trialAnswer: (itemId, response) => post('/content/trial/answers', { itemId, response }, { auth: false }),
};

export const review = {
    queue: ({ scope, itemIds } = {}) => {
        const q = new URLSearchParams();
        if (itemIds?.length) q.set('items', itemIds.join(','));
        else if (scope) q.set('scope', scope);
        return get(`/me/review/queue?${q}`);
    },
    list: () => get('/me/review'),
    answer: (itemId, response) => post('/me/review/answers', { itemId, response }),
};

const E = (id) => `/me/notebook/${encodeURIComponent(id)}`;
export const notebook = {
    catalog: () => get('/me/notebook/catalog'),
    list: () => get('/me/notebook'),
    save: (entry) => post('/me/notebook', { type: entry.type, ref: entry.ref }),
    remove: (id) => del(E(id)),
    toggleFavorite: (id) => post(`${E(id)}/favorite`),
    markCard: (id, known) => post(`${E(id)}/review`, { known }),
};

/* ───────────── Server capabilities ───────────── */
let metaPromise = null;
/** { ai, aiModel, speech, mail, emailVerification, passwordReset, googleClientId } – what the backend has configured. */
export function getMeta() {
    metaPromise ??= get('/meta', { auth: false }).catch(() => {
        metaPromise = null;
        return { ai: false, aiModel: null, speech: false, mail: false, emailVerification: true, passwordReset: true, googleClientId: null };
    });
    return metaPromise;
}
