import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

// Exercise the component's asynchronous state transitions with deterministic hooks, no browser/network.
const frontendRequire = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { transformSync } = frontendRequire('esbuild');
const source = fs.readFileSync(new URL('../../frontend/src/components/ChatBox.jsx', import.meta.url), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replaceAll('import.meta.env.DEV', 'false').replace(/^export /gm, '').replace('default function ChatBox', 'function ChatBox');
const compiled = transformSync(source, { loader: 'jsx', jsxFactory: 'h', jsxFragment: 'Fragment', target: 'es2022' }).code;
const build = new Function('useCallback', 'useEffect', 'useRef', 'useState', 'askTutor', 'STORE_KEY', 'useMeta', 'h', 'Fragment', 'Icon', 'sessionStorage', `${compiled}\nreturn ChatBox;`);
const tick = () => new Promise((resolve) => setImmediate(resolve));

function harness() {
    const values = [];
    let cursor = 0;
    const calls = [];
    const useState = (initial) => {
        const index = cursor++;
        if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
        return [values[index], (next) => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
    };
    const useRef = (initial) => {
        const index = cursor++;
        values[index] ??= { current: initial };
        return values[index];
    };
    const askTutor = (history, options) => new Promise((resolve, reject) => calls.push({ history, options, resolve, reject }));
    const h = (type, props, ...children) => ({ type, props: { ...props, children } });
    const Component = build((fn) => fn, () => {}, useRef, useState, askTutor, 'test-chat', () => ({ ai: true }), h, 'fragment', 'Icon', { getItem: () => null });
    const render = () => { cursor = 0; return Component(); };
    const find = (node, predicate) => {
        if (node == null || typeof node !== 'object') return null;
        if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
        return predicate(node) ? node : find(node.props?.children, predicate);
    };
    const by = (key, value) => find(render(), (node) => node.props?.[key] === value);
    by('aria-label', 'Mở trợ lý AI').props.onClick();
    const submit = (text) => {
        by('aria-label', 'Nhập câu hỏi').props.onChange({ target: { value: text } });
        const form = find(render(), (node) => node.type === 'form');
        form.props.onSubmit({ preventDefault() {} });
        return form;
    };
    return { calls, by, submit, messages: () => values[1] };
}

test('chat reset ignores late tokens and completion from the previous conversation', async () => {
    const app = harness();
    app.submit('old question');
    app.calls[0].options.onToken('old partial');
    app.by('aria-label', 'Cuộc trò chuyện mới').props.onClick();
    assert.equal(app.calls[0].options.signal.aborted, true);
    app.submit('new question');
    app.calls[0].options.onToken('late old response');
    app.calls[0].resolve('old response');
    await tick();
    assert.ok(app.by('aria-label', 'Dừng trả lời'), 'old finally must not clear new loading state');
    assert.equal(app.messages().some((m) => m.text.includes('old')), false);
    app.calls[1].options.onToken('new response');
    app.calls[1].resolve('new response');
    await tick();
    assert.equal(app.messages().at(-1).text, 'new response');
    assert.equal(app.messages().at(-1).pending, undefined);
});

test('chat blocks duplicate submits synchronously before a rerender', async () => {
    const app = harness();
    const form = app.submit('question');
    form.props.onSubmit({ preventDefault() {} });
    assert.equal(app.calls.length, 1);
    app.calls[0].options.onToken('answer');
    app.calls[0].resolve('answer');
    await tick();
});

test('stopping keeps partial text marked incomplete instead of completed context', async () => {
    const app = harness();
    app.submit('question');
    app.calls[0].options.onToken('partial');
    app.by('aria-label', 'Dừng trả lời').props.onClick();
    app.calls[0].reject(app.calls[0].options.signal.reason);
    await tick();
    assert.equal(app.messages().at(-1).text, 'partial');
    assert.equal(app.messages().at(-1).incomplete, true);
});
