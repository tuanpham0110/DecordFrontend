/**
 * Course content, loaded from the database and cached in memory.
 * Content changes only through seeding / an admin tool, so a short TTL is enough.
 */
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { formatGuidance } from './guidance.js';

export const PART_ORDER = ['listen', 'build', 'shadow'];

export const PARTS = {
    listen: { key: 'listen', title: 'Bắc âm cầu', subtitle: 'Nghe và chọn đáp án đúng', icon: 'headphones' },
    build: { key: 'build', title: 'Lắp khung câu', subtitle: 'Chọn và sắp xếp từ thành câu', icon: 'puzzle' },
    shadow: { key: 'shadow', title: 'Shadowing', subtitle: 'Nghe và nhại lại câu mẫu', icon: 'mic' },
};

const TTL = 60_000;
let cache = null;
let loadedAt = 0;
let inflight = null;

async function load() {
    const [stages, lessons, links, items, vocabulary, sentences, handbook] = await Promise.all([
        prisma.stage.findMany({ orderBy: { position: 'asc' } }),
        prisma.lesson.findMany({ orderBy: [{ stageId: 'asc' }, { position: 'asc' }] }),
        prisma.lessonItem.findMany({ orderBy: [{ lessonId: 'asc' }, { position: 'asc' }] }),
        prisma.item.findMany(),
        prisma.vocabulary.findMany({ orderBy: { position: 'asc' } }),
        prisma.sentence.findMany({ orderBy: { position: 'asc' } }),
        prisma.handbookArticle.findMany({ orderBy: { position: 'asc' } }),
    ]);

    const ITEMS = Object.fromEntries(
        items.map((it) => [
            it.id,
            { part: it.part, kind: it.kind, ...it.data, answer: it.answer, explain: it.explain ?? undefined, translation: it.translation ?? undefined },
        ])
    );

    const partsOf = {};
    for (const l of links) {
        partsOf[l.lessonId] ??= { listen: [], build: [], shadow: [] };
        partsOf[l.lessonId][l.part].push(l.itemId);
    }

    const STAGES = stages.map((s) => ({
        ...s,
        lessons: lessons
            .filter((l) => l.stageId === s.id)
            .map((l) => ({ id: l.id, stageId: s.id, title: l.title, minutes: l.minutes, published: l.published, goals: (l.goals ?? []).map((g) => formatGuidance(g, env.PASS_THRESHOLD)), parts: partsOf[l.id] ?? null })),
    }));

    return {
        STAGES,
        ITEMS,
        PARTS,
        PASS_THRESHOLD: env.PASS_THRESHOLD,
        VOCABULARY: vocabulary.map(({ position, ...v }) => ({ ...v, note: v.note ?? undefined })),
        SENTENCES: sentences.map(({ position, ...s }) => s),
        HANDBOOK: handbook.map(({ position, ...a }) => ({ ...a, body: Array.isArray(a.body) ? a.body.map((b) => b.p ? { ...b, p: formatGuidance(b.p, env.PASS_THRESHOLD) } : b) : a.body ?? undefined })),
    };
}

/** Returns the cached content, reloading it after TTL. */
export async function getContent() {
    if (cache && Date.now() - loadedAt < TTL) return cache;
    inflight ??= load()
        .then((c) => {
            cache = c;
            loadedAt = Date.now();
            return c;
        })
        .finally(() => {
            inflight = null;
        });
    return inflight;
}

export function invalidateContent() {
    cache = null;
}
