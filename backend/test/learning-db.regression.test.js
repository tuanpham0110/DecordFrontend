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
    test('learning database regression requires explicit opt-in and dedicated *_test DB', { skip: true }, () => {});
} else {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'GEMINI_API_KEY', 'SPEECH_API_URL', 'GOOGLE_CLIENT_ID', 'MICROSOFT_CLIENT_ID']) delete process.env[key];
    const { prisma } = await import('../src/lib/prisma.js');
    const { learningService } = await import('../src/modules/learning/learning.service.js');
    const { reviewService } = await import('../src/modules/review/review.service.js');
    const { supportService, createSupportService } = await import('../src/modules/support/support.service.js');
    const { ITEMS } = await import('../prisma/data/content.js');
    const ownedIds = [];
    let userId;

    before(async () => {
        const user = await prisma.user.create({ data: { email: `learning-db-${crypto.randomUUID()}@test.local`, name: 'Learning concurrency regression', passwordHash: 'test-fixture-no-login', verified: true } });
        userId = user.id;
        ownedIds.push(userId);
    });

    after(async () => {
        try { await prisma.user.deleteMany({ where: { id: { in: ownedIds } } }); }
        finally { await prisma.$disconnect(); }
    });

    test('PostgreSQL: concurrent distinct answers preserve both JSON entries', async () => {
        await learningService.startLesson(userId, 1);
        await Promise.all([
            learningService.answer(userId, 1, 'l1-ep-em', ITEMS['l1-ep-em'].answer),
            learningService.answer(userId, 1, 'l1-ep-minh', ITEMS['l1-ep-minh'].answer),
        ]);
        const session = await prisma.lessonSession.findUniqueOrThrow({ where: { userId_lessonId: { userId, lessonId: 1 } } });
        assert.equal(session.answers['l1-ep-em'].correct, true);
        assert.equal(session.answers['l1-ep-minh'].correct, true);
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.listenTotal, 2);
        assert.equal(user.listenCorrect, 2);
    });

    test('PostgreSQL: concurrent same answer counts first try exactly once', async () => {
        await Promise.all([
            learningService.answer(userId, 1, 'l1-mean-em', ITEMS['l1-mean-em'].answer),
            learningService.answer(userId, 1, 'l1-mean-em', ITEMS['l1-mean-em'].answer),
        ]);
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.listenTotal, 3);
        assert.equal(user.listenCorrect, 3);
        const session = await prisma.lessonSession.findUniqueOrThrow({ where: { userId_lessonId: { userId, lessonId: 1 } } });
        assert.equal(session.answers['l1-mean-em'].attempts, 2);
    });

    test('PostgreSQL: duplicate finish commits one attempt and one progress update', async () => {
        const results = await Promise.allSettled([learningService.finishLesson(userId, 1), learningService.finishLesson(userId, 1)]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        assert.equal(results.find((r) => r.status === 'rejected').reason.status, 409);
        assert.equal(await prisma.attempt.count({ where: { userId, lessonId: 1 } }), 1);
        assert.equal((await prisma.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId, lessonId: 1 } } })).attempts, 1);
        assert.equal(await prisma.lessonSession.count({ where: { userId, lessonId: 1 } }), 0);
    });

    test('PostgreSQL: replayed review token schedules once; reopening supports early review', async () => {
        // The unanswered build questions from the preceding finish are now due cards.
        const [card] = await reviewService.queue(userId);
        assert.ok(card);
        const results = await Promise.allSettled([
            reviewService.answer(userId, card.itemId, ITEMS[card.itemId].answer, card.reviewToken),
            reviewService.answer(userId, card.itemId, ITEMS[card.itemId].answer, card.reviewToken),
        ]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'review-stale');
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).reviewDone, 1);
        assert.equal((await prisma.reviewCard.findUniqueOrThrow({ where: { userId_itemId: { userId, itemId: card.itemId } } })).box, 2);
        const [fresh] = await reviewService.queue(userId, { itemIds: [card.itemId] });
        await reviewService.answer(userId, fresh.itemId, ITEMS[fresh.itemId].answer, fresh.reviewToken);
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).reviewDone, 2);
    });

    test('PostgreSQL: shadow edits keep stored practice total and result aligned', async () => {
        await learningService.startLesson(userId, 1);
        await learningService.rateShadow(userId, 1, 'l1-sh-em', 'skip');
        await learningService.rateShadow(userId, 1, 'l1-sh-em', 'good');
        let user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.shadowTotal, 1);
        assert.equal(user.shadowPracticed, 1);
        await learningService.rateShadow(userId, 1, 'l1-sh-em', 'again');
        await learningService.rateShadow(userId, 1, 'l1-sh-em', 'again');
        assert.equal((await prisma.reviewCard.findUniqueOrThrow({ where: { userId_itemId: { userId, itemId: 'l1-sh-em' } } })).wrong, 1);
        await learningService.rateShadow(userId, 1, 'l1-sh-em', 'good');
        const result = await learningService.finishLesson(userId, 1);
        user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(result.parts.shadow.practiced, user.shadowPracticed);
    });

    test('PostgreSQL: perfect badge survives the recent-history window', async () => {
        const now = Date.now();
        await prisma.attempt.createMany({ data: Array.from({ length: 101 }, (_, i) => ({
            userId, lessonId: 1, stageId: 1, title: 'Regression fixture', score: i === 100 ? 100 : 80,
            passed: true, parts: {}, durationSec: 1, createdAt: new Date(now - i * 1000),
        })) });
        const overview = await learningService.overview(userId);
        assert.equal(overview.badges.find((b) => b.id === 'hoan-hao').earned, true);
        assert.equal((await learningService.history(userId)).some((a) => a.score === 100), false);
    });

    test('PostgreSQL BUG-017: both support views load over 300 messages and only mark loaded recipient messages', async () => {
        const other = await prisma.user.create({ data: { email: `support-other-${crypto.randomUUID()}@test.local`, name: 'Other support fixture', passwordHash: 'test-fixture-no-login', verified: true } });
        ownedIds.push(other.id);
        const now = Date.now();
        const messages = Array.from({ length: 310 }, (_, i) => ({
            userId, fromAdmin: i % 2 === 0, body: `owned-message-${i}`, createdAt: new Date(now - (310 - i) * 1000),
        }));
        await prisma.supportMessage.createMany({ data: [...messages,
            { userId: other.id, fromAdmin: true, body: 'other-admin-unread' },
            { userId: other.id, fromAdmin: false, body: 'other-learner-unread' },
        ] });
        const learner = await supportService.thread(userId);
        assert.equal(learner.length, 310);
        assert.equal(learner[309].body, 'owned-message-309');
        assert.equal(await prisma.supportMessage.count({ where: { userId, fromAdmin: true, readAt: null } }), 0);
        assert.equal(await prisma.supportMessage.count({ where: { userId, fromAdmin: false, readAt: null } }), 155);
        const admin = await supportService.adminThread(userId);
        assert.equal(admin.messages.length, 310);
        assert.equal(admin.messages[309].body, 'owned-message-309');
        assert.equal(await prisma.supportMessage.count({ where: { userId, readAt: null } }), 0);
        assert.equal(await prisma.supportMessage.count({ where: { userId: other.id, readAt: null } }), 2);

        // Insert a real database message between the service's read and read-marker update.
        // It must remain unread because it was not part of the returned rows.
        for (const fromAdmin of [true, false]) {
            await prisma.supportMessage.updateMany({ where: { userId }, data: { readAt: null } });
            let late;
            let markedIds;
            const service = createSupportService(new Proxy(prisma, { get(target, key) {
                if (key !== 'supportMessage') return target[key];
                return {
                    findMany: async (args) => {
                        const rows = await prisma.supportMessage.findMany(args);
                        late = await prisma.supportMessage.create({ data: { userId, fromAdmin, body: `arrived-after-read-${fromAdmin}` } });
                        return rows;
                    },
                    updateMany: async (args) => {
                        markedIds = args.where.id.in;
                        return prisma.supportMessage.updateMany(args);
                    },
                };
            } }));
            const result = fromAdmin ? await service.thread(userId) : (await service.adminThread(userId)).messages;
            assert.equal(result.some((m) => m.id === late.id), false);
            assert.equal(markedIds.includes(late.id), false);
            assert.equal((await prisma.supportMessage.findUniqueOrThrow({ where: { id: late.id } })).readAt, null);
            assert.equal(await prisma.supportMessage.count({ where: { userId: other.id, readAt: null } }), 2);
        }
    });
}
