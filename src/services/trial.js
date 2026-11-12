/**
 * Account-free adapter for the public "Học thử" lesson.
 * Same interface as the server adapter in LessonPlayer, but nothing is stored.
 */
import { PARTS, PASS_THRESHOLD, STAGES } from '../data/content.js';
import { gradeLocal, publicItems } from './server/engine.js';

const ORDER = ['listen', 'build', 'shadow'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createTrialAdapter() {
    const stage = STAGES[0];
    const lesson = stage.lessons.find((l) => l.published);
    const answers = {};
    const shadow = {};

    return {
        trial: true,
        async start() {
            await wait(200);
            return {
                lesson: { id: lesson.id, title: lesson.title, minutes: lesson.minutes, goals: lesson.goals },
                stage: { id: stage.id, title: stage.title, tone: stage.tone },
                parts: ORDER.map((p) => ({ ...PARTS[p], items: publicItems(lesson.parts[p] ?? []) })).filter((p) => p.items.length),
                session: { step: 0, answers: {}, shadow: {} },
                threshold: PASS_THRESHOLD,
                best: null,
            };
        },
        async answer(itemId, response) {
            await wait(120);
            const r = gradeLocal(itemId, response);
            if (!answers[itemId]) answers[itemId] = r.correct;
            return r;
        },
        async rate(itemId, rating) {
            shadow[itemId] = rating;
            return { rating };
        },
        async saveStep() {},
        async finish() {
            await wait(300);
            const parts = {};
            for (const p of ORDER) {
                const ids = lesson.parts[p] ?? [];
                parts[p] =
                    p === 'shadow'
                        ? { practiced: ids.filter((id) => shadow[id] && shadow[id] !== 'skip').length, total: ids.length }
                        : { correct: ids.filter((id) => answers[id]).length, total: ids.length };
            }
            const total = parts.listen.total + parts.build.total;
            const score = Math.round(((parts.listen.correct + parts.build.correct) / total) * 100);
            return { lessonId: lesson.id, title: lesson.title, score, passed: score >= PASS_THRESHOLD, parts, threshold: PASS_THRESHOLD, review: [], unlocked: [], next: null };
        },
        async restart() {
            for (const k of Object.keys(answers)) delete answers[k];
            for (const k of Object.keys(shadow)) delete shadow[k];
        },
    };
}
