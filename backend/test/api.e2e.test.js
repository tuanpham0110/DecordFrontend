/**
 * End-to-end API test against a real database (uses DATABASE_URL from .env).
 *   npm test
 * Creates a throw-away user and deletes it afterwards.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

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
