/**
 * End-to-end API test against a real database (uses DATABASE_URL from .env).
 *   npm test
 * Creates a throw-away user and deletes it afterwards.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetGoogleKeyCache, verifyGoogleIdToken } from '../src/lib/google.js';
import { publicItem } from '../src/modules/learning/rules.js';
import { ITEMS } from '../prisma/data/content.js';

let server;
let base;
let token;
const email = `e2e-${Date.now()}@test.local`;
const password = 'Test1234';

async function api(method, path, body, auth = true) {
    const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? null : await res.json();
    return { status: res.status, data };
}

before(async () => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}/api`;
    await prisma.user.create({ data: { email, name: 'E2E', passwordHash: await bcrypt.hash(password, 10), verified: true } });
});

after(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: '@test.local' } } });
    await prisma.otpCode.deleteMany({ where: { email: { endsWith: '@test.local' } } });
    await prisma.$disconnect();
    server.close();
});

describe('auth', () => {
    test('rejects wrong password', async () => {
        const r = await api('POST', '/auth/login', { email, password: 'nope' });
        assert.equal(r.status, 401);
    });
    test('validates input', async () => {
        const r = await api('POST', '/auth/register', { name: 'A B', email: 'bad', password: 'x' });
        assert.equal(r.status, 400);
        assert.equal(r.data.field, 'email');
    });
    test('register → login says unverified → wrong OTP rejected', async () => {
        const e = `new-${Date.now()}@test.local`;
        assert.equal((await api('POST', '/auth/register', { name: 'New User', email: e, password: 'Abcd1234' })).status, 201);
        const login = await api('POST', '/auth/login', { email: e, password: 'Abcd1234' });
        assert.equal(login.status, 403);
        assert.equal(login.data.code, 'unverified');
        const v = await api('POST', '/auth/otp/verify', { email: e, purpose: 'verify', code: '000000' });
        assert.equal(v.status, 400);
    });
    test('login ok', async () => {
        const r = await api('POST', '/auth/login', { email, password });
        assert.equal(r.status, 200);
        token = r.data.token;
        assert.equal(r.data.user.email, email);
    });
    test('protected routes need a token', async () => {
        const r = await api('GET', '/me/overview', null, false);
        assert.equal(r.status, 401);
    });
});

describe('learning + stage gate', () => {
    test('stage 1 open, stage 2 locked', async () => {
        const o = await api('GET', '/me/overview');
        assert.equal(o.status, 200);
        assert.equal(o.data.stages[0].unlocked, true);
        assert.equal(o.data.stages[1].unlocked, false);
        const s2 = await api('GET', '/me/stages/2');
        assert.equal(s2.status, 403);
        assert.equal(s2.data.code, 'stage-locked');
    });

    test('lesson 2 is locked until lesson 1 is passed', async () => {
        const r = await api('POST', '/me/lessons/2/session');
        assert.equal(r.status, 403);
    });

    test('answers are hidden before grading', async () => {
        const r = await api('POST', '/me/lessons/1/session');
        assert.equal(r.status, 200);
        for (const p of r.data.parts) for (const it of p.items) assert.equal(it.answer, undefined);
    });

    test('a wrong answer goes to the review queue', async () => {
        const r = await api('POST', '/me/lessons/1/session/answers', { itemId: 'l1-ep-em', response: 'ấm' });
        assert.equal(r.data.correct, false);
        const q = await api('GET', '/me/review/queue?scope=due');
        assert.ok(q.data.some((c) => c.itemId === 'l1-ep-em'));
    });

    test('completing every published lesson of stage 1 unlocks stage 2', async () => {
        await api('DELETE', '/me/lessons/1/session');
        const stage1 = await prisma.lesson.findMany({ where: { stageId: 1, published: true }, orderBy: { position: 'asc' }, include: { items: { include: { item: true } } } });
        let last;
        for (const l of stage1) {
            assert.equal((await api('POST', `/me/lessons/${l.id}/session`)).status, 200, `start lesson ${l.id}`);
            for (const li of l.items) {
                if (li.part === 'shadow') await api('POST', `/me/lessons/${l.id}/session/shadow`, { itemId: li.itemId, rating: 'good' });
                else await api('POST', `/me/lessons/${l.id}/session/answers`, { itemId: li.itemId, response: li.item.answer });
            }
            last = await api('POST', `/me/lessons/${l.id}/session/finish`);
            assert.equal(last.data.passed, true);
        }
        assert.equal(last.data.stageTransition?.from.id, 1);
        assert.equal(last.data.stageTransition?.to.unlocked, true);
        const s2 = await api('GET', '/me/stages/2');
        assert.equal(s2.status, 200);
        const s3 = await api('GET', '/me/stages/3');
        assert.equal(s3.status, 403, 'stage 3 stays locked while stage 2 has no content');
    });

    test('daily goal + overview stats', async () => {
        assert.equal((await api('PUT', '/me/goal', { goal: 20 })).data.goal, 20);
        assert.equal((await api('PUT', '/me/goal', { goal: 7 })).status, 400);
        const o = await api('GET', '/me/overview');
        assert.equal(o.data.stats.today.goal, 20);
        assert.ok(o.data.stats.today.answered > 0);
        assert.ok(o.data.badges.find((b) => b.id === 'khoi-dau').earned);
    });
});

describe('notebook + review + public', () => {
    test('save, favourite and remove a word', async () => {
        assert.equal((await api('POST', '/me/notebook', { type: 'word', ref: 'em' })).status, 201);
        assert.equal((await api('POST', '/me/notebook/word:em/favorite')).data.favorite, true);
        assert.equal((await api('GET', '/me/notebook')).data.length, 1);
        await api('DELETE', '/me/notebook/word:em');
        assert.equal((await api('GET', '/me/notebook')).data.length, 0);
    });
    test('review answer reschedules the card', async () => {
        const r = await api('POST', '/me/review/answers', { itemId: 'l1-ep-em', response: 'ếm' });
        assert.equal(r.data.correct, true);
        assert.equal(r.data.box, 2);
    });
    test('public trial lesson works without an account', async () => {
        const t = await api('GET', '/content/trial', null, false);
        assert.equal(t.status, 200);
        const a = await api('POST', '/content/trial/answers', { itemId: 'l1-ep-em', response: 'ếm' }, false);
        assert.equal(a.data.correct, true);
    });
    test('AI and speech report disabled cleanly when not configured', async () => {
        const meta = await api('GET', '/meta', null, false);
        if (!meta.data.ai) assert.equal((await api('POST', '/ai/chat', { messages: [{ role: 'user', text: 'hi' }] })).status, 503);
    });
});

describe('account', () => {
    const e = `acc-${Date.now()}@test.local`;
    let t1;
    const as = (tok) => async (method, path, body) => {
        const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: body ? JSON.stringify(body) : undefined });
        return { status: res.status, data: await res.json() };
    };
    /** Plants a known OTP the same way the service hashes it. */
    async function plantOtp(email, purpose, code) {
        await prisma.otpCode.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
        const codeHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${email}|${purpose}|${code}`).digest('hex');
        await prisma.otpCode.create({ data: { email, purpose, codeHash, expiresAt: new Date(Date.now() + 60_000) } });
    }
    const pause = () => new Promise((r) => setTimeout(r, 1100)); // JWT iat has second precision

    test('confirming the OTP signs the learner in', async () => {
        assert.equal((await api('POST', '/auth/register', { name: 'Tài Khoản', email: e, password: 'Abcd1234' }, false)).status, 201);
        await plantOtp(e, 'verify', '123456');
        const v = await api('POST', '/auth/otp/verify', { email: e, purpose: 'verify', code: '123456' }, false);
        assert.equal(v.status, 200);
        assert.ok(v.data.token);
        assert.equal(v.data.user.email, e);
        t1 = v.data.token;
        const me = await as(t1)('GET', '/auth/me');
        assert.equal(me.data.hasPassword, true);
        assert.equal(me.data.verified, true);
    });

    test('a verified email cannot be registered again', async () => {
        const r = await api('POST', '/auth/register', { name: 'Kẻ Khác', email: e, password: 'Abcd1234' }, false);
        assert.equal(r.status, 400);
        assert.equal(r.data.code, 'email-taken');
    });

    test('rename', async () => {
        assert.equal((await as(t1)('PATCH', '/auth/me', { name: 'A' })).status, 400);
        const r = await as(t1)('PATCH', '/auth/me', { name: '  Bùi Thị Hoa ' });
        assert.equal(r.data.name, 'Bùi Thị Hoa');
    });

    test('changing the password needs the current one and signs out older sessions', async () => {
        assert.equal((await as(t1)('POST', '/auth/password/change', { currentPassword: 'wrong', newPassword: 'Newpass123' })).data.code, 'bad-password');
        assert.equal((await as(t1)('POST', '/auth/password/change', { currentPassword: 'Abcd1234', newPassword: 'Abcd1234' })).data.code, 'same-password');
        await pause();
        const r = await as(t1)('POST', '/auth/password/change', { currentPassword: 'Abcd1234', newPassword: 'Newpass123' });
        assert.equal(r.status, 200);
        assert.equal((await as(t1)('GET', '/auth/me')).status, 401, 'old token is rejected');
        assert.equal((await as(r.data.token)('GET', '/auth/me')).status, 200, 'fresh token works');
        assert.equal((await api('POST', '/auth/login', { email: e, password: 'Abcd1234' }, false)).status, 401);
        t1 = (await api('POST', '/auth/login', { email: e, password: 'Newpass123' }, false)).data.token;
        assert.ok(t1);
    });

    test('password reset: OTP, new password, and the reset token is single use', async () => {
        await plantOtp(e, 'reset', '654321');
        const v = await api('POST', '/auth/otp/verify', { email: e, purpose: 'reset', code: '654321' }, false);
        assert.ok(v.data.resetToken);
        await pause();
        assert.equal((await api('POST', '/auth/password/reset', { resetToken: v.data.resetToken, password: 'Reset1234' }, false)).status, 200);
        assert.equal((await api('POST', '/auth/password/reset', { resetToken: v.data.resetToken, password: 'Again1234' }, false)).data.code, 'reset-expired');
        assert.equal((await as(t1)('GET', '/auth/me')).status, 401, 'sessions opened before the reset are closed');
        t1 = (await api('POST', '/auth/login', { email: e, password: 'Reset1234' }, false)).data.token;
        assert.ok(t1);
    });

    test('delete account needs the password and removes everything', async () => {
        await as(t1)('POST', '/me/notebook', { type: 'word', ref: 'em' });
        assert.equal((await as(t1)('DELETE', '/auth/me', { password: 'nope' })).status, 400);
        assert.equal((await as(t1)('DELETE', '/auth/me', { password: 'Reset1234' })).status, 200);
        assert.equal(await prisma.user.count({ where: { email: e } }), 0);
        assert.equal((await as(t1)('GET', '/auth/me')).status, 401);
    });

    test('meta lists what the server has configured', async () => {
        const m = (await api('GET', '/meta', null, false)).data;
        for (const k of ['ai', 'speech', 'mail', 'emailVerification', 'passwordReset', 'googleClientId']) assert.ok(k in m, k);
    });
});

describe('answer options are shuffled', () => {
    const C = { ITEMS };
    const choiceIds = Object.keys(ITEMS).filter((id) => Array.isArray(ITEMS[id].options));
    const sorted = (a) => [...a].sort();

    test('same options, never the answer key itself', () => {
        for (const id of choiceIds) {
            const pub = publicItem(C, id, 'seed');
            assert.deepEqual(sorted(pub.options), sorted(ITEMS[id].options), id);
            assert.equal(pub.answer, undefined);
        }
    });
    test('stable within a session, different across sessions', () => {
        const id = choiceIds[0];
        assert.deepEqual(publicItem(C, id, 'user:1').options, publicItem(C, id, 'user:1').options);
        const orders = new Set(Array.from({ length: 40 }, (_, i) => publicItem(C, id, `user:${i}`).options.join('|')));
        assert.ok(orders.size > 5, `only ${orders.size} distinct orders`);
    });
    test('the right answer is not parked on "A"', () => {
        for (const id of choiceIds) {
            const first = Array.from({ length: 400 }, (_, i) => publicItem(C, id, `s${i}`).options[0] === ITEMS[id].answer).filter(Boolean).length;
            const expected = 400 / ITEMS[id].options.length;
            assert.ok(Math.abs(first - expected) < expected * 0.5, `${id}: answer first ${first}/400 times`);
        }
        // unseeded (trial / review) is random too
        const id = choiceIds[0];
        assert.ok(new Set(Array.from({ length: 40 }, () => publicItem(C, id).options.join('|'))).size > 5);
    });
    test('a started lesson serves shuffled options that still grade correctly', async () => {
        await api('DELETE', '/me/lessons/1/session');
        const r = await api('POST', '/me/lessons/1/session');
        const it = r.data.parts.flatMap((p) => p.items).find((x) => x.id === 'l1-ep-em');
        assert.deepEqual(sorted(it.options), sorted(ITEMS['l1-ep-em'].options));
        const again = await api('POST', '/me/lessons/1/session');
        assert.deepEqual(again.data.parts.flatMap((p) => p.items).find((x) => x.id === 'l1-ep-em').options, it.options, 'order survives a resume');
        const a = await api('POST', '/me/lessons/1/session/answers', { itemId: 'l1-ep-em', response: ITEMS['l1-ep-em'].answer });
        assert.equal(a.data.correct, true);
        await api('DELETE', '/me/lessons/1/session');
    });
});

describe('Google ID token verification', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
    const loadKeys = async () => ({ keys: [jwk], maxAge: 60 });
    const sign = (claims, opts = {}) =>
        jwt.sign({ sub: '1234567890', email: 'Hoa@Example.com', email_verified: true, name: 'Hoa Bùi', ...claims }, opts.key ?? privateKey, {
            algorithm: 'RS256',
            keyid: opts.kid ?? 'test-key',
            audience: opts.aud ?? 'my-client-id',
            issuer: opts.iss ?? 'https://accounts.google.com',
            expiresIn: opts.exp ?? '5m',
        });

    test('accepts a valid token', async () => {
        resetGoogleKeyCache();
        const g = await verifyGoogleIdToken(sign(), 'my-client-id', { loadKeys });
        assert.deepEqual(g, { sub: '1234567890', email: 'hoa@example.com', name: 'Hoa Bùi' });
    });
    test('rejects wrong audience, issuer, expiry, signer and unverified email', async () => {
        const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
        const bad = [sign({}, { aud: 'someone-else' }), sign({}, { iss: 'https://evil.example' }), sign({}, { exp: '-1m' }), sign({}, { key: other }), sign({ email_verified: false }), sign({}, { kid: 'unknown' }), 'not-a-jwt'];
        for (const tok of bad) await assert.rejects(verifyGoogleIdToken(tok, 'my-client-id', { loadKeys }));
    });
    test('the endpoint reports "disabled" when no client id is configured', async () => {
        if (process.env.GOOGLE_CLIENT_ID) return;
        const r = await api('POST', '/auth/google', { credential: 'x'.repeat(40) }, false);
        assert.equal(r.status, 503);
        assert.equal(r.data.code, 'google-disabled');
    });
});
