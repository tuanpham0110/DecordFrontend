import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getContent } from '../content/content.service.js';
import { gradeResponse, isEarlyReview, itemLabel, publicItem, revealed, scheduleCard } from '../learning/rules.js';
import { bumpDaily, toCard } from '../learning/state.js';
import { learnerTransaction } from '../learning/transaction.js';
import { assertReviewToken, reviewToken } from './token.js';

export const reviewService = {
    async queue(userId, { scope = 'due', itemIds } = {}) {
        const C = await getContent();
        const rows = await prisma.reviewCard.findMany({ where: { userId, mastered: false } });
        const now = Date.now();
        let cards = rows.map(toCard).filter((c) => C.ITEMS[c.itemId]);
        if (itemIds?.length) cards = cards.filter((c) => itemIds.includes(c.itemId));
        else if (scope === 'due') cards = cards.filter((c) => c.due <= now);
        return cards.sort((a, b) => a.due - b.due).map((c) => ({ ...c, reviewToken: reviewToken(userId, c, C.ITEMS[c.itemId]), label: itemLabel(C, c.itemId), item: publicItem(C, c.itemId) }));
    },

    async list(userId) {
        const C = await getContent();
        const now = Date.now();
        const rows = await prisma.reviewCard.findMany({ where: { userId } });
        return rows
            .map(toCard)
            .filter((c) => C.ITEMS[c.itemId])
            .sort((a, b) => a.mastered - b.mastered || (a.due ?? Infinity) - (b.due ?? Infinity))
            .map((c) => ({ ...c, isDue: !c.mastered && c.due <= now, label: itemLabel(C, c.itemId), partTitle: C.PARTS[c.part].title }));
    },

    async answer(userId, itemId, response, token) {
        const C = await getContent();
        const item = C.ITEMS[itemId];
        if (!item) throw notFound('Không tìm thấy câu ôn tập.');

        return learnerTransaction(userId, async (tx) => {
            const row = await tx.reviewCard.findUnique({ where: { userId_itemId: { userId, itemId } } });
            if (!row) throw notFound('Câu này không có trong danh sách ôn tập.');
            assertReviewToken(token, userId, row, item);
            let correct;
            if (item.part === 'shadow') {
                if (!['good', 'ok', 'again'].includes(response)) throw badRequest('Đánh giá không hợp lệ.');
                correct = response !== 'again';
            } else {
                correct = gradeResponse(item, response);
            }
            const before = toCard(row);
            // practised before the due date: counted as activity, but the schedule does not move up
            const early = correct && isEarlyReview(before);
            const card = scheduleCard(before, correct);
            await tx.reviewCard.update({
                where: { userId_itemId: { userId, itemId } },
                data: {
                    box: card.box,
                    right: card.right,
                    wrong: card.wrong,
                    mastered: card.mastered,
                    due: card.due ? new Date(card.due) : null,
                    lastAt: new Date(card.lastAt),
                    lastCorrect: card.lastCorrect,
                },
            });
            await tx.user.update({ where: { id: userId }, data: { reviewDone: { increment: 1 } } });
            await bumpDaily(tx, userId, { answered: 1, correct: correct ? 1 : 0 });
            return { correct, early, box: card.box, mastered: card.mastered, due: card.due, ...revealed(C, itemId) };
        });
    },
};
