import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

function dedicatedTestDatabase(value) {
    try {
        const url = new URL(value);
        return ['postgres:', 'postgresql:'].includes(url.protocol) && /(?:^|[_-])test$/i.test(url.pathname.slice(1));
    } catch {
        return false;
    }
}

if (process.env.RUN_DB_TESTS !== 'true' || !dedicatedTestDatabase(process.env.TEST_DATABASE_URL)) {
    test('AI database regression requires explicit opt-in and a dedicated *_test DB', { skip: true }, () => {});
} else {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    // This value is a test fixture. External requests are intercepted below and never leave this process.
    process.env.GEMINI_API_KEY = 'isolated-regression-placeholder';
    process.env.GEMINI_MODEL = 'isolated-regression-model';
    process.env.GEMINI_FALLBACK_MODELS = '';
    process.env.AI_DAILY_LIMIT = '100';
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SPEECH_API_URL', 'GOOGLE_CLIENT_ID', 'MICROSOFT_CLIENT_ID']) delete process.env[key];

    const { prisma } = await import('../src/lib/prisma.js');
    const { createApp } = await import('../src/app.js');
    const { signAccess } = await import('../src/lib/jwt.js');
    const { dayKey } = await import('../src/lib/time.js');
    const realFetch = globalThis.fetch;
    const ownedIds = [];
    const encoder = new TextEncoder();
    const frame = (json) => `data: ${JSON.stringify(json)}\n\n`;
    const candidate = (text, finishReason) => ({ candidates: [{ content: { parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }] });
    let provider;
    let server;
    let base;

    before(async () => {
        globalThis.fetch = async (input, options) => {
            const url = new URL(typeof input === 'string' ? input : input.url);
            assert.equal(url.origin, 'https://generativelanguage.googleapis.com', 'unexpected outgoing network request');
            assert.equal(options.headers['x-goog-api-key'], 'isolated-regression-placeholder');
            assert.ok(provider, 'test must provide a Gemini response');
            return provider(options);
        };
        server = createApp().listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        base = `http://127.0.0.1:${server.address().port}/api`;
    });

    after(async () => {
        globalThis.fetch = realFetch;
        server?.closeAllConnections();
        if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        try { await prisma.user.deleteMany({ where: { id: { in: ownedIds } } }); }
        finally { await prisma.$disconnect(); }
    });

    async function fixture() {
        const user = await prisma.user.create({ data: { email: `ai-db-${crypto.randomUUID()}@test.local`, name: 'AI route regression', passwordHash: 'test-fixture-no-login', verified: true } });
        ownedIds.push(user.id);
        return { userId: user.id, token: signAccess(user, false) };
    }
    function chat(token, signal) {
        return realFetch(`${base}/ai/chat`, {
            method: 'POST', signal,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', text: 'Explain the learning rules.' }] }),
        });
    }
    async function quota(userId) {
        return (await prisma.aiUsage.findUnique({ where: { userId_day: { userId, day: dayKey() } } }))?.count ?? 0;
    }

    test('AI route + PostgreSQL: a complete answer emits completion and consumes one daily turn', async () => {
        const { userId, token } = await fixture();
        provider = () => new Response(frame(candidate('A complete test response.', 'STOP')));
        const response = await chat(token);
        const text = await response.text();
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /text\/event-stream/);
        assert.match(text, /event: muonglab-complete/);
        assert.doesNotMatch(text, /event: muonglab-error/);
        assert.equal(await quota(userId), 1);
    });

    test('AI route + PostgreSQL: partial EOF is an explicit SSE error and refunds the daily turn', async () => {
        const { userId, token } = await fixture();
        provider = () => new Response(frame(candidate('Only the first part.')));
        const response = await chat(token);
        const text = await response.text();
        assert.match(text, /Only the first part/);
        assert.match(text, /event: muonglab-error/);
        assert.match(text, /ai-incomplete/);
        assert.doesNotMatch(text, /event: muonglab-complete/);
        assert.equal(await quota(userId), 0);
    });

    test('AI route + PostgreSQL: empty STOP, safety blocks, truncation and invalid JSON refund quota', async () => {
        const cases = [
            [frame(candidate('', 'STOP')), 'ai-incomplete'],
            [frame({ promptFeedback: { blockReason: 'SAFETY' } }), 'ai-blocked'],
            [frame(candidate('Cut response.', 'MAX_TOKENS')), 'ai-incomplete'],
            ['data: {invalid-json}\n\n', 'ai-bad-response'],
        ];
        for (const [raw, code] of cases) {
            const { userId, token } = await fixture();
            provider = () => new Response(raw);
            const response = await chat(token);
            const text = await response.text();
            assert.equal(response.status, 200);
            assert.match(text, /event: muonglab-error/);
            assert.ok(text.includes(code), code);
            assert.doesNotMatch(text, /event: muonglab-complete/);
            assert.equal(await quota(userId), 0, code);
        }
    });

    test('AI route + PostgreSQL: unavailable provider returns an HTTP error without charging quota', async () => {
        const { userId, token } = await fixture();
        provider = () => new Response('test provider unavailable', { status: 503 });
        const response = await chat(token);
        assert.equal(response.status, 503);
        assert.equal((await response.json()).code, 'ai-busy');
        assert.equal(await quota(userId), 0);
    });

    async function cancelStream(initial, expectedCount) {
        const { userId, token } = await fixture();
        let upstreamSignal;
        let sawAbort;
        const aborted = new Promise((resolve) => { sawAbort = resolve; });
        provider = ({ signal }) => {
            upstreamSignal = signal;
            return new Response(new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(initial));
                    signal.addEventListener('abort', () => {
                        controller.error(signal.reason ?? new DOMException('Cancelled', 'AbortError'));
                        sawAbort();
                    }, { once: true });
                },
            }));
        };
        const ctrl = new AbortController();
        const response = await chat(token, ctrl.signal);
        const reader = response.body.getReader();
        assert.equal((await reader.read()).done, false);
        ctrl.abort();
        await reader.cancel().catch(() => {});
        await Promise.race([aborted, new Promise((_, reject) => {
            const timeout = setTimeout(() => reject(new Error('upstream was not cancelled')), 2000);
            timeout.unref();
        })]);
        assert.equal(upstreamSignal.aborted, true);
        const deadline = Date.now() + 2000;
        while ((await quota(userId)) !== expectedCount && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(await quota(userId), expectedCount);
    }

    test('AI route + PostgreSQL: cancellation after headers reaches provider; empty reply is refunded', async () => {
        await cancelStream(': keepalive\n\n', 0);
    });

    test('AI route + PostgreSQL: cancellation after delivered text counts one turn', async () => {
        await cancelStream(frame(candidate('Delivered partial response.')), 1);
    });
}
