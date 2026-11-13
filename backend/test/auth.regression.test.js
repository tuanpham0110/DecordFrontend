import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Import-time configuration is isolated to this test worker; every DB operation below is mocked.
Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unit:unit@database.invalid/unit_test',
    JWT_SECRET: 'isolated-auth-regression-secret-at-least-32-characters',
    GOOGLE_CLIENT_ID: 'unit-google-client',
});
for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'GEMINI_API_KEY', 'SPEECH_API_URL']) delete process.env[key];
const { prisma } = await import('../src/lib/prisma.js');
const { authService } = await import('../src/modules/auth/auth.service.js');
const { accessTokenIsCurrent, credentialVersion, signAccess, signReset, signVerification, verifyToken } = await import('../src/lib/jwt.js');
const { requireAuth } = await import('../src/middleware/auth.js');
const { resetGoogleKeyCache } = await import('../src/lib/google.js');
const { env } = await import('../src/config/env.js');

const baseUser = () => ({
    id: 'unit-user', name: 'Unit User', email: 'unit@example.invalid', role: 'user',
    passwordHash: 'previous-password-hash', passwordChangedAt: null, passwordSet: true, verified: true,
});

function mockUser(t, initial = baseUser()) {
    let current = { ...initial };
    const snapshot = () => ({ ...current });
    const original = prisma.user;
    const originalTransaction = prisma.$transaction;
    prisma.$transaction = async (callback) => callback(prisma);
    prisma.user = {
        findUnique: async () => snapshot(),
        findUniqueOrThrow: async () => snapshot(),
        update: async ({ data }) => { current = { ...current, ...data }; return snapshot(); },
        updateMany: async ({ where, data }) => {
            if (!Object.entries(where).every(([key, value]) =>
                value instanceof Date || current[key] instanceof Date
                    ? value?.getTime() === current[key]?.getTime()
                    : value === current[key])) return { count: 0 };
            current = { ...current, ...data };
            return { count: 1 };
        },
    };
    t.after(() => { prisma.user = original; prisma.$transaction = originalTransaction; });
    return { get: snapshot, set: (data) => { current = { ...current, ...data }; } };
}

async function googleCredential(t) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key = { ...publicKey.export({ format: 'jwk' }), kid: 'unit-google-key', alg: 'RS256', use: 'sig' };
    resetGoogleKeyCache();
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ keys: [key] }), { headers: { 'cache-control': 'max-age=60' } }));
    return jwt.sign({ sub: 'google-unit-sub', email: 'unit@example.invalid', email_verified: true, name: 'Verified Owner' }, privateKey, {
        algorithm: 'RS256', keyid: key.kid, audience: process.env.GOOGLE_CLIENT_ID, issuer: 'https://accounts.google.com', expiresIn: '5m',
    });
}

function mockOtp(t, user, purpose, { onConsume } = {}) {
    const row = {
        id: 'bound-unit-otp', attempts: 0, consumedAt: null, expiresAt: new Date(Date.now() + 60000),
        codeHash: crypto.createHmac('sha256', process.env.JWT_SECRET)
            .update(JSON.stringify([user.email, purpose, '123456', credentialVersion(user)])).digest('hex'),
    };
    const original = prisma.otpCode;
    prisma.otpCode = {
        findFirst: async () => row.consumedAt ? null : { ...row },
        updateMany: async ({ data }) => {
            if (row.consumedAt || row.attempts >= env.OTP_MAX_ATTEMPTS) return { count: 0 };
            if (data.attempts) row.attempts += data.attempts.increment;
            if (data.consumedAt) { row.consumedAt = data.consumedAt; onConsume?.(); }
            return { count: 1 };
        },
    };
    t.after(() => { prisma.otpCode = original; });
    return row;
}

test('BUG-001: Google claim of a pending registration invalidates its untrusted password', async (t) => {
    const originalHash = await bcrypt.hash('Untrusted1234', 4);
    const state = mockUser(t, { ...baseUser(), verified: false, passwordHash: originalHash });
    const result = await authService.googleLogin({ credential: await googleCredential(t) });
    assert.equal(state.get().verified, true);
    assert.equal(state.get().passwordSet, false);
    assert.equal(await bcrypt.compare('Untrusted1234', state.get().passwordHash), false);
    assert.equal(state.get().name, 'Verified Owner');
    assert.equal(accessTokenIsCurrent(verifyToken(result.token, 'access'), state.get()), true);
});

test('BUG-001: Google linking preserves the password of an already verified account', async (t) => {
    const state = mockUser(t);
    await authService.googleLogin({ credential: await googleCredential(t) });
    assert.equal(state.get().passwordHash, baseUser().passwordHash);
    assert.equal(state.get().passwordSet, true);
});

test('BUG-001: a registration delayed in bcrypt cannot overwrite a concurrent Google claim', async (t) => {
    const state = mockUser(t, { ...baseUser(), verified: false });
    const credential = await googleCredential(t);
    let started;
    let release;
    const hashing = new Promise((resolve) => { started = resolve; });
    const resumeHash = new Promise((resolve) => { release = resolve; });
    const hash = bcrypt.hash;
    t.mock.method(bcrypt, 'hash', async (password) => {
        if (password === 'LateRegistration123') { started(); await resumeHash; }
        return hash(password, 4);
    });
    const late = authService.register({ name: 'Pending Registrant', email: 'unit@example.invalid', password: 'LateRegistration123' });
    await hashing;
    const signedIn = await authService.googleLogin({ credential });
    const ownerHash = state.get().passwordHash;
    release();
    await assert.rejects(late, { code: 'email-taken' });
    assert.equal(state.get().verified, true);
    assert.equal(state.get().passwordHash, ownerHash);
    assert.equal(state.get().passwordSet, false);
    assert.equal(accessTokenIsCurrent(verifyToken(signedIn.token, 'access'), state.get()), true);
});

test('BUG-001: a Google claim delayed in bcrypt preserves a concurrently confirmed password', async (t) => {
    const state = mockUser(t, { ...baseUser(), verified: false });
    const credential = await googleCredential(t);
    let started;
    let release;
    const hashing = new Promise((resolve) => { started = resolve; });
    const resumeHash = new Promise((resolve) => { release = resolve; });
    const hash = bcrypt.hash;
    t.mock.method(bcrypt, 'hash', async (password) => { started(); await resumeHash; return hash(password, 4); });
    const signingIn = authService.googleLogin({ credential });
    await hashing;
    state.set({ verified: true, passwordHash: 'concurrently-confirmed-password', passwordSet: true });
    release();
    const signedIn = await signingIn;
    assert.equal(state.get().passwordHash, 'concurrently-confirmed-password');
    assert.equal(state.get().passwordSet, true);
    assert.equal(accessTokenIsCurrent(verifyToken(signedIn.token, 'access'), state.get()), true);
});

test('registration replacement without email verification signs its own saved credentials', async (t) => {
    const state = mockUser(t, { ...baseUser(), verified: false });
    const verificationRequired = env.verificationRequired;
    env.verificationRequired = false;
    t.after(() => { env.verificationRequired = verificationRequired; });
    const result = await authService.register({ name: 'Confirmed Registrant', email: 'unit@example.invalid', password: 'OwnPassword123' });
    assert.equal(state.get().verified, true);
    assert.equal(await bcrypt.compare('OwnPassword123', state.get().passwordHash), true);
    assert.equal(accessTokenIsCurrent(verifyToken(result.session.token, 'access'), state.get()), true);
});

test('BUG-001: an older registration flow cannot confirm a newly replaced password with its fresh OTP', async (t) => {
    const previous = { ...baseUser(), verified: false };
    const previousToken = signVerification(previous);
    const state = mockUser(t, { ...previous, passwordHash: 'replacement-registration-password' });
    mockOtp(t, state.get(), 'verify');
    await assert.rejects(authService.verifyOtp({ email: previous.email, purpose: 'verify', code: '123456', verificationToken: previousToken }), { code: 'verification-expired' });
    assert.equal(state.get().verified, false);
});

test('BUG-001: an older OTP cannot confirm changed credentials even with the new browser challenge', async (t) => {
    const previous = { ...baseUser(), verified: false };
    const state = mockUser(t, { ...previous, passwordHash: 'replacement-registration-password' });
    mockOtp(t, previous, 'verify');
    await assert.rejects(authService.verifyOtp({ email: previous.email, purpose: 'verify', code: '123456', verificationToken: signVerification(state.get()) }), { code: 'otp-wrong' });
    assert.equal(state.get().verified, false);
});

test('BUG-001: confirmation atomically rejects credentials changed after OTP validation', async (t) => {
    const state = mockUser(t, { ...baseUser(), verified: false });
    const token = signVerification(state.get());
    mockOtp(t, state.get(), 'verify', { onConsume: () => state.set({ passwordHash: 'changed-between-otp-and-confirmation' }) });
    await assert.rejects(authService.verifyOtp({ email: state.get().email, purpose: 'verify', code: '123456', verificationToken: token }), { code: 'verification-expired' });
    assert.equal(state.get().verified, false);
});

test('BUG-001: matching registration challenge and OTP confirm the chosen credentials', async (t) => {
    const state = mockUser(t, { ...baseUser(), verified: false });
    mockOtp(t, state.get(), 'verify');
    const result = await authService.verifyOtp({ email: state.get().email, purpose: 'verify', code: '123456', verificationToken: signVerification(state.get()) });
    assert.equal(state.get().verified, true);
    assert.equal(accessTokenIsCurrent(verifyToken(result.token, 'access'), state.get()), true);
});

test('BUG-001: resend cannot mint or refresh a registration challenge for an unknown browser', async (t) => {
    const state = mockUser(t, { ...baseUser(), verified: false });
    await assert.rejects(authService.resendOtp({ email: state.get().email, purpose: 'verify' }), { code: 'verification-expired' });
    const oldToken = signVerification(state.get());
    state.set({ passwordHash: 'replaced-registration-password' });
    await assert.rejects(authService.resendOtp({ email: state.get().email, purpose: 'verify', verificationToken: oldToken }), { code: 'verification-expired' });
});

test('OTP incorrect-attempt counters persist and lock after the configured number of failures', async (t) => {
    const state = mockUser(t, { ...baseUser(), verified: false });
    const row = mockOtp(t, state.get(), 'verify');
    const verificationToken = signVerification(state.get());
    for (let i = 0; i < env.OTP_MAX_ATTEMPTS; i++) {
        await assert.rejects(authService.verifyOtp({ email: state.get().email, purpose: 'verify', code: '000000', verificationToken }), { code: 'otp-wrong' });
    }
    assert.equal(row.attempts, env.OTP_MAX_ATTEMPTS);
    await assert.rejects(authService.verifyOtp({ email: state.get().email, purpose: 'verify', code: '123456', verificationToken }), { code: 'otp-locked' });
});

test('a reset OTP issued before a password change cannot authorize another reset', async (t) => {
    const previous = baseUser();
    const state = mockUser(t, { ...previous, passwordHash: 'already-changed-password' });
    mockOtp(t, previous, 'reset');
    await assert.rejects(authService.verifyOtp({ email: previous.email, purpose: 'reset', code: '123456' }), { code: 'otp-wrong' });
    assert.equal(state.get().passwordHash, 'already-changed-password');
});

test('registration returns a browser challenge bound to the saved pending credentials', async (t) => {
    const state = mockUser(t, { ...baseUser(), verified: false });
    const original = prisma.otpCode;
    prisma.otpCode = { findFirst: async () => ({ createdAt: new Date() }) }; // resend cooldown; no mail or DB writes
    t.after(() => { prisma.otpCode = original; });
    const result = await authService.register({ name: 'Pending Owner', email: state.get().email, password: 'ChosenPassword123' });
    const challenge = verifyToken(result.verificationToken, 'verify');
    assert.equal(challenge.uid, state.get().id);
    assert.equal(challenge.ver, credentialVersion(state.get()));
    assert.equal(state.get().verified, false);
});

test('unverified login returns a browser challenge only after validating the chosen password', async (t) => {
    const state = mockUser(t, { ...baseUser(), verified: false, passwordHash: await bcrypt.hash('ChosenPassword123', 4) });
    const original = prisma.otpCode;
    prisma.otpCode = { findFirst: async () => ({ createdAt: new Date() }) };
    t.after(() => { prisma.otpCode = original; });
    await assert.rejects(authService.login({ email: state.get().email, password: 'Incorrect123' }), (e) => {
        assert.equal(e.code, 'bad-credentials');
        assert.equal(e.verificationToken, undefined);
        return true;
    });
    await assert.rejects(authService.login({ email: state.get().email, password: 'ChosenPassword123' }), (e) => {
        assert.equal(e.code, 'unverified');
        assert.equal(verifyToken(e.verificationToken, 'verify').ver, credentialVersion(state.get()));
        return true;
    });
});

test('browser auth preserves the server registration challenge through resend and confirmation', async (t) => {
    const { auth: browserAuth } = await import('../../frontend/src/services/api.js');
    const previous = { window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
    const storage = () => {
        const data = new Map();
        return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
    };
    globalThis.window = new EventTarget();
    globalThis.localStorage = storage();
    globalThis.sessionStorage = storage();
    t.after(() => Object.assign(globalThis, previous));
    browserAuth.currentSession();
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (path, options) => {
        requests.push({ path, body: JSON.parse(options.body) });
        const data = path.endsWith('/register') ? { email: 'unit@example.invalid', verificationToken: 'signed-browser-challenge' }
            : path.endsWith('/verify') ? { token: 'access-token', user: { id: 'unit-user' } } : { ok: true };
        return new Response(JSON.stringify(data));
    });
    await browserAuth.register({ name: 'Unit Owner', email: 'unit@example.invalid', password: 'ChosenPassword123' });
    assert.equal(browserAuth.pending().verificationToken, 'signed-browser-challenge');
    await browserAuth.resendOtp();
    await browserAuth.verifyOtp({ code: '123456' });
    assert.equal(requests[1].body.verificationToken, 'signed-browser-challenge');
    assert.equal(requests[2].body.verificationToken, 'signed-browser-challenge');
    assert.equal(browserAuth.currentSession().id, 'unit-user');
});

test('browser auth carries an unverified login challenge and clearly rejects pre-deployment pending flows', async (t) => {
    const { auth: browserAuth } = await import('../../frontend/src/services/api.js');
    const previous = { window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
    const data = new Map();
    const store = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
    globalThis.window = new EventTarget();
    globalThis.localStorage = store;
    globalThis.sessionStorage = store;
    t.after(() => Object.assign(globalThis, previous));
    browserAuth.currentSession();
    let requests = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        requests++;
        return new Response(JSON.stringify({ message: 'Pending email confirmation', code: 'unverified', field: 'unverified', verificationToken: 'login-challenge' }), { status: 403 });
    });
    await assert.rejects(browserAuth.login({ email: 'unit@example.invalid', password: 'ChosenPassword123' }), { code: 'unverified' });
    assert.equal(browserAuth.pending().verificationToken, 'login-challenge');
    data.set('muonglab.pending', JSON.stringify({ email: 'unit@example.invalid', purpose: 'verify' }));
    await assert.rejects(browserAuth.resendOtp(), { code: 'verification-expired' });
    await assert.rejects(browserAuth.verifyOtp({ code: '123456' }), { code: 'verification-expired' });
    assert.equal(requests, 1);
});

test('BUG-004: reset token is single use without a delay between calls', async (t) => {
    const state = mockUser(t);
    const oldAccess = verifyToken(signAccess(state.get(), true), 'access');
    const resetToken = signReset(state.get());
    await authService.resetPassword({ resetToken, password: 'NextPassword123' });
    assert.equal(await bcrypt.compare('NextPassword123', state.get().passwordHash), true);
    await assert.rejects(authService.resetPassword({ resetToken, password: 'Replayed123' }), { code: 'reset-expired' });
    assert.equal(accessTokenIsCurrent(oldAccess, state.get()), false);
    assert.equal(accessTokenIsCurrent(verifyToken(signAccess(state.get(), true), 'access'), state.get()), true);
});

test('BUG-004: simultaneous resets using one token only change the password once', async (t) => {
    const state = mockUser(t);
    const resetToken = signReset(state.get());
    const results = await Promise.allSettled([
        authService.resetPassword({ resetToken, password: 'ConcurrentOne123' }),
        authService.resetPassword({ resetToken, password: 'ConcurrentTwo123' }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'reset-expired');
});

test('BUG-004: reset token cannot target a recreated account with the same email', async (t) => {
    const old = baseUser();
    mockUser(t, { ...old, id: 'replacement-user' });
    await assert.rejects(authService.resetPassword({ resetToken: signReset(old), password: 'NextPassword123' }), { code: 'reset-expired' });
});

test('BUG-004: credential changes revoke access within the same JWT second', () => {
    const old = baseUser();
    const payload = verifyToken(signAccess(old, true), 'access');
    const changed = { ...old, passwordHash: 'new-salted-password-hash', passwordChangedAt: new Date(payload.iat * 1000) };
    assert.notEqual(credentialVersion(old), credentialVersion(changed));
    assert.equal(accessTokenIsCurrent(payload, changed), false);
    assert.equal(accessTokenIsCurrent({ iat: payload.iat }, changed), false, 'legacy token from the same second is also revoked');
    assert.equal(accessTokenIsCurrent(verifyToken(signAccess(changed, true), 'access'), changed), true);
});

test('BUG-004: password change returns a working token and rejects the previous token', async (t) => {
    const state = mockUser(t, { ...baseUser(), passwordHash: await bcrypt.hash('Original1234', 4) });
    const previous = verifyToken(signAccess(state.get(), true), 'access');
    const result = await authService.changePassword('unit-user', { currentPassword: 'Original1234', newPassword: 'Changed1234' });
    assert.equal(accessTokenIsCurrent(previous, state.get()), false);
    assert.equal(accessTokenIsCurrent(verifyToken(result.token, 'access'), state.get()), true);
});

test('requireAuth validates credential binding without exposing passwordHash downstream', async (t) => {
    const state = mockUser(t);
    const req = { headers: { authorization: `Bearer ${signAccess(state.get(), true)}` } };
    let error;
    await requireAuth(req, {}, (err) => { error = err; });
    assert.equal(error, undefined);
    assert.equal(req.user.id, state.get().id);
    assert.equal(req.user.passwordHash, undefined);
});

test('OTP verification consumes a code atomically before issuing reset credentials', async (t) => {
    const state = mockUser(t);
    let consumed = false;
    const codeHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(JSON.stringify(['unit@example.invalid', 'reset', '123456', credentialVersion(state.get())])).digest('hex');
    const original = prisma.otpCode;
    prisma.otpCode = {
        findFirst: async () => ({ id: 'unit-otp', attempts: 0, codeHash, expiresAt: new Date(Date.now() + 60000) }),
        updateMany: async () => {
            if (consumed) return { count: 0 };
            consumed = true;
            return { count: 1 };
        },
    };
    t.after(() => { prisma.otpCode = original; });
    const payload = { email: 'unit@example.invalid', purpose: 'reset', code: '123456' };
    const results = await Promise.allSettled([authService.verifyOtp(payload), authService.verifyOtp(payload)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'otp-expired');
});

test('BUG-019: database E2E safely skips without an explicitly dedicated test database', () => {
    for (const settings of [{ RUN_DB_TESTS: '' }, { RUN_DB_TESTS: 'true', TEST_DATABASE_URL: 'postgresql://unit:unit@database.invalid/production' }]) {
        const childEnv = { ...process.env, TEST_DATABASE_URL: '', ...settings };
        delete childEnv.NODE_TEST_CONTEXT;
        const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'test/api.e2e.test.js'], {
            cwd: new URL('..', import.meta.url), encoding: 'utf8',
            env: childEnv, timeout: 10000,
        });
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /SKIP/);
        assert.match(result.stdout, /# pass 0/);
    }
});
