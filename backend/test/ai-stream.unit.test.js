import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiStreamState, shouldRefund } from '../src/modules/ai/stream.js';
import { tutorHistory } from '../../frontend/src/services/ai/history.js';
import { readTutorStream } from '../../frontend/src/services/ai/stream.js';
import { auth, request, SESSION_KEY } from '../../frontend/src/services/api.js';

const encoder = new TextEncoder();
const frame = (json) => `data: ${JSON.stringify(json)}\n\n`;
const candidate = (text, finishReason) => ({ candidates: [{ content: { parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }] });
const completed = 'event: muonglab-complete\ndata: {}\n\n';
const original = { fetch: globalThis.fetch, window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };

function storage() {
    const data = new Map();
    return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
beforeEach(() => {
    globalThis.window = new EventTarget();
    globalThis.localStorage = storage();
    globalThis.sessionStorage = storage();
    auth.currentSession();
});
afterEach(() => { Object.assign(globalThis, original); });

test('history retains complete recent turns within backend limits, without truncating text', () => {
    const messages = [];
    for (let i = 0; i < 20; i++) messages.push({ role: 'user', text: `question ${i}` }, { role: 'model', text: `answer ${i}` });
    messages.push({ role: 'user', text: 'latest question' });
    const history = tutorHistory(messages);
    assert.equal(history.length, 29);
    assert.deepEqual(history.at(-1), { role: 'user', text: 'latest question' });
    assert.equal(history[0].role, 'user');
    const longReply = [{ role: 'user', text: 'old' }, { role: 'model', text: 'x'.repeat(2001) }, { role: 'user', text: 'new' }];
    assert.deepEqual(tutorHistory(longReply), [{ role: 'user', text: 'new' }]);
    assert.throws(() => tutorHistory([{ role: 'user', text: 'x'.repeat(2001) }]));
});

test('cancelled/unfinished model messages are not fed back as completed context', () => {
    assert.deepEqual(tutorHistory([{ role: 'user', text: 'old' }, { role: 'model', text: 'partial', incomplete: true }, { role: 'user', text: 'new' }]), [{ role: 'user', text: 'new' }]);
});

test('backend accepts a fully framed STOP answer across arbitrary UTF-8 chunk boundaries', () => {
    const state = new GeminiStreamState();
    const bytes = encoder.encode(frame(candidate('ếm', 'STOP')).replaceAll('\n', '\r\n'));
    for (const byte of bytes) state.push(new Uint8Array([byte]));
    state.finish();
    assert.equal(state.complete, true);
    assert.equal(state.hasText, true);
});

test('backend rejects provider errors, safety blocks, truncation, empty and cut streams', () => {
    for (const json of [{ error: { message: 'provider failure' } }, { promptFeedback: { blockReason: 'SAFETY' } }, candidate('partial', 'MAX_TOKENS')]) {
        const state = new GeminiStreamState();
        assert.throws(() => state.push(encoder.encode(frame(json))), /AI|trợ lý/);
    }
    for (const raw of ['', frame(candidate('partial')), frame(candidate('', 'STOP')), 'data: {']) {
        const state = new GeminiStreamState();
        state.push(encoder.encode(raw));
        assert.throws(() => state.finish(), { code: 'ai-incomplete' });
    }
});

test('quota refund distinguishes empty cancellation from cancellation after delivered text', () => {
    assert.equal(shouldRefund({ hasText: false }, true), true);
    assert.equal(shouldRefund({ hasText: true }, true), false);
    assert.equal(shouldRefund({ hasText: true }, false), true);
});

test('client accepts STOP only with proxy completion and rejects partial/error responses', async () => {
    const tokens = [];
    assert.equal(await readTutorStream(new Response(frame(candidate('ếm', 'STOP')) + completed), { onToken: (text) => tokens.push(text) }), 'ếm');
    assert.deepEqual(tokens, ['ếm']);
    for (const raw of [frame(candidate('partial')), frame(candidate('partial', 'STOP')), frame(candidate('partial', 'MAX_TOKENS')) + completed, frame(candidate('', 'STOP')) + completed, 'data: {bad}\n\n']) {
        await assert.rejects(readTutorStream(new Response(raw)), { code: 'ai-incomplete' });
    }
    await assert.rejects(readTutorStream(new Response('event: muonglab-error\ndata: {"message":"Failed","code":"ai-upstream"}\n\n')), { code: 'ai-upstream' });
});

test('raw request can be cancelled after response headers and cancels the body', async () => {
    let cancelled = false;
    let upstreamSignal;
    globalThis.fetch = async (_url, options) => {
        upstreamSignal = options.signal;
        return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    };
    const ctrl = new AbortController();
    const response = await request('POST', '/ai/chat', { auth: false, raw: true, signal: ctrl.signal, timeout: 5000 });
    const reader = response.body.getReader();
    const pending = reader.read();
    ctrl.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(upstreamSignal.aborted, true);
    assert.equal(cancelled, true);
});

test('raw timeout covers stalled response body after successful headers', async () => {
    globalThis.fetch = async () => new Response(new ReadableStream());
    const response = await request('POST', '/ai/chat', { auth: false, raw: true, timeout: 15 });
    await assert.rejects(response.body.getReader().read(), { status: 408 });
});

test('JSON timeout also covers a slow body', async () => {
    globalThis.fetch = async (_url, options) => new Response(new ReadableStream({
        start(controller) { options.signal.addEventListener('abort', () => controller.error(options.signal.reason), { once: true }); },
    }));
    await assert.rejects(request('GET', '/slow', { auth: false, timeout: 15 }), { status: 408 });
});

test('a signal cancelled before request is already aborted at fetch', async () => {
    globalThis.fetch = async (_url, options) => { assert.equal(options.signal.aborted, true); throw options.signal.reason; };
    const ctrl = new AbortController();
    ctrl.abort();
    await assert.rejects(request('GET', '/cancelled', { auth: false, signal: ctrl.signal }), { name: 'AbortError' });
});

test('a late 401 from an old session cannot erase a new account', async () => {
    const first = { token: 'first-token', user: { id: 'first' } };
    const second = { token: 'second-token', user: { id: 'second' } };
    localStorage.setItem(SESSION_KEY, JSON.stringify(first));
    auth.currentSession();
    let resolve;
    globalThis.fetch = () => new Promise((done) => { resolve = done; });
    const pending = request('GET', '/old');
    localStorage.setItem(SESSION_KEY, JSON.stringify(second));
    resolve(new Response('{}', { status: 401 }));
    await assert.rejects(pending, { code: 'session-changed' });
    assert.equal(JSON.parse(localStorage.getItem(SESSION_KEY)).user.id, 'second');
});

test('requests are rejected before fetch when another tab changed the account', async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'first-token', user: { id: 'first' } }));
    auth.currentSession();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'second-token', user: { id: 'second' } }));
    globalThis.fetch = async () => { assert.fail('must not issue a request for another account'); };
    await assert.rejects(request('GET', '/other-account'), { code: 'session-changed' });
});
