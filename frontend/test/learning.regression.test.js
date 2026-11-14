import test from 'node:test';
import assert from 'node:assert/strict';
import { answerFeedback, normalizeAnswer, pickRound, resumeLabel } from '../src/utils/learning.js';

test('typed drill answers ignore case, spacing and final punctuation but keep tone marks', () => {
    assert.equal(normalizeAnswer('  Mặt   TLĂNG '), normalizeAnswer('mặt tlăng'));
    assert.equal(normalizeAnswer('Nhà ja chiếm từ con cúi chẵng ?'), normalizeAnswer('Nhà ja chiếm từ con cúi chẵng?'));
    assert.equal(normalizeAnswer('mốch, hal, pa, pổn'), normalizeAnswer('mốch hal pa pổn'));
    // decomposed input (some keyboards) equals the precomposed form
    assert.equal(normalizeAnswer('pổn'.normalize('NFD')), normalizeAnswer('pổn'));
    assert.notEqual(normalizeAnswer('pon'), normalizeAnswer('pổn'));
    assert.notEqual(normalizeAnswer('ấm'), normalizeAnswer('ếm'));
});

test('drill rounds put the most-missed entries first and never repeat an entry', () => {
    const entries = [{ id: 'a', weak: 0 }, { id: 'b', weak: 3 }, { id: 'c', weak: 1 }, { id: 'd', weak: 0 }];
    const round = pickRound(entries, 3);
    assert.deepEqual(round.slice(0, 2).map((e) => e.id), ['b', 'c']);
    assert.equal(new Set(round.map((e) => e.id)).size, 3);
    assert.equal(pickRound(entries, 10).length, 4);
});
import { hookHarness, nodes, textOf } from './helpers/hooks.js';

const cards = [{ id: 'a', word: 'a', meaning: 'A' }, { id: 'b', word: 'b', meaning: 'B' }];
const mocks = {
    '../ui.jsx': { Button: 'Button', Progress: 'Progress' },
    '../Icon.jsx': { __esModule: true, default: 'Icon' },
    './AudioPlayer.jsx': { __esModule: true, default: 'AudioPlayer' },
};
const button = (tree, label) => nodes(tree, (n) => n.props.onClick && (textOf(n) === label || n.props['aria-label'] === label))[0];

test('retry feedback restores latest correctness without overwriting first-try score', () => {
    const record = { correct: false, retryCorrect: true, answer: 'answer' };
    assert.equal(answerFeedback(record).correct, true);
    assert.equal(record.correct, false);
    assert.equal(answerFeedback({ correct: true, retryCorrect: false }).correct, false);
});

test('resume distinguishes unanswered and completed sessions without N+1/N', () => {
    assert.match(resumeLabel({ done: 1, total: 7, part: 'listen' }), /2\/7/);
    assert.match(resumeLabel({ done: 7, total: 7 }), /7\/7/);
    assert.doesNotMatch(resumeLabel({ done: 7, total: 7 }), /8\/7/);
});

test('flashcards count unique known cards when revisiting and reset on shuffle', async () => {
    const h = hookHarness('../../src/components/learn/Flashcards.jsx', mocks);
    const props = { cards, onMark: async () => {} };
    h.render(props);
    await button(h.render(props), 'Đã nhớ').props.onClick();
    button(h.render(props), 'Thẻ trước').props.onClick();
    await button(h.render(props), 'Đã nhớ').props.onClick();
    await button(h.render(props), 'Đã nhớ').props.onClick();
    assert.match(textOf(h.render(props)), /2\/2 thẻ/);
    button(h.render(props), 'Trộn và ôn lại').props.onClick();
    await button(h.render(props), 'Đã nhớ').props.onClick();
    button(h.render(props), 'Trộn thẻ').props.onClick();
    await button(h.render(props), 'Đã nhớ').props.onClick();
    await button(h.render(props), 'Đã nhớ').props.onClick();
    assert.match(textOf(h.render(props)), /2\/2 thẻ/);
    h.unmount();
});

test('flashcards keep current card and show API failure, then permit retry', async () => {
    let fail = true;
    const h = hookHarness('../../src/components/learn/Flashcards.jsx', mocks);
    const props = { cards, onMark: async () => { if (fail) throw new Error('offline'); } };
    h.render(props);
    await button(h.render(props), 'Đã nhớ').props.onClick();
    assert.match(textOf(h.render(props)), /Thẻ 1\/2/);
    assert.equal(textOf(nodes(h.render(props), (n) => n.props.role === 'alert')), 'offline');
    fail = false;
    await button(h.render(props), 'Đã nhớ').props.onClick();
    assert.match(textOf(h.render(props)), /Thẻ 2\/2/);
    h.unmount();
});

test('flashcards only persist once while a mark is pending', async () => {
    let release;
    let calls = 0;
    const h = hookHarness('../../src/components/learn/Flashcards.jsx', mocks);
    const props = { cards, onMark: () => { calls++; return new Promise((resolve) => { release = resolve; }); } };
    h.render(props);
    const click = button(h.render(props), 'Đã nhớ').props.onClick;
    const pending = click();
    await click();
    assert.equal(calls, 1);
    button(h.render(props), 'Trộn thẻ').props.onClick();
    release();
    await pending;
    assert.match(textOf(h.render(props)), /Thẻ 2\/2/);
    h.unmount();
});

test('late microphone permission after unmount or reset releases tracks without recording', async () => {
    for (const action of ['unmount', 'reset']) {
        let grant;
        let stopped = 0;
        let started = 0;
        class Recorder { start() { started++; } }
        const h = hookHarness('../../src/hooks/useRecorder.js', {}, {
            navigator: { mediaDevices: { getUserMedia: () => new Promise((resolve) => { grant = resolve; }) } },
            window: { MediaRecorder: Recorder }, MediaRecorder: Recorder,
        });
        const rec = h.render({});
        const pending = rec.start();
        if (action === 'unmount') h.unmount();
        else rec.reset();
        grant({ getTracks: () => [{ stop: () => { stopped++; } }] });
        await pending;
        assert.equal(stopped, 1, action);
        assert.equal(started, 0, action);
        h.unmount();
    }
});
