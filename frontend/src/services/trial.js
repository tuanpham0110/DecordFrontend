/**
 * Account-free adapter for the public "Học thử" lesson.
 * Same interface as the server adapter in LessonPlayer. Grading happens on the
 * backend (answers never reach the browser); nothing is stored.
 */
import { content } from './api.js';

export function createTrialAdapter() {
    let lesson = null;
    let threshold = 80;
    const answers = {};
    const shadow = {};

    return {
        trial: true,
        async start() {
            const data = await content.trial();
            lesson = data;
            threshold = data.threshold;
            return data;
        },
        async answer(itemId, response) {
            const r = await content.trialAnswer(itemId, response);
            if (!(itemId in answers)) answers[itemId] = r.correct;
            return r;
        },
        async rate(itemId, rating) {
            shadow[itemId] = rating;
            return { rating };
        },
        async saveStep() {},
        async finish() {
            const byPart = Object.fromEntries(lesson.parts.map((p) => [p.key, p.items.map((i) => i.id)]));
            const ids = (k) => byPart[k] ?? [];
            const parts = {
                listen: { correct: ids('listen').filter((id) => answers[id]).length, total: ids('listen').length },
                build: { correct: ids('build').filter((id) => answers[id]).length, total: ids('build').length },
                shadow: { practiced: ids('shadow').filter((id) => shadow[id] && shadow[id] !== 'skip').length, total: ids('shadow').length },
            };
            const total = parts.listen.total + parts.build.total;
            const score = total ? Math.round(((parts.listen.correct + parts.build.correct) / total) * 100) : 100;
            return {
                lessonId: lesson.lesson.id,
                title: lesson.lesson.title,
                score,
                passed: score >= threshold,
                parts,
                threshold,
                review: [],
                unlocked: [],
                next: null,
            };
        },
        async restart() {
            for (const k of Object.keys(answers)) delete answers[k];
            for (const k of Object.keys(shadow)) delete shadow[k];
        },
    };
}
