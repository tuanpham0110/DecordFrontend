import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// This suite replaces every database method it uses and never reads backend/.env.
process.env.DATABASE_URL = 'postgresql://offline:offline@127.0.0.1:1/muonglab_test';
process.env.JWT_SECRET = 'offline-learning-test-key-not-a-real-secret-12345';
process.env.NODE_ENV = 'test';

const { prisma } = await import('../src/lib/prisma.js');
const { learningService } = await import('../src/modules/learning/learning.service.js');
const { reviewService } = await import('../src/modules/review/review.service.js');
const { invalidateContent } = await import('../src/modules/content/content.service.js');
const { CONTENT_VERSION, contentVersion } = await import('../src/modules/learning/session.js');
const { BADGES, decorateStages, gradeResponse } = await import('../src/modules/learning/rules.js');
const { ITEMS, STAGES, VOCABULARY, SENTENCES, HANDBOOK } = await import('../prisma/data/content.js');
const { getContent } = await import('../src/modules/content/content.service.js');

const copy = (v) => structuredClone(v);
let db;
let content;
let mutex;
let locked;

function apply(target, data) {
    for (const [key, value] of Object.entries(data)) target[key] = value && typeof value === 'object' && 'increment' in value ? (target[key] || 0) + value.increment : copy(value);
    return copy(target);
}

beforeEach(() => {
    db = {
        user: { id: 'learner', dailyGoal: 10, reviewDone: 0, listenTotal: 0, listenCorrect: 0, buildTotal: 0, buildCorrect: 0, shadowPracticed: 0, shadowTotal: 0 },
        sessions: new Map(), progress: new Map(), attempts: [], cards: new Map(), daily: new Map(),
    };
    content = {
        stages: STAGES.map(({ lessons, ...s }, position) => ({ ...s, position })),
        lessons: STAGES.flatMap((s) => s.lessons.map(({ parts, ...l }, position) => ({ ...l, stageId: s.id, position, goals: l.goals || [] }))),
        links: STAGES.flatMap((s) => s.lessons.flatMap((l) => Object.entries(l.parts || {}).flatMap(([part, ids]) => ids.map((itemId, position) => ({ lessonId: l.id, itemId, part, position }))))),
        items: Object.entries(ITEMS).map(([id, { part, kind, answer, explain, translation, ...data }]) => ({ id, part, kind, answer, explain, translation, data })),
    };
    mutex = Promise.resolve();
    locked = false;
    prisma.stage.findMany = async () => copy(content.stages);
    prisma.lesson.findMany = async () => copy(content.lessons);
    prisma.lessonItem.findMany = async () => copy(content.links);
    prisma.item.findMany = async () => copy(content.items);
    prisma.vocabulary.findMany = async () => copy(VOCABULARY);
    prisma.sentence.findMany = async () => copy(SENTENCES);
    prisma.handbookArticle.findMany = async () => copy(HANDBOOK);
    prisma.user.findUniqueOrThrow = async () => copy(db.user);
    prisma.user.update = async ({ data }) => apply(db.user, data);
    prisma.lessonProgress.findMany = async () => [...db.progress.values()].map(copy);
    prisma.lessonProgress.upsert = async ({ where, create, update }) => {
        const key = where.userId_lessonId.lessonId;
        const row = db.progress.get(key);
        const next = row ? { ...row, ...copy(update) } : copy(create);
        db.progress.set(key, next);
        return copy(next);
    };
    prisma.lessonSession.findMany = async () => [...db.sessions.values()].map(copy);
    prisma.lessonSession.findUnique = async ({ where }) => {
        assert.equal(locked, true, 'session reads must happen after acquiring the learner lock');
        return copy(db.sessions.get(where.userId_lessonId.lessonId) || null);
    };
    prisma.lessonSession.upsert = async ({ where, create }) => {
        const key = where.userId_lessonId.lessonId;
        if (!db.sessions.has(key)) db.sessions.set(key, { step: 0, shadow: {}, startedAt: new Date(), updatedAt: new Date(), ...copy(create) });
        return copy(db.sessions.get(key));
    };
    prisma.lessonSession.update = async ({ where, data }) => apply(db.sessions.get(where.userId_lessonId.lessonId), data);
    prisma.lessonSession.updateMany = async ({ where, data }) => {
        if (!db.sessions.has(where.lessonId)) return { count: 0 };
        apply(db.sessions.get(where.lessonId), data);
        return { count: 1 };
    };
    prisma.lessonSession.delete = async ({ where }) => db.sessions.delete(where.userId_lessonId.lessonId);
    prisma.lessonSession.deleteMany = async ({ where }) => ({ count: Number(db.sessions.delete(where.lessonId)) });
    prisma.attempt.findMany = async ({ take }) => db.attempts.slice(0, take).map(copy);
    prisma.attempt.findFirst = async ({ where }) => copy(db.attempts.find((a) => a.score === where.score) || null);
    prisma.attempt.create = async ({ data }) => {
        const row = { id: `attempt-${db.attempts.length}`, ...copy(data) };
        db.attempts.unshift(row);
        return copy(row);
    };
    prisma.reviewCard.findMany = async ({ where }) => [...db.cards.values()].filter((c) => where.mastered === undefined || c.mastered === where.mastered).map(copy);
    prisma.reviewCard.findUnique = async ({ where }) => copy(db.cards.get(where.userId_itemId.itemId) || null);
    prisma.reviewCard.upsert = async ({ where, create, update }) => {
        const key = where.userId_itemId.itemId;
        const row = db.cards.get(key);
        if (row) return apply(row, update);
        db.cards.set(key, copy(create));
        return copy(create);
    };
    prisma.reviewCard.update = async ({ where, data }) => apply(db.cards.get(where.userId_itemId.itemId), data);
    prisma.dailyActivity.findMany = async () => [...db.daily.values()].map(copy);
    prisma.dailyActivity.upsert = async ({ where, create, update }) => {
        const key = where.userId_day.day;
        const row = db.daily.get(key);
        if (row) return apply(row, update);
        db.daily.set(key, copy(create));
        return copy(create);
    };
    prisma.notebookEntry.findMany = async () => [];
    prisma.supportMessage.count = async () => 0;
    prisma.$transaction = async (work) => {
        let release;
        const previous = mutex;
        let acquired = false;
        const transaction = new Proxy(prisma, { get(target, key) {
            if (key !== '$queryRaw') return target[key];
            return async (strings) => {
                assert.match(strings.join('?'), /FROM "User".*FOR UPDATE/);
                mutex = new Promise((r) => { release = r; });
                await previous;
                acquired = true;
                locked = true;
                return [{ id: 'learner' }];
            };
        } });
        try { return await work(transaction); }
        finally { if (acquired) { locked = false; release(); } }
    };
    invalidateContent();
});

test('BUG-002 concurrent different answers are preserved, same answer counts first try once', async () => {
    await learningService.startLesson('learner', 1);
    await Promise.all([
        learningService.answer('learner', 1, 'l1-ep-em', ITEMS['l1-ep-em'].answer),
        learningService.answer('learner', 1, 'l1-ep-minh', ITEMS['l1-ep-minh'].answer),
    ]);
    assert.equal(db.user.listenTotal, 2);
    assert.ok(db.sessions.get(1).answers['l1-ep-em']);
    assert.ok(db.sessions.get(1).answers['l1-ep-minh']);
    await Promise.all([
        learningService.answer('learner', 1, 'l1-mean-em', ITEMS['l1-mean-em'].answer),
        learningService.answer('learner', 1, 'l1-mean-em', ITEMS['l1-mean-em'].answer),
    ]);
    assert.equal(db.user.listenTotal, 3);
    assert.equal(db.user.listenCorrect, 3);
});

test('BUG-003 content changes reject stale mutations, resume regrades first responses and prunes removed items', async () => {
    await learningService.startLesson('learner', 1);
    await learningService.answer('learner', 1, 'l1-ep-em', ITEMS['l1-ep-em'].answer);
    const oldVersion = db.sessions.get(1).answers[CONTENT_VERSION];
    content.items.find((it) => it.id === 'l1-ep-em').answer = 'different-answer';
    content.links = content.links.filter((link) => !(link.lessonId === 1 && link.itemId === 'l1-fill-em'));
    db.sessions.get(1).answers['l1-fill-em'] = { firstResponse: 'old', response: 'old', correct: true };
    invalidateContent();
    await assert.rejects(learningService.finishLesson('learner', 1), { code: 'content-changed' });
    const resumed = await learningService.startLesson('learner', 1);
    assert.equal(resumed.session.answers['l1-ep-em'].correct, false);
    assert.equal(resumed.session.answers['l1-fill-em'], undefined);
    assert.equal(resumed.session.answers[CONTENT_VERSION], undefined);
    assert.notEqual(db.sessions.get(1).answers[CONTENT_VERSION], oldVersion);
    assert.equal(db.attempts.length, 0);
});

test('BUG-003 legacy sessions are regraded and deleted lesson sessions do not break overview', async () => {
    db.sessions.set(1, { lessonId: 1, step: 1, answers: { 'l1-ep-em': { correct: true, response: 'wrong', firstResponse: 'wrong', attempts: 1 } }, shadow: {}, startedAt: new Date(), updatedAt: new Date() });
    const resumed = await learningService.startLesson('learner', 1);
    assert.equal(resumed.session.answers['l1-ep-em'].correct, false);
    content.lessons = content.lessons.filter((l) => l.id !== 1);
    invalidateContent();
    const overview = await learningService.overview('learner');
    assert.equal(overview.resume, null);
});

test('BUG-003 old tab content version is rejected after another tab adopts changed content', async () => {
    const old = await learningService.startLesson('learner', 1);
    assert.match(old.contentVersion, /^[a-f0-9]{64}$/);
    content.items.find((it) => it.id === 'l1-ep-em').answer = 'new-answer';
    invalidateContent();
    const fresh = await learningService.startLesson('learner', 1);
    assert.notEqual(fresh.contentVersion, old.contentVersion);
    await assert.rejects(learningService.answer('learner', 1, 'l1-ep-em', ITEMS['l1-ep-em'].answer, old.contentVersion), { code: 'content-changed' });
    await assert.rejects(learningService.rateShadow('learner', 1, 'l1-sh-em', 'good', old.contentVersion), { code: 'content-changed' });
    await assert.rejects(learningService.finishLesson('learner', 1, old.contentVersion), { code: 'content-changed' });
    assert.equal(db.attempts.length, 0);
    assert.equal(db.user.listenTotal, 0);
    const answer = await learningService.answer('learner', 1, 'l1-ep-em', 'new-answer', fresh.contentVersion);
    assert.equal(answer.correct, true);
});

test('BUG-003 unpublished lessons cannot be graded from an existing session', async () => {
    await learningService.startLesson('learner', 1);
    content.lessons.find((l) => l.id === 1).published = false;
    invalidateContent();
    await assert.rejects(learningService.answer('learner', 1, 'l1-ep-em', ITEMS['l1-ep-em'].answer), { status: 403 });
    await assert.rejects(learningService.finishLesson('learner', 1), { status: 403 });
    assert.equal(db.attempts.length, 0);
});

test('first-try grading remains unchanged after retry, finish is serialized against duplicate finish', async () => {
    await learningService.startLesson('learner', 1);
    await learningService.answer('learner', 1, 'l1-ep-em', 'wrong');
    await learningService.answer('learner', 1, 'l1-ep-em', ITEMS['l1-ep-em'].answer);
    const resumed = await learningService.startLesson('learner', 1);
    assert.equal(resumed.session.answers['l1-ep-em'].correct, false);
    assert.equal(resumed.session.answers['l1-ep-em'].retryCorrect, true);
    const results = await Promise.allSettled([learningService.finishLesson('learner', 1), learningService.finishLesson('learner', 1)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(db.attempts.length, 1);
    assert.equal(db.attempts[0].parts.listen.correct, 0);
    assert.ok(db.attempts[0].score >= 0 && db.attempts[0].score <= 100);
});

test('BUG-011 skip to good and rating edits keep totals, daily and lesson result in sync', async () => {
    await learningService.startLesson('learner', 1);
    await learningService.rateShadow('learner', 1, 'l1-sh-em', 'skip');
    await learningService.rateShadow('learner', 1, 'l1-sh-em', 'good');
    assert.equal(db.user.shadowTotal, 1);
    assert.equal(db.user.shadowPracticed, 1);
    assert.equal([...db.daily.values()][0].answered, 1);
    assert.equal([...db.daily.values()][0].correct, 1);
    await learningService.rateShadow('learner', 1, 'l1-sh-em', 'again');
    await learningService.rateShadow('learner', 1, 'l1-sh-em', 'again');
    assert.equal([...db.daily.values()][0].correct, 0);
    assert.equal(db.cards.get('l1-sh-em').wrong, 1);
    await learningService.rateShadow('learner', 1, 'l1-sh-em', 'good');
    const result = await learningService.finishLesson('learner', 1);
    assert.equal(result.parts.shadow.practiced, db.user.shadowPracticed);
});

test('BUG-006 queue labels hide build answer and listen-pick target before submission', async () => {
    const now = new Date();
    for (const itemId of ['l4-order-sentence', 'l4-fill-concui', 'l1-ep-em']) db.cards.set(itemId, { userId: 'learner', itemId, part: ITEMS[itemId].part, lessonId: 1, box: 1, right: 0, wrong: 1, lastAt: now, addedAt: now, due: now, mastered: false, lastCorrect: false });
    const queue = await reviewService.queue('learner');
    assert.notEqual(queue.find((c) => c.itemId === 'l4-order-sentence').label, ITEMS['l4-order-sentence'].answer.join(' '));
    assert.ok(queue.find((c) => c.itemId === 'l4-fill-concui').label.includes('___'));
    assert.notEqual(queue.find((c) => c.itemId === 'l1-ep-em').label, ITEMS['l1-ep-em'].answer);
    assert.ok(queue.every((c) => c.item.answer === undefined));
});

test('BUG-012 duplicate review token cannot schedule twice, reopening allows early review', async () => {
    await learningService.startLesson('learner', 1);
    await learningService.answer('learner', 1, 'l1-ep-em', 'wrong');
    const [card] = await reviewService.queue('learner');
    const results = await Promise.allSettled([
        reviewService.answer('learner', card.itemId, ITEMS[card.itemId].answer, card.reviewToken),
        reviewService.answer('learner', card.itemId, ITEMS[card.itemId].answer, card.reviewToken),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'review-stale');
    assert.equal(db.user.reviewDone, 1);
    assert.equal(db.cards.get(card.itemId).box, 2);
    await assert.rejects(reviewService.answer('learner', card.itemId, ITEMS[card.itemId].answer), { code: 'review-stale' });
    const [next] = await reviewService.queue('learner', { itemIds: [card.itemId] });
    await reviewService.answer('learner', next.itemId, ITEMS[next.itemId].answer, next.reviewToken);
    assert.equal(db.cards.get(card.itemId).box, 3);
    assert.equal(db.user.reviewDone, 2);
});

test('BUG-012 a token cannot be used for another learner/card or changed signature', async () => {
    await learningService.startLesson('learner', 1);
    await learningService.answer('learner', 1, 'l1-ep-em', 'wrong');
    const [card] = await reviewService.queue('learner');
    await assert.rejects(reviewService.answer('other', card.itemId, 'wrong', card.reviewToken), { code: 'review-stale' });
    const parts = card.reviewToken.split('.');
    parts[2] = 'invalid';
    await assert.rejects(reviewService.answer('learner', card.itemId, 'wrong', parts.join('.')), { code: 'review-stale' });
    assert.equal(db.user.reviewDone, 0);
});

test('BUG-003 review tokens reject content changed after question presentation', async () => {
    await learningService.startLesson('learner', 1);
    await learningService.answer('learner', 1, 'l1-ep-em', 'wrong');
    const [card] = await reviewService.queue('learner');
    content.items.find((it) => it.id === card.itemId).answer = 'new-answer';
    invalidateContent();
    await assert.rejects(reviewService.answer('learner', card.itemId, ITEMS[card.itemId].answer, card.reviewToken), { code: 'review-stale' });
    assert.equal(db.user.reviewDone, 0);
});

test('BUG-013 completing every published lesson produces 100% while preserving planned totals', async () => {
    const C = await getContent();
    const state = { sessions: {}, lessons: Object.fromEntries([1, 2, 4, 5].map((id) => [id, { passed: true }])) };
    const [stage1, stage2] = decorateStages(C, state);
    assert.equal(stage1.percent, 100);
    assert.equal(stage1.total, 4);
    assert.equal(stage1.plannedTotal, 5);
    assert.equal(stage1.complete, true);
    assert.equal(stage2.unlocked, true);
});

test('BUG-016 a perfect attempt outside recent 100 still earns the badge', async () => {
    db.attempts = Array.from({ length: 101 }, (_, i) => ({ id: String(i), lessonId: 1, parts: {}, score: i === 100 ? 100 : 80, createdAt: new Date(), durationSec: 1 }));
    const overview = await learningService.overview('learner');
    assert.equal(overview.badges.find((b) => b.id === 'hoan-hao').earned, true);
    assert.equal(overview.recent.length, 5);
    assert.equal(BADGES.find((b) => b.id === 'hoan-hao').test({ hasPerfectAttempt: false, attempts: [] }), false);
});

test('Unicode grading preserves tone differences and accepts canonical equivalent text', () => {
    const item = ITEMS['l1-ep-em'];
    assert.equal(gradeResponse(item, `  ${item.answer.toUpperCase().normalize('NFD')}  `), true);
    assert.equal(gradeResponse(item, item.answer.normalize('NFD').replace(/[\u0300-\u036f]/g, '')), false);
});
