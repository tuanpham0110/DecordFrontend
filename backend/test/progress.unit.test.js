import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://unit:unit@127.0.0.1:1/unit_test';
process.env.JWT_SECRET = 'isolated-test-secret-at-least-32-characters';

const { ITEMS } = await import('../prisma/data/content.js');
const { XP, dayXp, focusLessons, longestStreakOf, scheduleCard, xpOf, BADGES } = await import('../src/modules/learning/rules.js');
const { tutorContext } = await import('../src/modules/ai/context.js');

const DAY = 86_400_000;

function content() {
    const lesson = { id: 1, stageId: 1, title: 'Làm quen', published: true, goals: ['Biết từ “ếm”'], parts: { listen: ['l1-ep-em'], build: ['l1-fill-em'], shadow: ['l1-sh-em'] } };
    return {
        STAGES: [{ id: 1, title: 'Chặng 1', lessons: [lesson] }],
        ITEMS: { 'l1-ep-em': ITEMS['l1-ep-em'], 'l1-fill-em': ITEMS['l1-fill-em'], 'l1-sh-em': ITEMS['l1-sh-em'] },
        VOCABULARY: [{ id: 'em', word: 'ếm', meaning: 'tôi', lessonId: 1 }],
        SENTENCES: [],
        PASS_THRESHOLD: 80,
    };
}

function state(over = {}) {
    return { goal: 10, daily: {}, lessons: {}, review: {}, attempts: [], partStats: { listen: { correct: 0, total: 0 }, build: { correct: 0, total: 0 } }, reviewDone: 0, ...over };
}

test('XP is capped per day, rewards a reached goal and counts each passed lesson once', () => {
    const data = state({
        daily: { '2026-11-10': { answered: 200, correct: 180 }, '2026-11-11': { answered: 4, correct: 3 } },
        lessons: { 1: { passed: true, attempts: 5 }, 2: { passed: false, attempts: 2 } },
    });
    assert.equal(dayXp(data.daily['2026-11-10'], 10), XP.dailyCap + XP.goalMet);
    assert.equal(dayXp(data.daily['2026-11-11'], 10), 3);
    assert.equal(xpOf(data), XP.dailyCap + XP.goalMet + 3 + XP.lessonPassed);
    // a negative correct delta (rating edited the next day) never subtracts XP below zero for that day
    assert.equal(dayXp({ answered: 0, correct: -1 }, 10), 0);
});

test('longest streak survives a break and ignores days without answers', () => {
    const data = state({
        daily: {
            '2026-11-01': { answered: 3, correct: 1 },
            '2026-11-02': { answered: 1, correct: 1 },
            '2026-11-03': { answered: 2, correct: 0 },
            '2026-11-04': { answered: 0, correct: 0 },
            '2026-11-05': { answered: 5, correct: 5 },
            // month boundary counts as consecutive
            '2026-10-31': { answered: 1, correct: 1 },
        },
    });
    assert.equal(longestStreakOf(data), 4);
    assert.equal(BADGES.find((b) => b.id === 'kien-tri').test(data), true);
    assert.equal(BADGES.find((b) => b.id === 'ben-bi').test(data), false);
});

test('early correct review keeps the schedule, due correct review moves up, wrong resets', () => {
    const now = Date.UTC(2026, 10, 14);
    const base = { box: 2, right: 1, wrong: 1, mastered: false, lastCorrect: true };
    const early = scheduleCard({ ...base, due: now + DAY }, true, now);
    assert.deepEqual([early.box, early.due, early.right], [2, now + DAY, 1]);
    const due = scheduleCard({ ...base, due: now - 1 }, true, now);
    assert.deepEqual([due.box, due.due, due.right], [3, now + 3 * DAY, 2]);
    const wrong = scheduleCard({ ...base, due: now + DAY }, false, now);
    assert.deepEqual([wrong.box, wrong.due, wrong.wrong], [1, now, 2]);
});

test('focus lists lessons with open review cards first, then failed attempts', () => {
    const C = content();
    const now = Date.now();
    const data = state({
        review: {
            'l1-ep-em': { itemId: 'l1-ep-em', lessonId: 1, wrong: 3, mastered: false, due: now - 1 },
            'l1-fill-em': { itemId: 'l1-fill-em', lessonId: 1, wrong: 1, mastered: true, due: null },
        },
        lessons: { 1: { best: 60, passed: false, attempts: 2 } },
    });
    const [f] = focusLessons(C, data, now);
    assert.deepEqual({ id: f.lessonId, open: f.open, due: f.due, wrong: f.wrong, best: f.best }, { id: 1, open: 1, due: 1, wrong: 3, best: 60 });
});

function fakeDb({ session = null, card = null, progress = null } = {}) {
    return {
        lessonSession: { findUnique: async () => session },
        reviewCard: { findUnique: async () => card },
        lessonProgress: { findUnique: async () => progress },
    };
}

test('AI context never contains the answer of an exercise the learner has not answered', async () => {
    const C = content();
    const text = await tutorContext(C, 'u1', { lessonId: 1, itemId: 'l1-fill-em' }, fakeDb());
    assert.match(text, /CHƯA trả lời/);
    assert.match(text, /___/);
    assert.doesNotMatch(text, /Đáp án đúng/);
    // the fill item's audio text is the answer itself
    assert.doesNotMatch(text, /Âm thanh phát ra/);
    assert.doesNotMatch(text, new RegExp(ITEMS['l1-fill-em'].translation));
});

test('AI context explains an answered exercise with the learner’s own first response', async () => {
    const C = content();
    const session = { answers: { 'l1-ep-em': { firstResponse: 'ấm', response: 'ếm', correct: false, attempts: 2 } }, shadow: {} };
    const text = await tutorContext(C, 'u1', { lessonId: 1, itemId: 'l1-ep-em' }, fakeDb({ session }));
    assert.match(text, /Đáp án đúng: “ếm”/);
    assert.match(text, /lần đầu: “ấm” \(sai\)/);
    assert.match(text, /Lần trả lời gần nhất: “ếm”/);
    // a finished attempt of the lesson or an open review card also counts as answered
    assert.match(await tutorContext(C, 'u1', { itemId: 'l1-ep-em' }, fakeDb({ progress: { attempts: 1 } })), /Đáp án đúng/);
    assert.match(await tutorContext(C, 'u1', { itemId: 'l1-ep-em' }, fakeDb({ card: { wrong: 1 } })), /Đáp án đúng/);
});

test('AI context ignores unknown ids and a lesson id that does not contain the item', async () => {
    const C = content();
    assert.equal(await tutorContext(C, 'u1', { itemId: 'nope' }, fakeDb()), null);
    assert.equal(await tutorContext(C, 'u1', { lessonId: 99 }, fakeDb()), null);
    const lessonOnly = await tutorContext(C, 'u1', { lessonId: 1 }, fakeDb());
    assert.match(lessonOnly, /Bài 1: Làm quen/);
    assert.match(lessonOnly, /“ếm” = “tôi”/);
});
