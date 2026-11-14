import test from 'node:test';
import assert from 'node:assert/strict';
import { auth, learning, review } from '../src/services/api.js';

test('learning client sends the rendered content version and review presentation token', async () => {
    const original = { fetch: globalThis.fetch, window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
    const calls = [];
    const storage = { getItem: () => null, removeItem: () => {}, setItem: () => {} };
    try {
        globalThis.window = new EventTarget();
        globalThis.localStorage = storage;
        globalThis.sessionStorage = storage;
        auth.currentSession();
        globalThis.fetch = async (url, options) => {
            calls.push({ url, body: JSON.parse(options.body) });
            return Response.json({ ok: true });
        };
        await learning.answer(1, 'q', 'answer', 'rendered-version');
        await learning.rateShadow(1, 's', 'good', 'rendered-version');
        await learning.finishLesson(1, 'rendered-version');
        await review.answer('q', 'answer', 'presentation-token');
        for (const call of calls.slice(0, 3)) assert.equal(call.body.contentVersion, 'rendered-version');
        assert.equal(calls[3].body.reviewToken, 'presentation-token');
    } finally {
        Object.assign(globalThis, original);
    }
});

test('AI tutor sends only lesson/item ids as context, never the label or other text', async () => {
    const { askTutor } = await import('../src/services/ai/tutor.js');
    const original = { fetch: globalThis.fetch, window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
    const bodies = [];
    const storage = { getItem: () => null, removeItem: () => {}, setItem: () => {} };
    const sse = 'data: {"candidates":[{"content":{"parts":[{"text":"Chào"}]},"finishReason":"STOP"}]}\n\nevent: muonglab-complete\ndata: {}\n\n';
    try {
        globalThis.window = new EventTarget();
        globalThis.localStorage = storage;
        globalThis.sessionStorage = storage;
        auth.currentSession();
        globalThis.fetch = async (_url, options) => {
            bodies.push(JSON.parse(options.body));
            return new Response(sse, { headers: { 'Content-Type': 'text/event-stream' } });
        };
        const q = [{ role: 'user', text: 'Vì sao sai?' }];
        assert.equal(await askTutor(q, { context: { lessonId: 1, itemId: 'l1-ep-em', label: 'Bài 1 · câu 1/7', answer: 'ếm' } }), 'Chào');
        assert.deepEqual(bodies[0].context, { lessonId: 1, itemId: 'l1-ep-em' });
        await askTutor(q, { context: { label: 'chỉ có nhãn' } });
        await askTutor(q);
        assert.equal(bodies[1].context, undefined);
        assert.equal(bodies[2].context, undefined);
    } finally {
        Object.assign(globalThis, original);
    }
});
