/**
 * Support inbox: one conversation per learner, answered by the admins.
 * A message belongs to the learner's thread (`userId`); `fromAdmin` tells who wrote it.
 * `readAt` is set when the other side opens the thread.
 */
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { sendSupportNotice } from '../../lib/mailer.js';
import { logger } from '../../lib/logger.js';

const toMessage = (m) => ({ id: m.id, fromAdmin: m.fromAdmin, body: m.body, at: m.createdAt.getTime(), read: !!m.readAt });

export function createSupportService(db = prisma) {
    return {
        /* ───── learner ───── */
        /** The learner's conversation; opening it marks the admin's replies as read. */
        async thread(userId) {
            const rows = await db.supportMessage.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
            if (rows.some((m) => m.fromAdmin && !m.readAt)) {
                await db.supportMessage.updateMany({ where: { userId, id: { in: rows.map((m) => m.id) }, fromAdmin: true, readAt: null }, data: { readAt: new Date() } });
            }
            return rows.map(toMessage);
        },

        unread: (userId) => db.supportMessage.count({ where: { userId, fromAdmin: true, readAt: null } }),

        async send(user, body) {
            const m = await db.supportMessage.create({ data: { userId: user.id, fromAdmin: false, body } });
            // best effort: the message is already saved, a mail hiccup must not fail the request
            await sendSupportNotice({ name: user.name, email: user.email, body }).catch((e) => logger.warn('Support notice mail failed:', e.message));
            return toMessage(m);
        },

        /* ───── admin ───── */
        /** Every conversation, newest activity first, with the number of learner messages not read yet. */
        async threads() {
            const [last, unread] = await Promise.all([
                db.supportMessage.groupBy({ by: ['userId'], _max: { createdAt: true }, _count: { _all: true } }),
                db.supportMessage.groupBy({ by: ['userId'], where: { fromAdmin: false, readAt: null }, _count: { _all: true } }),
            ]);
            if (!last.length) return [];
            const ids = last.map((t) => t.userId);
            const [users, previews] = await Promise.all([
                db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }),
                db.supportMessage.findMany({ where: { userId: { in: ids } }, orderBy: { createdAt: 'desc' }, distinct: ['userId'], select: { userId: true, body: true, fromAdmin: true } }),
            ]);
            const U = new Map(users.map((u) => [u.id, u]));
            const P = new Map(previews.map((p) => [p.userId, p]));
            const N = new Map(unread.map((u) => [u.userId, u._count._all]));
            return last
                .filter((t) => U.has(t.userId))
                .map((t) => ({
                    user: U.get(t.userId),
                    lastAt: t._max.createdAt.getTime(),
                    total: t._count._all,
                    unread: N.get(t.userId) ?? 0,
                    preview: (P.get(t.userId)?.body ?? '').slice(0, 120),
                    lastFromAdmin: !!P.get(t.userId)?.fromAdmin,
                }))
                .sort((a, b) => (b.unread > 0) - (a.unread > 0) || b.lastAt - a.lastAt);
        },

        /** One learner's conversation as the admin sees it; opening it marks the learner's messages as read. */
        async adminThread(userId) {
            const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, createdAt: true } });
            if (!user) throw notFound('Không tìm thấy người dùng.');
            const rows = await db.supportMessage.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
            if (rows.some((m) => !m.fromAdmin && !m.readAt)) {
                await db.supportMessage.updateMany({ where: { userId, id: { in: rows.map((m) => m.id) }, fromAdmin: false, readAt: null }, data: { readAt: new Date() } });
            }
            return { user: { ...user, createdAt: user.createdAt.getTime() }, messages: rows.map(toMessage) };
        },

        async reply(userId, body) {
            const exists = await db.user.count({ where: { id: userId } });
            if (!exists) throw notFound('Không tìm thấy người dùng.');
            return toMessage(await db.supportMessage.create({ data: { userId, fromAdmin: true, body } }));
        },

        adminUnread: () => db.supportMessage.count({ where: { fromAdmin: false, readAt: null } }),
    };
}

export const supportService = createSupportService();
