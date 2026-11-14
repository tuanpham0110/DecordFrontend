/**
 * Pure learning rules – no database access here, easy to unit-test.
 *  - grading
 *  - lesson unlocking (≥ PASS_THRESHOLD on the previous published lesson)
 *  - stage gate (a stage opens only when the previous stage is 100% complete)
 *  - Leitner spaced repetition
 *
 * `C` is the content object from content.service, `data` is the learner state
 * built by state.js (same shape as the former in-browser mock).
 */
import { HttpError } from '../../lib/errors.js';
import { DAY, dayKey } from '../../lib/time.js';
import { PART_ORDER } from '../content/content.service.js';

/** Leitner intervals (days) for box 1..4. Reaching box 5 = mastered. */
export const BOX_INTERVAL = { 1: 0, 2: 1, 3: 3, 4: 7 };
export const MASTERED_BOX = 5;

const norm = (s) => String(s ?? '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');

export const allLessons = (C) => C.STAGES.flatMap((s) => s.lessons);

export function findLesson(C, id) {
    const n = Number(id);
    for (const s of C.STAGES) {
        const l = s.lessons.find((x) => x.id === n);
        if (l) return { lesson: l, stage: s };
    }
    throw new HttpError(404, 'Không tìm thấy bài học.');
}

export const lessonItemIds = (lesson) => PART_ORDER.flatMap((p) => lesson.parts?.[p] ?? []);
export const isGradable = (item) => item.part !== 'shadow';

export function gradeResponse(item, response) {
    if (item.kind === 'order') {
        return Array.isArray(response) && response.length === item.answer.length && response.every((t, i) => norm(t) === norm(item.answer[i]));
    }
    return norm(response) === norm(item.answer);
}

/* ───────────── Option order ─────────────
 * Authors usually write the right answer first, so the stored order must never reach the learner
 * (always pressing "A" would pass the lesson). Options are shuffled per presentation:
 *  - with a seed (lesson session) the order is stable while that session lasts,
 *  - without one (trial, review) it is different every time.
 */
function seededRandom(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    let a = h >>> 0;
    // mulberry32
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function shuffled(list, rand = Math.random) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** What the client may see before answering. `seed` keeps the option order stable (see above). */
export function publicItem(C, id, seed) {
    const it = C.ITEMS[id];
    if (!it) return null;
    const { answer, explain, translation, ...rest } = it;
    if (Array.isArray(rest.options)) rest.options = shuffled(rest.options, seed == null ? Math.random : seededRandom(`${seed}:${id}`));
    return { id, ...rest };
}
export function revealed(C, id) {
    const it = C.ITEMS[id];
    return { answer: it.answer, explain: it.explain, translation: it.translation };
}

export function itemLabel(C, id, { reveal = false } = {}) {
    const it = C.ITEMS[id];
    if (!it) return id;
    if (it.kind === 'shadow') return it.text;
    if (it.kind === 'order') return reveal ? it.answer.join(' ') : it.prompt || 'Sắp xếp các từ thành câu';
    if (it.kind === 'fill') return reveal ? [it.before, it.answer, it.after].filter(Boolean).join(' ') : [it.before, '___', it.after].filter(Boolean).join(' ');
    if (it.kind === 'listen-pick' && !reveal) return it.prompt || 'Nghe và chọn từ';
    return it.audioText;
}

/* ───────────── Stage gate ───────────── */
export function stageComplete(data, stage) {
    const pub = stage.lessons.filter((l) => l.published);
    return pub.length > 0 && pub.every((l) => data.lessons[l.id]?.passed);
}
export function stageGates(C, data) {
    const map = {};
    let open = true;
    for (const s of C.STAGES) {
        map[s.id] = open;
        open = open && stageComplete(data, s);
    }
    return map;
}
export function stageLockReason(C, stageId) {
    const i = C.STAGES.findIndex((s) => s.id === stageId);
    const prev = C.STAGES[i - 1];
    if (!prev) return null;
    return prev.lessons.some((l) => l.published)
        ? `Hoàn thành 100% Chặng ${prev.id}: ${prev.title} để mở khoá.`
        : `Chặng ${prev.id}: ${prev.title} đang được biên soạn. Chặng này mở khi bạn hoàn thành chặng ${prev.id}.`;
}
export function assertStageOpen(C, data, stageId) {
    if (!stageGates(C, data)[stageId]) throw new HttpError(403, stageLockReason(C, stageId), { code: 'stage-locked' });
}

/** Lesson status map: done | current | locked | soon */
export function statuses(C, data) {
    const map = {};
    const gates = stageGates(C, data);
    let gateOpen = true;
    for (const l of allLessons(C)) {
        if (!l.published) {
            map[l.id] = 'soon';
            continue;
        }
        if (data.lessons[l.id]?.passed) map[l.id] = 'done';
        else if (gateOpen && gates[l.stageId]) {
            map[l.id] = 'current';
            gateOpen = false;
        } else {
            map[l.id] = 'locked';
            gateOpen = false;
        }
    }
    return map;
}

function previousPublished(C, lessonId) {
    const list = allLessons(C).filter((l) => l.published);
    const i = list.findIndex((l) => l.id === lessonId);
    return i > 0 ? list[i - 1] : null;
}

export function lockReason(C, data, lessonId, status) {
    if (status === 'soon') return 'Nội dung bài học đang được đội ngũ chuyên môn biên soạn.';
    if (status !== 'locked') return null;
    const stageId = allLessons(C).find((l) => l.id === lessonId)?.stageId;
    if (stageId && !stageGates(C, data)[stageId]) return stageLockReason(C, stageId);
    const prev = previousPublished(C, lessonId);
    return prev ? `Hoàn thành Bài ${prev.id}: ${prev.title} với kết quả từ ${C.PASS_THRESHOLD}% để mở khoá.` : null;
}

export function decorateStages(C, data) {
    const st = statuses(C, data);
    const gates = stageGates(C, data);
    return C.STAGES.map((s, i) => {
        const lessons = s.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            minutes: l.minutes,
            published: !!l.published,
            status: st[l.id],
            best: data.lessons[l.id]?.best ?? null,
            attempts: data.lessons[l.id]?.attempts ?? 0,
            inProgress: !!data.sessions[l.id],
            lockReason: lockReason(C, data, l.id, st[l.id]),
            counts: l.parts ? Object.fromEntries(PART_ORDER.map((p) => [p, l.parts[p]?.length ?? 0])) : null,
        }));
        const completed = lessons.filter((l) => l.status === 'done').length;
        const published = lessons.filter((l) => l.published).length;
        const percent = published ? Math.round((completed / published) * 100) : 0;
        const anyOpen = lessons.some((l) => l.status === 'done' || l.status === 'current');
        const unlocked = gates[s.id];
        const complete = stageComplete(data, s);
        let status;
        if (!unlocked) status = 'locked';
        else if (complete) status = 'done';
        else if (anyOpen) status = 'active';
        else status = lessons.every((l) => !l.published) ? 'soon' : 'locked';
        return {
            id: s.id,
            code: s.code,
            tone: s.tone,
            title: s.title,
            summary: s.summary,
            lessons,
            completed,
            total: published,
            plannedTotal: lessons.length,
            published,
            percent,
            unlocked,
            complete,
            lockReason: unlocked ? null : stageLockReason(C, s.id),
            prevId: C.STAGES[i - 1]?.id ?? null,
            status,
        };
    });
}

/* ───────────── Streak & SRS ───────────── */
export function streakOf(data) {
    let n = 0;
    const d = new Date();
    // today counts if active; otherwise the streak is still alive from yesterday
    if (!data.daily[dayKey(d)]?.answered) d.setTime(d.getTime() - DAY);
    while (data.daily[dayKey(d)]?.answered) {
        n++;
        d.setTime(d.getTime() - DAY);
    }
    return n;
}

/** Longest run of consecutive active days ever (badges must not disappear when a streak breaks). */
export function longestStreakOf(data) {
    const days = Object.keys(data.daily).filter((k) => data.daily[k]?.answered > 0).sort();
    let best = 0;
    let run = 0;
    let prev = null;
    for (const k of days) {
        const t = Date.parse(`${k}T00:00:00Z`);
        run = prev != null && t - prev === DAY ? run + 1 : 1;
        best = Math.max(best, run);
        prev = t;
    }
    return best;
}

/* ───────────── XP ─────────────
 * Derived from records that already exist, so it can be recomputed and audited at any time:
 *  - 1 XP per correct answer counted that day (first try in lessons, reviews, shadowing),
 *    capped per day so replaying the same lesson cannot farm points,
 *  - a bonus for each day the daily goal was reached (judged against the current goal),
 *  - a one-off bonus per passed lesson (passing it again gives nothing).
 */
export const XP = { perCorrect: 1, dailyCap: 50, goalMet: 10, lessonPassed: 20 };

export function dayXp(day, goal) {
    if (!day) return 0;
    return Math.min(XP.dailyCap, Math.max(0, day.correct) * XP.perCorrect) + (day.answered >= goal ? XP.goalMet : 0);
}

export function xpOf(data) {
    const fromDays = Object.values(data.daily).reduce((n, d) => n + dayXp(d, data.goal), 0);
    const passed = Object.values(data.lessons).filter((l) => l.passed).length;
    return fromDays + passed * XP.lessonPassed;
}

/**
 * Lessons that need attention: open review cards grouped by lesson, then lessons attempted
 * without reaching the pass mark. Purely from the learner's own results.
 */
export function focusLessons(C, data, now = Date.now()) {
    const byLesson = new Map();
    for (const c of Object.values(data.review)) {
        if (c.mastered || !C.ITEMS[c.itemId]) continue;
        const f = byLesson.get(c.lessonId) ?? { lessonId: c.lessonId, open: 0, due: 0, wrong: 0 };
        f.open += 1;
        f.wrong += c.wrong;
        if (c.due <= now) f.due += 1;
        byLesson.set(c.lessonId, f);
    }
    for (const [id, p] of Object.entries(data.lessons)) {
        const lessonId = Number(id);
        if (p.attempts > 0 && !p.passed && !byLesson.has(lessonId)) byLesson.set(lessonId, { lessonId, open: 0, due: 0, wrong: 0 });
    }
    const out = [];
    for (const f of byLesson.values()) {
        let found;
        try {
            found = findLesson(C, f.lessonId);
        } catch {
            continue;
        }
        const p = data.lessons[f.lessonId];
        out.push({ ...f, title: found.lesson.title, best: p?.best ?? null, passed: !!p?.passed });
    }
    return out.sort((a, b) => b.wrong - a.wrong || b.open - a.open || (a.best ?? 0) - (b.best ?? 0)).slice(0, 4);
}

/** A card answered before its due date is being practised early, not recalled after the interval. */
export const isEarlyReview = (card, now = Date.now()) => !card.mastered && card.due != null && card.due > now;

/**
 * Mutates and returns the card after a review answer.
 * A correct answer only moves the card up a box once its interval has passed: otherwise four quick
 * answers in one sitting would mark a card "mastered" and the spacing (1 → 3 → 7 days) would mean
 * nothing. Early practice is recorded but keeps the box and the due date; a wrong answer always
 * sends the card back to box 1.
 */
export function scheduleCard(card, correct, now = Date.now()) {
    if (correct && isEarlyReview(card, now)) {
        card.lastAt = now;
        card.lastCorrect = true;
        return card;
    }
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
    return card;
}

export const BADGES = [
    { id: 'khoi-dau', title: 'Khởi đầu', desc: 'Hoàn thành bài học đầu tiên', icon: 'flag', test: (d) => Object.values(d.lessons).some((l) => l.passed) },
    { id: 'tai-thinh', title: 'Tai thính', desc: 'Nghe đúng 10 câu', icon: 'headphones', test: (d) => d.partStats.listen.correct >= 10 },
    { id: 'kien-tri', title: 'Kiên trì', desc: 'Học 3 ngày liên tiếp', icon: 'flame', test: (d) => longestStreakOf(d) >= 3 },
    { id: 'hoan-hao', title: 'Hoàn hảo', desc: 'Đạt 100% một bài học', icon: 'star', test: (d) => d.hasPerfectAttempt ?? d.attempts.some((a) => a.score === 100) },
    { id: 'cham-on', title: 'Chăm ôn', desc: 'Ôn tập 10 lượt', icon: 'refresh', test: (d) => (d.reviewDone || 0) >= 10 },
    { id: 'ben-bi', title: 'Bền bỉ', desc: 'Học 7 ngày liên tiếp', icon: 'calendar', test: (d) => longestStreakOf(d) >= 7 },
    { id: 'tron-chang', title: 'Trọn chặng', desc: 'Hoàn thành 100% một chặng', icon: 'trophy', test: (d) => (d.stagesDone ?? 0) >= 1 },
    { id: 'sieng-on', title: 'Siêng ôn', desc: 'Ôn tập 50 lượt', icon: 'layers', test: (d) => (d.reviewDone || 0) >= 50 },
];
