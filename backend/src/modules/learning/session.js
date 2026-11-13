import { createHmac } from 'node:crypto';
import { env } from '../../config/env.js';
import { conflict } from '../../lib/errors.js';
import { gradeResponse, isGradable, lessonItemIds } from './rules.js';

// Kept inside the existing JSON column; never exposed as an exercise answer.
export const CONTENT_VERSION = '__muonglabContentVersion';

export function contentVersion(C, lesson) {
    return createHmac('sha256', env.JWT_SECRET).update(JSON.stringify({
        published: lesson.published,
        parts: lesson.parts,
        items: lessonItemIds(lesson).map((id) => [id, C.ITEMS[id]]),
    })).digest('hex');
}

export function assertSessionContent(C, lesson, answers, expectedVersion) {
    const version = answers?.[CONTENT_VERSION];
    const current = contentVersion(C, lesson);
    if ((version && version !== current) || (expectedVersion !== undefined && expectedVersion !== current)) {
        throw conflict('Nội dung bài học đã thay đổi. Hãy mở lại bài học để tiếp tục với nội dung mới.', { code: 'content-changed' });
    }
}

/** Ignore removed items and regrade stored responses, including pre-version sessions. */
export function reconcileAnswers(C, lesson, stored = {}) {
    const answers = {};
    for (const id of lessonItemIds(lesson)) {
        const item = C.ITEMS[id];
        const prev = stored[id];
        if (!item || !isGradable(item) || !prev || typeof prev !== 'object') continue;
        const firstResponse = prev.firstResponse ?? prev.response;
        if (firstResponse == null) continue;
        answers[id] = {
            ...prev,
            firstResponse,
            correct: gradeResponse(item, firstResponse),
            ...(prev.attempts > 1 ? { retryCorrect: gradeResponse(item, prev.response) } : {}),
        };
    }
    return answers;
}

export function reconcileShadow(C, lesson, stored = {}) {
    return Object.fromEntries(lessonItemIds(lesson)
        .filter((id) => C.ITEMS[id]?.part === 'shadow' && ['good', 'ok', 'again', 'skip'].includes(stored[id]?.rating))
        .map((id) => [id, stored[id]]));
}

export function storedAnswers(C, lesson, answers) {
    return { ...answers, [CONTENT_VERSION]: contentVersion(C, lesson) };
}
