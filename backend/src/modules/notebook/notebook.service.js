import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { ms } from '../../lib/time.js';
import { getContent } from '../content/content.service.js';

function catalogEntries(C) {
    const words = C.VOCABULARY.map((v) => ({ id: `word:${v.id}`, type: 'word', ref: v.id, text: v.word, meaning: v.meaning, topic: v.topic, lessonId: v.lessonId, note: v.note }));
    const sentences = C.SENTENCES.map((s) => ({ id: `sentence:${s.id}`, type: 'sentence', ref: s.id, text: s.text, meaning: s.meaning, topic: s.topic, lessonId: s.lessonId }));
    return [...words, ...sentences];
}

const toEntry = (n) => ({
    id: n.entryId,
    favorite: n.favorite,
    savedAt: ms(n.savedAt),
    reviews: n.reviews,
    known: n.known ?? undefined,
    lastReviewAt: ms(n.lastReviewAt) ?? undefined,
});

export const notebookService = {
    async catalog(userId) {
        const [C, rows] = await Promise.all([getContent(), prisma.notebookEntry.findMany({ where: { userId } })]);
        const saved = new Map(rows.map((r) => [r.entryId, r]));
        return catalogEntries(C).map((e) => ({ ...e, saved: saved.has(e.id), favorite: !!saved.get(e.id)?.favorite }));
    },

    async list(userId) {
        const [C, rows] = await Promise.all([getContent(), prisma.notebookEntry.findMany({ where: { userId }, orderBy: { savedAt: 'desc' } })]);
        const cat = new Map(catalogEntries(C).map((e) => [e.id, e]));
        return rows.filter((r) => cat.has(r.entryId)).map((r) => ({ ...cat.get(r.entryId), ...toEntry(r) }));
    },

    async save(userId, { type, ref }) {
        const C = await getContent();
        const entryId = `${type}:${ref}`;
        if (!catalogEntries(C).some((e) => e.id === entryId)) throw notFound('Không tìm thấy mục cần lưu.');
        const row = await prisma.notebookEntry.upsert({
            where: { userId_entryId: { userId, entryId } },
            update: {},
            create: { userId, entryId },
        });
        return toEntry(row);
    },

    async remove(userId, entryId) {
        await prisma.notebookEntry.deleteMany({ where: { userId, entryId } });
        return true;
    },

    async toggleFavorite(userId, entryId) {
        const row = await prisma.notebookEntry.findUnique({ where: { userId_entryId: { userId, entryId } } });
        if (!row) throw notFound('Mục này chưa có trong sổ tay.');
        const updated = await prisma.notebookEntry.update({ where: { userId_entryId: { userId, entryId } }, data: { favorite: !row.favorite } });
        return toEntry(updated);
    },

    async markCard(userId, entryId, known) {
        const row = await prisma.notebookEntry.findUnique({ where: { userId_entryId: { userId, entryId } } });
        if (!row) return null;
        const updated = await prisma.notebookEntry.update({
            where: { userId_entryId: { userId, entryId } },
            data: { reviews: { increment: 1 }, known, lastReviewAt: new Date() },
        });
        return toEntry(updated);
    },
};
