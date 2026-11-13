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
