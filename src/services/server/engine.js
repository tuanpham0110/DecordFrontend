/**
 * Mock server: all learning rules live here, not in the UI.
 *  - grading (answers never leave this module before the learner submits)
 *  - lesson unlocking (≥ PASS_THRESHOLD on the previous published lesson)
 *  - session autosave / resume
 *  - spaced-repetition review queue (Leitner boxes)
 *  - personal notebook, daily goal, streak, badges
 *
 * When a real backend exists, these functions map 1:1 to endpoints.
 */
import { ITEMS, PARTS, PASS_THRESHOLD, SENTENCES, STAGES, VOCABULARY } from '../../data/content.js';
import { dayKey, load, update } from './store.js';

export class ServerError extends Error {
    constructor(message, { status = 400, code, field } = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.field = field;
    }
}

/* ───────────── helpers ───────────── */
const norm = (s) => String(s ?? '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
const PART_ORDER = ['listen', 'build', 'shadow'];
const DAY = 86400000;
/** Leitner intervals (days) for box 1..4. Reaching box 5 = mastered. */
const BOX_INTERVAL = { 1: 0, 2: 1, 3: 3, 4: 7 };
const MASTERED_BOX = 5;

function allLessons() {
    return STAGES.flatMap((s) => s.lessons.map((l) => ({ ...l, stageId: s.id })));
}
function findLesson(id) {
    const n = Number(id);
    for (const s of STAGES) {
        const l = s.lessons.find((x) => x.id === n);
        if (l) return { lesson: l, stage: s };
    }
    throw new ServerError('Không tìm thấy bài học.', { status: 404 });
}
function lessonItemIds(lesson) {
    return PART_ORDER.flatMap((p) => lesson.parts?.[p] ?? []);
}
function isGradable(item) {
    return item.part !== 'shadow';
}
function gradeResponse(item, response) {
    if (item.kind === 'order') {
        return Array.isArray(response) && response.length === item.answer.length && response.every((t, i) => norm(t) === norm(item.answer[i]));
    }
    return norm(response) === norm(item.answer);
}

/** What the client is allowed to see before answering. */
function publicItem(id) {
    const it = ITEMS[id];
    if (!it) return null;
    const { answer, explain, translation, ...rest } = it;
    return { id, ...rest };
}
function revealed(id) {
    const it = ITEMS[id];
    return { answer: it.answer, explain: it.explain, translation: it.translation };
}

/** Lesson status map: done | current | locked | soon */
function statuses(data) {
    const map = {};
    let gateOpen = true;
    for (const l of allLessons()) {
        if (!l.published) {
            map[l.id] = 'soon';
            continue;
        }
        if (data.lessons[l.id]?.passed) {
            map[l.id] = 'done';
        } else if (gateOpen) {
            map[l.id] = 'current';
            gateOpen = false;
        } else {
            map[l.id] = 'locked';
        }
    }
    return map;
}

function previousPublished(lessonId) {
    const list = allLessons().filter((l) => l.published);
    const i = list.findIndex((l) => l.id === lessonId);
    return i > 0 ? list[i - 1] : null;
}

function lockReason(lessonId, status) {
    if (status === 'soon') return 'Nội dung bài học đang được đội ngũ chuyên môn biên soạn.';
    if (status !== 'locked') return null;
    const prev = previousPublished(lessonId);
    return prev ? `Hoàn thành Bài ${prev.id}: ${prev.title} với kết quả từ ${PASS_THRESHOLD}% để mở khoá.` : null;
}

function decorateStages(data) {
    const st = statuses(data);
    return STAGES.map((s) => {
        const lessons = s.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            minutes: l.minutes,
            published: !!l.published,
            status: st[l.id],
            best: data.lessons[l.id]?.best ?? null,
            attempts: data.lessons[l.id]?.attempts ?? 0,
            inProgress: !!data.sessions[l.id],
            lockReason: lockReason(l.id, st[l.id]),
            counts: l.parts ? Object.fromEntries(PART_ORDER.map((p) => [p, l.parts[p]?.length ?? 0])) : null,
        }));
        const completed = lessons.filter((l) => l.status === 'done').length;
        const percent = Math.round((completed / lessons.length) * 100);
        const anyOpen = lessons.some((l) => l.status === 'done' || l.status === 'current');
        return {
            id: s.id,
            code: s.code,
            tone: s.tone,
            title: s.title,
            summary: s.summary,
            lessons,
            completed,
            total: lessons.length,
            published: lessons.filter((l) => l.published).length,
            percent,
            status: percent === 100 ? 'done' : anyOpen ? 'active' : lessons.every((l) => !l.published) ? 'soon' : 'locked',
        };
    });
}

function bumpDaily(data, { answered = 0, correct = 0 } = {}) {
    const k = dayKey();
    const d = data.daily[k] || { answered: 0, correct: 0 };
    d.answered += answered;
    d.correct += correct;
    data.daily[k] = d;
}

function streakOf(data) {
    let n = 0;
    const d = new Date();
    // today counts if active; otherwise the streak is still alive from yesterday
    if (!data.daily[dayKey(d)]?.answered) d.setDate(d.getDate() - 1);
    while (data.daily[dayKey(d)]?.answered) {
        n++;
        d.setDate(d.getDate() - 1);
    }
    return n;
}

function scheduleCard(card, correct, now = Date.now()) {
    if (correct) {
        card.box = Math.min(MASTERED_BOX, card.box + 1);
        card.right += 1;
    } else {
        card.box = 1;
        card.wrong += 1;
    }
    card.mastered = card.box >= MASTERED_BOX;
    card.due = card.mastered ? null : now + (BOX_INTERVAL[card.box] ?? 0) * DAY;
    card.lastAt = now;
    card.lastCorrect = correct;
}

function addToReview(data, itemId, lessonId) {
    const now = Date.now();
    const card = data.review[itemId];
    if (card) {
        card.box = 1;
        card.mastered = false;
        card.due = now;
        card.wrong += 1;
        card.lastAt = now;
        card.lastCorrect = false;
    } else {
        data.review[itemId] = {
            itemId,
            part: ITEMS[itemId].part,
            lessonId,
            box: 1,
            due: now,
            wrong: 1,
            right: 0,
            mastered: false,
            addedAt: now,
            lastAt: now,
            lastCorrect: false,
        };
    }
}

function itemLabel(id) {
    const it = ITEMS[id];
    if (it.kind === 'shadow') return it.text;
    if (it.kind === 'order') return it.answer.join(' ');
    if (it.kind === 'fill') return [it.before, it.answer, it.after].filter(Boolean).join(' ');
    return it.audioText;
}

const BADGES = [
    { id: 'khoi-dau', title: 'Khởi đầu', desc: 'Hoàn thành bài học đầu tiên', icon: 'flag', test: (d) => Object.values(d.lessons).some((l) => l.passed) },
    { id: 'tai-thinh', title: 'Tai thính', desc: 'Nghe đúng 10 câu', icon: 'headphones', test: (d) => d.partStats.listen.correct >= 10 },
    { id: 'kien-tri', title: 'Kiên trì', desc: 'Học 3 ngày liên tiếp', icon: 'flame', test: (d) => streakOf(d) >= 3 },
    { id: 'hoan-hao', title: 'Hoàn hảo', desc: 'Đạt 100% một bài học', icon: 'star', test: (d) => d.attempts.some((a) => a.score === 100) },
    { id: 'cham-on', title: 'Chăm ôn', desc: 'Ôn tập 10 lượt', icon: 'refresh', test: (d) => (d.reviewDone || 0) >= 10 },
];

/* ───────────── public API ───────────── */
export const engine = {
    overview(email) {
        const data = load(email);
        const stages = decorateStages(data);
        const lessons = stages.flatMap((s) => s.lessons.map((l) => ({ ...l, stage: s })));
        const total = lessons.length;
        const completed = lessons.filter((l) => l.status === 'done').length;
        const currentL = lessons.find((l) => l.status === 'current');

        // most recently touched in-progress session
        const sessions = Object.values(data.sessions).sort((a, b) => b.updatedAt - a.updatedAt);
        const s0 = sessions[0];
        let resume = null;
        if (s0) {
            const { lesson, stage } = findLesson(s0.lessonId);
            const ids = lessonItemIds(lesson);
            const done = ids.filter((id) => s0.answers[id] || s0.shadow[id]).length;
            resume = {
                lessonId: lesson.id,
                title: lesson.title,
                stageId: stage.id,
                stageTitle: stage.title,
                done,
                total: ids.length,
                part: PARTS[ITEMS[ids[Math.min(done, ids.length - 1)]].part].title,
                updatedAt: s0.updatedAt,
            };
        }

        const now = Date.now();
        const cards = Object.values(data.review);
        const due = cards.filter((c) => !c.mastered && c.due <= now);
        const week = [...Array(7)].map((_, i) => {
            const d = new Date(now - (6 - i) * DAY);
            const rec = data.daily[dayKey(d)] || { answered: 0, correct: 0 };
            return { day: dayKey(d), weekday: d.getDay(), ...rec };
        });
        const scored = Object.values(data.lessons).filter((l) => l.best != null);
        const minutes = Math.round(data.attempts.reduce((n, a) => n + (a.durationSec || 0), 0) / 60);

        return {
            stages,
            total,
            completed,
            percent: Math.round((completed / total) * 100),
            published: lessons.filter((l) => l.published).length,
            current: currentL ? { stage: currentL.stage, lesson: currentL } : null,
            resume,
            threshold: PASS_THRESHOLD,
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
                    .map((c) => ({ itemId: c.itemId, part: c.part, label: itemLabel(c.itemId), wrong: c.wrong, lessonId: c.lessonId })),
            },
            recent: data.attempts.slice(0, 5),
            badges: BADGES.map(({ test, ...b }) => ({ ...b, earned: test(data) })),
        };
    },

    stage(email, id) {
        const stage = decorateStages(load(email)).find((s) => s.id === Number(id));
        if (!stage) throw new ServerError('Không tìm thấy chặng học.', { status: 404 });
        return stage;
    },

    lessonInfo(email, id) {
        const { lesson, stage } = findLesson(id);
        const stages = decorateStages(load(email));
        const ds = stages.find((s) => s.id === stage.id);
        const dl = ds.lessons.find((l) => l.id === lesson.id);
        const data = load(email);
        const history = data.attempts.filter((a) => a.lessonId === lesson.id).slice(0, 5);
        const flat = stages.flatMap((s) => s.lessons);
        const idx = flat.findIndex((l) => l.id === lesson.id);
        return {
            ...dl,
            goals: lesson.goals ?? [],
            stage: { id: ds.id, title: ds.title, tone: ds.tone, code: ds.code },
            history,
            threshold: PASS_THRESHOLD,
            prevId: flat[idx - 1]?.id ?? null,
            nextId: flat[idx + 1]?.id ?? null,
        };
    },

    /** Opens (or resumes) a lesson. Enforces the unlock rule. */
    startLesson(email, id) {
        const { lesson, stage } = findLesson(id);
        return update(email, (data) => {
            const st = statuses(data)[lesson.id];
            if (st === 'soon') throw new ServerError(lockReason(lesson.id, st), { status: 403, code: 'soon' });
            if (st === 'locked') throw new ServerError(lockReason(lesson.id, st), { status: 403, code: 'locked' });
            if (!data.sessions[lesson.id]) {
                data.sessions[lesson.id] = { lessonId: lesson.id, startedAt: Date.now(), updatedAt: Date.now(), step: 0, answers: {}, shadow: {} };
            }
            const session = data.sessions[lesson.id];
            // send back what was already answered so the player can restore feedback
            const answered = Object.fromEntries(
                Object.entries(session.answers).map(([itemId, a]) => [itemId, { ...a, ...revealed(itemId) }])
            );
            return {
                lesson: { id: lesson.id, title: lesson.title, minutes: lesson.minutes, goals: lesson.goals ?? [] },
                stage: { id: stage.id, title: stage.title, tone: stage.tone },
                parts: PART_ORDER.map((p) => ({ ...PARTS[p], items: (lesson.parts[p] ?? []).map(publicItem) })).filter((p) => p.items.length),
                session: { step: session.step, answers: answered, shadow: session.shadow },
                threshold: PASS_THRESHOLD,
                best: data.lessons[lesson.id]?.best ?? null,
            };
        });
    },

    saveStep(email, lessonId, step) {
        return update(email, (data) => {
            const s = data.sessions[Number(lessonId)];
            if (!s) throw new ServerError('Phiên học đã kết thúc.', { status: 409 });
            s.step = step;
            s.updatedAt = Date.now();
            return true;
        });
    },

    answer(email, lessonId, itemId, response) {
        const { lesson } = findLesson(lessonId);
        if (!lessonItemIds(lesson).includes(itemId) || !isGradable(ITEMS[itemId])) {
            throw new ServerError('Câu hỏi không thuộc bài học này.', { status: 400 });
        }
        return update(email, (data) => {
            const s = data.sessions[lesson.id];
            if (!s) throw new ServerError('Phiên học đã kết thúc. Hãy mở lại bài học.', { status: 409 });
            const item = ITEMS[itemId];
            const correct = gradeResponse(item, response);
            const prev = s.answers[itemId];
            if (!prev) {
                s.answers[itemId] = { correct, firstResponse: response, response, attempts: 1 };
                bumpDaily(data, { answered: 1, correct: correct ? 1 : 0 });
                data.partStats[item.part].total += 1;
                if (correct) data.partStats[item.part].correct += 1;
                if (!correct) addToReview(data, itemId, lesson.id);
            } else {
                prev.response = response;
                prev.attempts += 1;
                prev.retryCorrect = correct;
            }
            s.updatedAt = Date.now();
            return { correct, firstTry: !prev, ...revealed(itemId) };
        });
    },

    rateShadow(email, lessonId, itemId, rating) {
        const { lesson } = findLesson(lessonId);
        if (!lessonItemIds(lesson).includes(itemId) || ITEMS[itemId].part !== 'shadow') {
            throw new ServerError('Câu luyện nói không thuộc bài học này.', { status: 400 });
        }
        if (!['good', 'ok', 'again', 'skip'].includes(rating)) throw new ServerError('Đánh giá không hợp lệ.');
        return update(email, (data) => {
            const s = data.sessions[lesson.id];
            if (!s) throw new ServerError('Phiên học đã kết thúc. Hãy mở lại bài học.', { status: 409 });
            const first = !s.shadow[itemId];
            s.shadow[itemId] = { rating, at: Date.now() };
            if (first) {
                data.partStats.shadow.total += 1;
                if (rating !== 'skip') {
                    data.partStats.shadow.practiced += 1;
                    bumpDaily(data, { answered: 1, correct: rating === 'again' ? 0 : 1 });
                }
            }
            if (rating === 'again') addToReview(data, itemId, lesson.id);
            s.updatedAt = Date.now();
            return { rating };
        });
    },

    finishLesson(email, lessonId) {
        const { lesson, stage } = findLesson(lessonId);
        return update(email, (data) => {
            const s = data.sessions[lesson.id];
            if (!s) throw new ServerError('Không tìm thấy phiên học để chấm điểm.', { status: 409 });
            const before = statuses(data);

            const parts = {};
            for (const p of PART_ORDER) {
                const ids = lesson.parts[p] ?? [];
                if (p === 'shadow') {
                    parts.shadow = { practiced: ids.filter((id) => s.shadow[id] && s.shadow[id].rating !== 'skip').length, total: ids.length };
                } else {
                    parts[p] = { correct: ids.filter((id) => s.answers[id]?.correct).length, total: ids.length };
                }
            }
            const gradable = parts.listen.total + parts.build.total;
            const correct = parts.listen.correct + parts.build.correct;
            const score = gradable ? Math.round((correct / gradable) * 100) : 100;
            const passed = score >= PASS_THRESHOLD;
            const now = Date.now();

            const wrongIds = lessonItemIds(lesson).filter((id) =>
                ITEMS[id].part === 'shadow' ? s.shadow[id]?.rating === 'again' : !s.answers[id]?.correct
            );
            // unanswered gradable items are treated as wrong and queued for review
            for (const id of wrongIds) if (ITEMS[id].part !== 'shadow' && !s.answers[id]) addToReview(data, id, lesson.id);

            const attempt = {
                id: `${lesson.id}-${now}`,
                lessonId: lesson.id,
                stageId: stage.id,
                title: lesson.title,
                score,
                passed,
                parts,
                at: now,
                durationSec: Math.min(1800, Math.round((now - s.startedAt) / 1000)),
            };
            data.attempts.unshift(attempt);
            data.attempts = data.attempts.slice(0, 100);
            const rec = data.lessons[lesson.id] || { best: null, passed: false, attempts: 0 };
            rec.best = Math.max(rec.best ?? 0, score);
            rec.passed = rec.passed || passed;
            rec.attempts += 1;
            rec.lastAt = now;
            data.lessons[lesson.id] = rec;
            delete data.sessions[lesson.id];

            const after = statuses(data);
            const unlocked = Object.keys(after).filter((id) => before[id] === 'locked' && after[id] === 'current').map(Number);
            const next = allLessons().find((l) => after[l.id] === 'current');

            return {
                ...attempt,
                threshold: PASS_THRESHOLD,
                best: rec.best,
                unlocked: unlocked.map((id) => {
                    const { lesson: ul } = findLesson(id);
                    return { id, title: ul.title };
                }),
                next: next ? { id: next.id, title: next.title, stageId: next.stageId } : null,
                review: wrongIds.map((id) => ({ itemId: id, part: ITEMS[id].part, label: itemLabel(id) })),
            };
        });
    },

    restartLesson(email, lessonId) {
        return update(email, (data) => {
            delete data.sessions[Number(lessonId)];
            return true;
        });
    },

    /* ───── review (SRS) ───── */
    reviewQueue(email, { scope = 'due', itemIds } = {}) {
        const data = load(email);
        const now = Date.now();
        let cards = Object.values(data.review).filter((c) => !c.mastered && ITEMS[c.itemId]);
        if (itemIds?.length) cards = cards.filter((c) => itemIds.includes(c.itemId));
        else if (scope === 'due') cards = cards.filter((c) => c.due <= now);
        return cards
            .sort((a, b) => a.due - b.due)
            .map((c) => ({ ...c, label: itemLabel(c.itemId), item: publicItem(c.itemId) }));
    },

    reviewList(email) {
        const data = load(email);
        const now = Date.now();
        return Object.values(data.review)
            .filter((c) => ITEMS[c.itemId])
            .sort((a, b) => (a.mastered - b.mastered) || a.due - b.due)
            .map((c) => ({ ...c, isDue: !c.mastered && c.due <= now, label: itemLabel(c.itemId), partTitle: PARTS[c.part].title }));
    },

    reviewAnswer(email, itemId, response) {
        const item = ITEMS[itemId];
        if (!item) throw new ServerError('Không tìm thấy câu ôn tập.', { status: 404 });
        return update(email, (data) => {
            const card = data.review[itemId];
            if (!card) throw new ServerError('Câu này không có trong danh sách ôn tập.', { status: 404 });
            let correct;
            if (item.part === 'shadow') {
                if (!['good', 'ok', 'again'].includes(response)) throw new ServerError('Đánh giá không hợp lệ.');
                correct = response !== 'again';
            } else {
                correct = gradeResponse(item, response);
            }
            scheduleCard(card, correct);
            data.reviewDone = (data.reviewDone || 0) + 1;
            bumpDaily(data, { answered: 1, correct: correct ? 1 : 0 });
            return { correct, box: card.box, mastered: card.mastered, due: card.due, ...revealed(itemId) };
        });
    },

    /* ───── notebook ───── */
    catalog(email) {
        const data = load(email);
        const words = VOCABULARY.map((v) => ({ id: `word:${v.id}`, type: 'word', ref: v.id, text: v.word, meaning: v.meaning, topic: v.topic, lessonId: v.lessonId, note: v.note }));
        const sentences = SENTENCES.map((s) => ({ id: `sentence:${s.id}`, type: 'sentence', ref: s.id, text: s.text, meaning: s.meaning, topic: s.topic, lessonId: s.lessonId }));
        return [...words, ...sentences].map((e) => ({ ...e, saved: !!data.notebook[e.id], favorite: !!data.notebook[e.id]?.favorite }));
    },

    notebook(email) {
        const data = load(email);
        const cat = Object.fromEntries(engine.catalog(email).map((e) => [e.id, e]));
        return Object.values(data.notebook)
            .filter((n) => cat[n.id])
            .sort((a, b) => b.savedAt - a.savedAt)
            .map((n) => ({ ...cat[n.id], ...n }));
    },

    saveToNotebook(email, { type, ref }) {
        const id = `${type}:${ref}`;
        const exists = engine.catalog(email).some((e) => e.id === id);
        if (!exists) throw new ServerError('Không tìm thấy mục cần lưu.', { status: 404 });
        return update(email, (data) => {
            if (!data.notebook[id]) data.notebook[id] = { id, favorite: false, savedAt: Date.now(), reviews: 0 };
            return data.notebook[id];
        });
    },

    removeFromNotebook(email, id) {
        return update(email, (data) => {
            delete data.notebook[id];
            return true;
        });
    },

    toggleFavorite(email, id) {
        return update(email, (data) => {
            const n = data.notebook[id];
            if (!n) throw new ServerError('Mục này chưa có trong sổ tay.', { status: 404 });
            n.favorite = !n.favorite;
            return n;
        });
    },

    markFlashcard(email, id, known) {
        return update(email, (data) => {
            const n = data.notebook[id];
            if (n) {
                n.reviews = (n.reviews || 0) + 1;
                n.known = known;
                n.lastReviewAt = Date.now();
            }
            return n ?? null;
        });
    },

    setGoal(email, goal) {
        const g = Number(goal);
        if (![5, 10, 20, 30].includes(g)) throw new ServerError('Mục tiêu không hợp lệ.', { field: 'goal' });
        return update(email, (data) => {
            data.goal = g;
            return g;
        });
    },

    history(email) {
        return load(email).attempts;
    },
};

/* Used by the public trial (no account): pure grading without persistence. */
export function gradeLocal(itemId, response) {
    const item = ITEMS[itemId];
    return { correct: gradeResponse(item, response), ...revealed(itemId) };
}
export function publicItems(ids) {
    return ids.map(publicItem);
}
