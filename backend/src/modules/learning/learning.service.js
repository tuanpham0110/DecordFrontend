import { prisma } from '../../lib/prisma.js';
import { HttpError, badRequest, conflict, notFound } from '../../lib/errors.js';
import { DAY, dayKey, weekdayOf } from '../../lib/time.js';
import { PART_ORDER, getContent } from '../content/content.service.js';
import {
    BADGES,
    allLessons,
    assertStageOpen,
    decorateStages,
    findLesson,
    gradeResponse,
    isGradable,
    itemLabel,
    lessonItemIds,
    lockReason,
    publicItem,
    revealed,
    stageComplete,
    stageGates,
    statuses,
    streakOf,
} from './rules.js';
import { addToReview, bumpDaily, loadState, toSession } from './state.js';
import { supportService } from '../support/support.service.js';
import { learnerTransaction } from './transaction.js';
import { CONTENT_VERSION, assertSessionContent, contentVersion, reconcileAnswers, reconcileShadow, storedAnswers } from './session.js';

const PART_COUNTER = {
    listen: { correct: 'listenCorrect', total: 'listenTotal' },
    build: { correct: 'buildCorrect', total: 'buildTotal' },
};

export const learningService = {
    async overview(userId) {
        const [C, data, supportUnread] = await Promise.all([getContent(), loadState(userId), supportService.unread(userId)]);
        const stages = decorateStages(C, data);
        const lessons = stages.flatMap((s) => s.lessons.map((l) => ({ ...l, stage: s })));
        const total = lessons.filter((l) => l.published).length;
        const completed = lessons.filter((l) => l.status === 'done').length;
        const currentL = lessons.find((l) => l.status === 'current');

        // most recently touched in-progress session
        const openIds = new Set(lessons.filter((l) => l.status === 'current' || l.status === 'done').map((l) => l.id));
        const s0 = Object.values(data.sessions).filter((s) => openIds.has(s.lessonId)).sort((a, b) => b.updatedAt - a.updatedAt)[0];
        let resume = null;
        if (s0) {
            const { lesson, stage } = findLesson(C, s0.lessonId);
            const ids = lessonItemIds(lesson);
            if (ids.length && ids.every((id) => C.ITEMS[id])) {
                const answers = reconcileAnswers(C, lesson, s0.answers);
                const shadow = reconcileShadow(C, lesson, s0.shadow);
                const done = ids.filter((id) => answers[id] || shadow[id]).length;
                resume = {
                    lessonId: lesson.id,
                    title: lesson.title,
                    stageId: stage.id,
                    stageTitle: stage.title,
                    done,
                    total: ids.length,
                    part: C.PARTS[C.ITEMS[ids[Math.min(done, ids.length - 1)]].part].title,
                    updatedAt: s0.updatedAt,
                };
            }
        }

        const now = Date.now();
        const cards = Object.values(data.review).filter((c) => C.ITEMS[c.itemId]);
        const due = cards.filter((c) => !c.mastered && c.due <= now);
        const week = [...Array(7)].map((_, i) => {
            const day = dayKey(new Date(now - (6 - i) * DAY));
            return { day, weekday: weekdayOf(day), ...(data.daily[day] || { answered: 0, correct: 0 }) };
        });
        const scored = Object.values(data.lessons).filter((l) => l.best != null);
        const minutes = Math.round(data.attempts.reduce((n, a) => n + (a.durationSec || 0), 0) / 60);

        return {
            stages,
            total,
            plannedTotal: lessons.length,
            completed,
            percent: total ? Math.round((completed / total) * 100) : 0,
            published: lessons.filter((l) => l.published).length,
            current: currentL ? { stage: currentL.stage, lesson: currentL } : null,
            resume,
            threshold: C.PASS_THRESHOLD,
            stats: {
                streak: streakOf(data),
                today: { ...(data.daily[dayKey()] || { answered: 0, correct: 0 }), goal: data.goal },
                week,
                parts: data.partStats,
                averageScore: scored.length ? Math.round(scored.reduce((n, l) => n + l.best, 0) / scored.length) : null,
                minutes,
            },
            review: {
                due: due.length,
                total: cards.filter((c) => !c.mastered).length,
                mastered: cards.filter((c) => c.mastered).length,
                top: due
                    .sort((a, b) => b.wrong - a.wrong)
                    .slice(0, 3)
                    .map((c) => ({ itemId: c.itemId, part: c.part, label: itemLabel(C, c.itemId), wrong: c.wrong, lessonId: c.lessonId })),
            },
            recent: data.attempts.slice(0, 5),
            support: { unread: supportUnread },
            badges: BADGES.map(({ test, ...b }) => ({ ...b, earned: test(data) })),
        };
    },

    async stage(userId, id) {
        const [C, data] = await Promise.all([getContent(), loadState(userId)]);
        const stage = decorateStages(C, data).find((s) => s.id === Number(id));
        if (!stage) throw notFound('Không tìm thấy chặng học.');
        assertStageOpen(C, data, stage.id);
        return stage;
    },

    async lessonInfo(userId, id) {
        const [C, data] = await Promise.all([getContent(), loadState(userId)]);
        const { lesson, stage } = findLesson(C, id);
        assertStageOpen(C, data, stage.id);
        const stages = decorateStages(C, data);
        const ds = stages.find((s) => s.id === stage.id);
        const dl = ds.lessons.find((l) => l.id === lesson.id);
        const flat = stages.flatMap((s) => s.lessons);
        const idx = flat.findIndex((l) => l.id === lesson.id);
        return {
            ...dl,
            goals: lesson.goals ?? [],
            stage: { id: ds.id, title: ds.title, tone: ds.tone, code: ds.code },
            history: data.attempts.filter((a) => a.lessonId === lesson.id).slice(0, 5),
            threshold: C.PASS_THRESHOLD,
            prevId: flat[idx - 1]?.id ?? null,
            nextId: flat[idx + 1]?.id ?? null,
        };
    },

    /** Opens (or resumes) a lesson. Enforces the stage gate and the unlock rule. */
    async startLesson(userId, id) {
        const C = await getContent();
        const { lesson, stage } = findLesson(C, id);
        return learnerTransaction(userId, async (tx) => {
            const data = await loadState(userId, tx);
            assertStageOpen(C, data, stage.id);
            const st = statuses(C, data)[lesson.id];
            if (st === 'soon' || st === 'locked') throw new HttpError(403, lockReason(C, data, lesson.id, st), { code: st });

            const row = await tx.lessonSession.upsert({
                where: { userId_lessonId: { userId, lessonId: lesson.id } },
                update: {},
                create: { userId, lessonId: lesson.id, answers: storedAnswers(C, lesson, {}) },
            });
            const contentChanged = !!row.answers?.[CONTENT_VERSION] && row.answers[CONTENT_VERSION] !== contentVersion(C, lesson);
            const cleanAnswers = reconcileAnswers(C, lesson, row.answers);
            const cleanShadow = reconcileShadow(C, lesson, row.shadow);
            // A resume explicitly adopts the current content. Historical attempts remain immutable.
            row.answers = storedAnswers(C, lesson, cleanAnswers);
            row.shadow = cleanShadow;
            row.step = Math.min(row.step, lessonItemIds(lesson).length);
            await tx.lessonSession.update({
                where: { userId_lessonId: { userId, lessonId: lesson.id } },
                data: { answers: row.answers, shadow: row.shadow, step: row.step },
            });
            const session = toSession(row);
            // send back what was already answered so the player can restore feedback
            const answered = Object.fromEntries(Object.entries(session.answers).map(([itemId, a]) => [itemId, { ...a, ...revealed(C, itemId) }]));
            return {
                lesson: { id: lesson.id, title: lesson.title, minutes: lesson.minutes, goals: lesson.goals ?? [] },
                stage: { id: stage.id, title: stage.title, tone: stage.tone },
                // seeded by the session: the order of the choices stays put if the learner leaves and resumes
                parts: PART_ORDER.map((p) => ({ ...C.PARTS[p], items: (lesson.parts?.[p] ?? []).map((iid) => publicItem(C, iid, `${userId}:${session.startedAt}`)) })).filter(
                    (p) => p.items.length
                ),
                session: { step: session.step, answers: answered, shadow: session.shadow },
                threshold: C.PASS_THRESHOLD,
                best: data.lessons[lesson.id]?.best ?? null,
                contentChanged,
                contentVersion: session.contentVersion,
            };
        });
    },

    async saveStep(userId, lessonId, step) {
        return learnerTransaction(userId, async (tx) => {
            const r = await tx.lessonSession.updateMany({ where: { userId, lessonId: Number(lessonId) }, data: { step, updatedAt: new Date() } });
            if (!r.count) throw conflict('Phiên học đã kết thúc.');
            return true;
        });
    },

    async answer(userId, lessonId, itemId, response, expectedVersion) {
        const C = await getContent();
        const { lesson } = findLesson(C, lessonId);
        const item = C.ITEMS[itemId];
        if (!item || !lessonItemIds(lesson).includes(itemId) || !isGradable(item)) throw badRequest('Câu hỏi không thuộc bài học này.');

        return learnerTransaction(userId, async (tx) => {
            const s = await tx.lessonSession.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } } });
            if (!s) throw conflict('Phiên học đã kết thúc. Hãy mở lại bài học.');
            if (!lesson.published) throw new HttpError(403, 'Bài học đang được biên soạn.', { code: 'soon' });
            assertSessionContent(C, lesson, s.answers, expectedVersion);
            const answers = reconcileAnswers(C, lesson, s.answers);
            const correct = gradeResponse(item, response);
            const prev = answers[itemId];
            if (!prev) {
                answers[itemId] = { correct, firstResponse: response, response, attempts: 1 };
                const k = PART_COUNTER[item.part];
                await tx.user.update({ where: { id: userId }, data: { [k.total]: { increment: 1 }, ...(correct ? { [k.correct]: { increment: 1 } } : {}) } });
                await bumpDaily(tx, userId, { answered: 1, correct: correct ? 1 : 0 });
                if (!correct) await addToReview(tx, userId, { itemId, part: item.part, lessonId: lesson.id });
            } else {
                answers[itemId] = { ...prev, response, attempts: prev.attempts + 1, retryCorrect: correct };
            }
            await tx.lessonSession.update({ where: { userId_lessonId: { userId, lessonId: lesson.id } }, data: { answers: storedAnswers(C, lesson, answers), updatedAt: new Date() } });
            return { correct, firstTry: !prev, ...revealed(C, itemId) };
        });
    },

    async rateShadow(userId, lessonId, itemId, rating, expectedVersion) {
        const C = await getContent();
        const { lesson } = findLesson(C, lessonId);
        if (!lessonItemIds(lesson).includes(itemId) || C.ITEMS[itemId]?.part !== 'shadow') throw badRequest('Câu luyện nói không thuộc bài học này.');

        return learnerTransaction(userId, async (tx) => {
            const s = await tx.lessonSession.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } } });
            if (!s) throw conflict('Phiên học đã kết thúc. Hãy mở lại bài học.');
            if (!lesson.published) throw new HttpError(403, 'Bài học đang được biên soạn.', { code: 'soon' });
            assertSessionContent(C, lesson, s.answers, expectedVersion);
            const shadow = reconcileShadow(C, lesson, s.shadow);
            const prev = shadow[itemId];
            const practiced = rating !== 'skip';
            const wasPracticed = !!prev && prev.rating !== 'skip';
            const now = Date.now();
            const day = dayKey(new Date(now));
            // Keep daily deltas on the day of the original practice, even after midnight.
            const activityDay = prev?.activityDay || (wasPracticed ? dayKey(new Date(prev.at)) : day);
            shadow[itemId] = { rating, at: now, ...(practiced || wasPracticed ? { activityDay } : {}) };
            await tx.user.update({ where: { id: userId }, data: {
                ...(!prev ? { shadowTotal: { increment: 1 } } : {}),
                shadowPracticed: { increment: Number(practiced) - Number(wasPracticed) },
            } });
            const wasCorrect = wasPracticed && prev.rating !== 'again';
            const correct = practiced && rating !== 'again';
            const answeredDelta = Number(practiced) - Number(wasPracticed);
            const correctDelta = Number(correct) - Number(wasCorrect);
            if (answeredDelta || correctDelta) await bumpDaily(tx, userId, { answered: answeredDelta, correct: correctDelta, day: activityDay });
            if (rating === 'again' && prev?.rating !== 'again') await addToReview(tx, userId, { itemId, part: 'shadow', lessonId: lesson.id });
            await tx.lessonSession.update({ where: { userId_lessonId: { userId, lessonId: lesson.id } }, data: { shadow, answers: storedAnswers(C, lesson, reconcileAnswers(C, lesson, s.answers)), updatedAt: new Date() } });
            return { rating };
        });
    },

    async finishLesson(userId, lessonId, expectedVersion) {
        const C = await getContent();
        const { lesson, stage } = findLesson(C, lessonId);

        return learnerTransaction(userId, async (tx) => {
            const data = await loadState(userId, tx);
            const s = data.sessions[lesson.id];
            if (!s) throw conflict('Không tìm thấy phiên học để chấm điểm.');
            assertStageOpen(C, data, stage.id);
            if (!lesson.published) throw new HttpError(403, 'Bài học đang được biên soạn.', { code: 'soon' });
            assertSessionContent(C, lesson, { [CONTENT_VERSION]: s.contentVersion }, expectedVersion);
            s.answers = reconcileAnswers(C, lesson, s.answers);
            s.shadow = reconcileShadow(C, lesson, s.shadow);
            const before = statuses(C, data);
            const gatesBefore = stageGates(C, data);
            const stageDoneBefore = stageComplete(data, stage);

            const parts = {};
            for (const p of PART_ORDER) {
                const ids = lesson.parts?.[p] ?? [];
                parts[p] =
                    p === 'shadow'
                        ? { practiced: ids.filter((id) => s.shadow[id] && s.shadow[id].rating !== 'skip').length, total: ids.length }
                        : { correct: ids.filter((id) => s.answers[id]?.correct).length, total: ids.length };
            }
            const gradable = parts.listen.total + parts.build.total;
            const correct = parts.listen.correct + parts.build.correct;
            const score = gradable ? Math.round((correct / gradable) * 100) : 100;
            const passed = score >= C.PASS_THRESHOLD;
            const now = Date.now();

            const wrongIds = lessonItemIds(lesson).filter((id) => (C.ITEMS[id].part === 'shadow' ? s.shadow[id]?.rating === 'again' : !s.answers[id]?.correct));
            // unanswered gradable items count as wrong and go to the review queue
            for (const id of wrongIds) {
                if (C.ITEMS[id].part !== 'shadow' && !s.answers[id]) await addToReview(tx, userId, { itemId: id, part: C.ITEMS[id].part, lessonId: lesson.id });
            }

            const durationSec = Math.min(1800, Math.round((now - s.startedAt) / 1000));
            const row = await tx.attempt.create({
                data: { userId, lessonId: lesson.id, stageId: stage.id, title: lesson.title, score, passed, parts, durationSec, createdAt: new Date(now) },
            });
            const prev = data.lessons[lesson.id] || { best: null, passed: false, attempts: 0 };
            const rec = { best: Math.max(prev.best ?? 0, score), passed: prev.passed || passed, attempts: prev.attempts + 1, lastAt: now };
            await tx.lessonProgress.upsert({
                where: { userId_lessonId: { userId, lessonId: lesson.id } },
                update: { best: rec.best, passed: rec.passed, attempts: rec.attempts, lastAt: new Date(now) },
                create: { userId, lessonId: lesson.id, best: rec.best, passed: rec.passed, attempts: rec.attempts, lastAt: new Date(now) },
            });
            await tx.lessonSession.delete({ where: { userId_lessonId: { userId, lessonId: lesson.id } } });

            // recompute with the new result
            data.lessons[lesson.id] = rec;
            delete data.sessions[lesson.id];
            const after = statuses(C, data);
            const unlocked = Object.keys(after)
                .filter((k) => before[k] === 'locked' && after[k] === 'current')
                .map(Number);
            const next = allLessons(C).find((l) => after[l.id] === 'current');

            let stageTransition = null;
            if (!stageDoneBefore && stageComplete(data, stage)) {
                const gatesAfter = stageGates(C, data);
                const ns = C.STAGES[C.STAGES.findIndex((x) => x.id === stage.id) + 1];
                stageTransition = {
                    from: { id: stage.id, code: stage.code, tone: stage.tone, title: stage.title, lessons: stage.lessons.filter((l) => l.published).length },
                    to: ns
                        ? {
                              id: ns.id,
                              code: ns.code,
                              tone: ns.tone,
                              title: ns.title,
                              summary: ns.summary,
                              unlocked: !gatesBefore[ns.id] && !!gatesAfter[ns.id],
                              ready: ns.lessons.some((l) => l.published),
                              total: ns.lessons.length,
                          }
                        : null,
                };
            }

            return {
                id: row.id,
                lessonId: lesson.id,
                stageId: stage.id,
                title: lesson.title,
                score,
                passed,
                parts,
                at: now,
                durationSec,
                threshold: C.PASS_THRESHOLD,
                best: rec.best,
                unlocked: unlocked.map((uid) => ({ id: uid, title: findLesson(C, uid).lesson.title })),
                next: next ? { id: next.id, title: next.title, stageId: next.stageId } : null,
                stageTransition,
                review: wrongIds.map((iid) => ({ itemId: iid, part: C.ITEMS[iid].part, label: itemLabel(C, iid, { reveal: true }) })),
            };
        });
    },

    async restartLesson(userId, lessonId) {
        await learnerTransaction(userId, (tx) => tx.lessonSession.deleteMany({ where: { userId, lessonId: Number(lessonId) } }));
        return true;
    },

    async history(userId) {
        return (await loadState(userId)).attempts;
    },

    async setGoal(userId, goal) {
        await prisma.user.update({ where: { id: userId }, data: { dailyGoal: goal } });
        return goal;
    },
};
