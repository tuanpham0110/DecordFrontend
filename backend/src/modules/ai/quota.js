/**
 * Per-learner daily AI quota, kept in the DB so it holds across serverless instances and restarts.
 * Shared by the tutor chat and the AI pronunciation check: both spend the same Gemini budget.
 */
import { env } from '../../config/env.js';
import { tooMany } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { dayKey } from '../../lib/time.js';

/** Takes one turn for today; throws 429 when the daily limit is used up. Returns the day key to refund against. */
export async function takeQuota(userId) {
    const day = dayKey();
    const { count } = await prisma.aiUsage.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, count: 1 },
        update: { count: { increment: 1 } },
        select: { count: true },
    });
    if (count > env.AI_DAILY_LIMIT) {
        await refundQuota(userId, day);
        throw tooMany(`Bạn đã dùng hết ${env.AI_DAILY_LIMIT} lượt dùng AI hôm nay (hỏi trợ lý và chấm phát âm). Hẹn bạn ngày mai nhé!`, { code: 'ai-quota' });
    }
    return day;
}

/** Provider failures/empty answers do not count. */
export function refundQuota(userId, day) {
    return prisma.aiUsage.updateMany({ where: { userId, day, count: { gt: 0 } }, data: { count: { decrement: 1 } } }).catch(() => {});
}
