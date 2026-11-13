/**
 * HTTP client for the MUONGLAB backend (../backend).
 *
 * Pages only call the functions exported here. Every error is normalised to
 * ApiError { message, status, code, field } so the UI can show it directly.
 *
 * Base URL: VITE_API_URL (default "/api" – Vite proxies it to the backend in dev).
 */
export const API_URL = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');
const TIMEOUT = 15000;

export const SESSION_KEY = 'muonglab.session';
const PENDING_KEY = 'muonglab.pending';
export const CHAT_KEY = 'muonglab.chat';
export const UNAUTHORIZED_EVENT = 'muonglab:unauthorized';
let boundAccountId;

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
    boundAccountId = null;
    write(localStorage, SESSION_KEY, null);
    write(sessionStorage, SESSION_KEY, null);
    write(sessionStorage, CHAT_KEY, null); // the AI chat belongs to the account that just left
}
/** Stores a fresh session; `remember` keeps it across browser restarts. */
function openSession({ token, user }, remember) {
    clearSession();
    boundAccountId = user.id;
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
    const current = auth ? session() : null;
    const token = current?.token ?? null;
    const sessionChanged = () => new ApiError('Phiên đăng nhập đã thay đổi. Vui lòng tải lại trang.', undefined, { status: 409, code: 'session-changed' });
    if (auth && boundAccountId !== undefined && (current?.user?.id ?? null) !== boundAccountId) throw sessionChanged();
    if (token) headers.Authorization = `Bearer ${token}`;

    const ctrl = new AbortController();
    const timer = timeout ? setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeout) : null;
    const onAbort = () => ctrl.abort(signal.reason);
    const onStorage = (event) => {
        if ((event.key === SESSION_KEY || event.key === null) && token !== authToken()) ctrl.abort(sessionChanged());
    };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
    if (auth) window.addEventListener('storage', onStorage);
    const cleanup = () => {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (auth) window.removeEventListener('storage', onStorage);
    };
    const checkSession = () => {
        if (auth && token !== authToken()) throw sessionChanged();
    };
    const requestError = (e) => {
        if (ctrl.signal.reason instanceof ApiError) return ctrl.signal.reason;
        if (signal?.aborted) return signal.reason ?? e;
        if (ctrl.signal.reason?.name === 'TimeoutError') return new ApiError('Máy chủ phản hồi quá lâu. Vui lòng thử lại.', undefined, { status: 408 });
        if (e instanceof ApiError) return e;
        return new ApiError('Không kết nối được máy chủ. Kiểm tra mạng hoặc thử lại sau.', undefined, { status: 0, code: 'network' });
    };

    let handedOff = false;
    try {
        const res = await fetch(API_URL + path, {
            method,
            headers,
            body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
            signal: ctrl.signal,
        });
        checkSession();
        if (!res.ok) {
            const data = await res.json().catch((e) => {
                if (ctrl.signal.aborted) throw e;
                return {};
            });
            checkSession();
            if (res.status === 401 && token) {
                clearSession();
                window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
            }
            throw new ApiError(data.message || 'Đã có lỗi xảy ra.', data.field, { status: res.status, code: data.code, verificationToken: data.verificationToken });
        }
        if (raw && res.body) {
            const reader = res.body.getReader();
            let finished = false;
            let onBodyAbort;
            const finish = () => {
                finished = true;
                ctrl.signal.removeEventListener('abort', onBodyAbort);
                cleanup();
            };
            const bodyStream = new ReadableStream({
                start(controller) {
                    onBodyAbort = () => {
                        if (finished) return;
                        finish();
                        reader.cancel(ctrl.signal.reason).catch(() => {});
                        controller.error(requestError(ctrl.signal.reason));
                    };
                    ctrl.signal.addEventListener('abort', onBodyAbort, { once: true });
                    if (ctrl.signal.aborted) onBodyAbort();
                },
                async pull(controller) {
                    try {
                        checkSession();
                        const { value, done } = await reader.read();
                        if (finished) return;
                        checkSession();
                        if (done) {
                            finish();
                            controller.close();
                        } else controller.enqueue(value);
                    } catch (e) {
                        if (finished) return;
                        finish();
                        reader.cancel(e).catch(() => {});
                        controller.error(requestError(e));
                    }
                },
                cancel(reason) {
                    finish();
                    ctrl.abort(reason);
                    return reader.cancel(reason);
                },
            }, { highWaterMark: 0 });
            handedOff = true;
            return new Response(bodyStream, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
        if (raw) return res;
        const data = res.status === 204 ? null : await res.json();
        checkSession();
        return data;
    } catch (e) {
        throw requestError(e);
    } finally {
        if (!handedOff) cleanup();
    }
}

const get = (p, o) => request('GET', p, o);
const post = (p, body, o) => request('POST', p, { ...o, body: body ?? {} });
const put = (p, body, o) => request('PUT', p, { ...o, body });
const patch = (p, body, o) => request('PATCH', p, { ...o, body });
const del = (p, body, o) => request('DELETE', p, { ...o, body });

/* ───────────── Auth ───────────── */
export const auth = {
    /** The signed-in user ({ id, name, email, role }) or null. */
    currentSession() {
        const user = session()?.user ?? null;
        boundAccountId = user?.id ?? null;
        return user;
    },

    async login({ email, password, remember }) {
        try {
            return openSession(await post('/auth/login', { email: email.trim(), password, remember: !!remember }, { auth: false }), remember);
        } catch (e) {
            if (e.code === 'unverified') write(localStorage, PENDING_KEY, { email: email.trim(), purpose: 'verify', verificationToken: e.verificationToken });
            throw e;
        }
    },

    /** Sign in / sign up with the ID token from Google Identity Services. Returns the user. */
    async google(credential) {
        return openSession(await post('/auth/google', { credential }, { auth: false }), true);
    },

    /** Sign in / sign up with the ID token from the Microsoft (MSAL) popup. Returns the user. */
    async microsoft(idToken) {
        return openSession(await post('/auth/microsoft', { idToken }, { auth: false }), true);
    },

    /**
     * Creates the account. Returns { user } when the server signs the learner in right away
     * (email verification off), otherwise { user: null } and an OTP is waiting to be entered.
     */
    async register({ name, email, password }) {
        const r = await post('/auth/register', { name, email: email.trim(), password }, { auth: false });
        if (r.session) return { user: openSession(r.session, true) };
        write(localStorage, PENDING_KEY, { email: r.email, purpose: 'verify', verificationToken: r.verificationToken });
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
        if (p.purpose === 'verify' && !p.verificationToken) throw new ApiError('Phiên xác thực đăng ký đã hết hạn. Vui lòng đăng ký lại hoặc đăng nhập bằng mật khẩu đã chọn.', undefined, { code: 'verification-expired' });
        await post('/auth/otp/resend', { email: p.email, purpose: p.purpose, verificationToken: p.verificationToken }, { auth: false });
        return true;
    },

    /** Confirms the OTP. For sign-up the learner is signed in: returns { purpose: 'verify', user }. */
    async verifyOtp({ code }) {
        const p = auth.pending();
        if (!p) throw new ApiError('Phiên xác thực đã hết hạn. Vui lòng thực hiện lại.');
        if (p.purpose === 'verify' && !p.verificationToken) throw new ApiError('Phiên xác thực đăng ký đã hết hạn. Vui lòng đăng ký lại hoặc đăng nhập bằng mật khẩu đã chọn.', undefined, { code: 'verification-expired' });
        const r = await post('/auth/otp/verify', { email: p.email, purpose: p.purpose, code, verificationToken: p.verificationToken }, { auth: false });
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

    /** Re-reads name / role from the server so a stored session never shows stale rights. */
    async refresh() {
        const { id, name, email, role } = await get('/auth/me');
        const user = { id, name, email, role };
        patchSession({ user });
        return user;
    },

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
    answer: (lessonId, itemId, response, contentVersion) => post(`${S(lessonId)}/answers`, { itemId, response, contentVersion }),
    rateShadow: (lessonId, itemId, rating, contentVersion) => post(`${S(lessonId)}/shadow`, { itemId, rating, contentVersion }),
    finishLesson: (lessonId, contentVersion) => post(`${S(lessonId)}/finish`, { contentVersion }),
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
    answer: (itemId, response, reviewToken) => post('/me/review/answers', { itemId, response, reviewToken }),
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

/* ───────────── Support (learner ↔ admin messages) ───────────── */
export const support = {
    /** [{ id, fromAdmin, body, at, read }] – opening it marks the admin's replies as read. */
    thread: () => get('/me/support'),
    send: (body) => post('/me/support', { body }),
};

/* ───────────── Admin area (role = admin) ───────────── */
export const admin = {
    overview: () => get('/admin/overview'),
    users: ({ q, page } = {}) => {
        const p = new URLSearchParams();
        if (q) p.set('q', q);
        if (page > 1) p.set('page', page);
        return get(`/admin/users?${p}`);
    },
    setRole: (id, role) => patch(`/admin/users/${id}`, { role }),
    deleteUser: (id) => del(`/admin/users/${id}`),
    threads: () => get('/admin/support'),
    thread: (userId) => get(`/admin/support/${userId}`),
    reply: (userId, body) => post(`/admin/support/${userId}`, { body }),
};

/* ───────────── Server capabilities ───────────── */
let metaPromise = null;
/** { ai, aiModel, speech, mail, emailVerification, passwordReset, googleClientId } – what the backend has configured. */
export function getMeta() {
    metaPromise ??= get('/meta', { auth: false }).catch(() => {
        metaPromise = null;
        return { ai: false, aiModel: null, speech: false, speechEngine: null, mail: false, emailVerification: true, passwordReset: true, googleClientId: null, microsoftClientId: null, supportEmail: null };
    });
    return metaPromise;
}
