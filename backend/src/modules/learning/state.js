/**
 * Loads one learner's state from the database into the plain object the rules work with,
 * plus small write helpers shared by the learning / review services.
 */
import { prisma } from '../../lib/prisma.js';
import { dayKey, ms } from '../../lib/time.js';

export const toAttempt = (a) => ({
    id: a.id,
    lessonId: a.lessonId,
    stageId: a.stageId,
    title: a.title,
    score: a.score,
    passed: a.passed,
    parts: a.parts,
    at: ms(a.createdAt),
    durationSec: a.durationSec,
});

export const toCard = (c) => ({
    itemId: c.itemId,
    part: c.part,
    lessonId: c.lessonId,
    box: c.box,
    due: ms(c.due),
    wrong: c.wrong,
    right: c.right,
    mastered: c.mastered,
    addedAt: ms(c.addedAt),
    lastAt: ms(c.lastAt),
    lastCorrect: c.lastCorrect,
});

export const toSession = (s) => ({
    lessonId: s.lessonId,
    step: s.step,
    answers: s.answers ?? {},
    shadow: s.shadow ?? {},
    startedAt: ms(s.startedAt),
    updatedAt: ms(s.updatedAt),
});

export async function loadState(userId, db = prisma) {
    const [user, progress, sessions, attempts, cards, notes, daily] = await Promise.all([
        db.user.findUniqueOrThrow({ where: { id: userId } }),
        db.lessonProgress.findMany({ where: { userId } }),
        db.lessonSession.findMany({ where: { userId } }),
        db.attempt.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
        db.reviewCard.findMany({ where: { userId } }),
        db.notebookEntry.findMany({ where: { userId } }),
        db.dailyActivity.findMany({ where: { userId } }),
    ]);
    return {
        user,
        goal: user.dailyGoal,
        reviewDone: user.reviewDone,
        partStats: {
            listen: { correct: user.listenCorrect, total: user.listenTotal },
            build: { correct: user.buildCorrect, total: user.buildTotal },
            shadow: { practiced: user.shadowPracticed, total: user.shadowTotal },
        },
        lessons: Object.fromEntries(progress.map((p) => [p.lessonId, { best: p.best, passed: p.passed, attempts: p.attempts, lastAt: ms(p.lastAt) }])),
        sessions: Object.fromEntries(sessions.map((s) => [s.lessonId, toSession(s)])),
        attempts: attempts.map(toAttempt),
        review: Object.fromEntries(cards.map((c) => [c.itemId, toCard(c)])),
        notebook: Object.fromEntries(
            notes.map((n) => [
                n.entryId,
                { id: n.entryId, favorite: n.favorite, savedAt: ms(n.savedAt), reviews: n.reviews, known: n.known ?? undefined, lastReviewAt: ms(n.lastReviewAt) ?? undefined },
            ])
        ),
        daily: Object.fromEntries(daily.map((d) => [d.day, { answered: d.answered, correct: d.correct }])),
    };
}

/** +answered / +correct for today. */
export function bumpDaily(db, userId, { answered = 0, correct = 0 }) {
    const day = dayKey();
    return db.dailyActivity.upsert({
        where: { userId_day: { userId, day } },
        update: { answered: { increment: answered }, correct: { increment: correct } },
        create: { userId, day, answered, correct },
    });
}

/** Puts an item (back) into the review queue, due now. */
export function addToReview(db, userId, { itemId, part, lessonId }) {
    const now = new Date();
    return db.reviewCard.upsert({
        where: { userId_itemId: { userId, itemId } },
        update: { box: 1, mastered: false, due: now, wrong: { increment: 1 }, lastAt: now, lastCorrect: false },
        create: { userId, itemId, part, lessonId, box: 1, due: now, wrong: 1, right: 0, mastered: false, addedAt: now, lastAt: now, lastCorrect: false },
    });
}
