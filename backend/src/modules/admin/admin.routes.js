/**
 * Admin area (role = "admin"): numbers at a glance, learner accounts, support inbox.
 * Grant the role with `npm run admin:grant -- <email>` (see scripts/grant-admin.js).
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ah, parse } from '../../lib/http.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { DAY, dayKey } from '../../lib/time.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { supportService } from '../support/support.service.js';
import { getContent } from '../content/content.service.js';
import { itemLabel, lessonItemIds } from '../learning/rules.js';

const userId = z.string().min(1).max(60);
const message = z.object({ body: z.string({ error: 'Vui lòng nhập nội dung.' }).trim().min(1, 'Vui lòng nhập nội dung.').max(2000, 'Tin nhắn tối đa 2000 ký tự.') });

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireAdmin);

adminRoutes.get(
    '/overview',
    ah(async (_req, res) => {
        const now = Date.now();
        const days = [...Array(7)].map((_, i) => dayKey(new Date(now - (6 - i) * DAY)));
        const [users, newUsers, attempts, passed, activity, unread, lessonsPassed] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { createdAt: { gte: new Date(now - 7 * DAY) } } }),
            prisma.attempt.count(),
            prisma.attempt.count({ where: { passed: true } }),
            prisma.dailyActivity.groupBy({ by: ['day'], where: { day: { in: days } }, _count: { _all: true }, _sum: { answered: true } }),
            supportService.adminUnread(),
            prisma.lessonProgress.count({ where: { passed: true } }),
        ]);
        const A = new Map(activity.map((a) => [a.day, a]));
        res.json({
            users,
            newUsers,
            attempts,
            passRate: attempts ? Math.round((passed / attempts) * 100) : null,
            lessonsPassed,
            activeToday: A.get(days[6])?._count._all ?? 0,
            unreadMessages: unread,
            week: days.map((day) => ({ day, learners: A.get(day)?._count._all ?? 0, answered: A.get(day)?._sum.answered ?? 0 })),
        });
    })
);

adminRoutes.get(
    '/users',
    ah(async (req, res) => {
        const { q, page } = parse(z.object({ q: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).max(1000).optional().default(1) }), req.query);
        const size = 25;
        const where = q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {};
        const [total, rows] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * size,
                take: size,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    verified: true,
                    createdAt: true,
                    googleSub: true,
                    microsoftSub: true,
                    _count: { select: { attempts: true } },
                    progress: { where: { passed: true }, select: { lessonId: true } },
                    daily: { orderBy: { day: 'desc' }, take: 1, select: { day: true } },
                },
            }),
        ]);
        res.json({
            total,
            page,
            pages: Math.max(1, Math.ceil(total / size)),
            users: rows.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                verified: u.verified,
                createdAt: u.createdAt.getTime(),
                provider: u.googleSub ? 'google' : u.microsoftSub ? 'microsoft' : 'email',
                attempts: u._count.attempts,
                lessonsPassed: u.progress.length,
                lastActiveDay: u.daily[0]?.day ?? null,
            })),
        });
    })
);

adminRoutes.patch(
    '/users/:id',
    ah(async (req, res) => {
        const id = parse(userId, req.params.id);
        const { role } = parse(z.object({ role: z.enum(['user', 'admin']) }), req.body);
        if (id === req.user.id) throw badRequest('Bạn không thể tự đổi vai trò của chính mình.', { code: 'self' });
        const exists = await prisma.user.count({ where: { id } });
        if (!exists) throw notFound('Không tìm thấy người dùng.');
        const u = await prisma.user.update({ where: { id }, data: { role } });
        res.json({ id: u.id, role: u.role });
    })
);

adminRoutes.delete(
    '/users/:id',
    ah(async (req, res) => {
        const id = parse(userId, req.params.id);
        if (id === req.user.id) throw badRequest('Hãy xoá tài khoản của chính bạn trong mục Tài khoản.', { code: 'self' });
        const u = await prisma.user.findUnique({ where: { id } });
        if (!u) throw notFound('Không tìm thấy người dùng.');
        if (u.role === 'admin') throw badRequest('Hãy gỡ quyền quản trị của tài khoản này trước khi xoá.', { code: 'is-admin' });
        await prisma.$transaction([prisma.otpCode.deleteMany({ where: { email: u.email } }), prisma.user.delete({ where: { id } })]);
        res.json({ ok: true });
    })
);

/* ───── Content quality ─────
 * Which lessons learners pass and which exercises they miss. A review card is created when a learner
 * misses an item on the first try (or leaves it unanswered, or rates their speaking "cần luyện thêm"),
 * so the number of cards per item = learners who struggled with it.
 */
adminRoutes.get(
    '/content',
    ah(async (_req, res) => {
        const C = await getContent();
        const [attempts, passedAttempts, progress, cards] = await Promise.all([
            prisma.attempt.groupBy({ by: ['lessonId'], _count: { _all: true }, _avg: { score: true } }),
            prisma.attempt.groupBy({ by: ['lessonId'], where: { passed: true }, _count: { _all: true } }),
            prisma.lessonProgress.findMany({ where: { attempts: { gt: 0 } }, select: { userId: true, lessonId: true, passed: true } }),
            prisma.reviewCard.groupBy({ by: ['itemId'], _count: { _all: true }, _sum: { wrong: true } }),
        ]);
        const A = new Map(attempts.map((a) => [a.lessonId, a]));
        const P = new Map(passedAttempts.map((a) => [a.lessonId, a._count._all]));
        const learnersOf = new Map();
        const passedOf = new Map();
        for (const p of progress) {
            if (!learnersOf.has(p.lessonId)) learnersOf.set(p.lessonId, new Set());
            learnersOf.get(p.lessonId).add(p.userId);
            if (p.passed) passedOf.set(p.lessonId, (passedOf.get(p.lessonId) ?? 0) + 1);
        }

        const lessons = C.STAGES.flatMap((s) =>
            s.lessons.map((l) => {
                const a = A.get(l.id);
                return {
                    id: l.id,
                    stageId: s.id,
                    title: l.title,
                    published: !!l.published,
                    items: lessonItemIds(l).length,
                    learners: learnersOf.get(l.id)?.size ?? 0,
                    learnersPassed: passedOf.get(l.id) ?? 0,
                    attempts: a?._count._all ?? 0,
                    passRate: a ? Math.round(((P.get(l.id) ?? 0) / a._count._all) * 100) : null,
                    avgScore: a?._avg.score != null ? Math.round(a._avg.score) : null,
                };
            })
        );

        const items = cards
            .filter((c) => C.ITEMS[c.itemId])
            .map((c) => {
                const it = C.ITEMS[c.itemId];
                const inLessons = C.STAGES.flatMap((s) => s.lessons).filter((l) => lessonItemIds(l).includes(c.itemId)).map((l) => l.id);
                const seen = new Set(inLessons.flatMap((id) => [...(learnersOf.get(id) ?? [])]));
                return {
                    itemId: c.itemId,
                    part: it.part,
                    kind: it.kind,
                    label: itemLabel(C, c.itemId, { reveal: true }),
                    lessons: inLessons,
                    struggled: c._count._all,
                    learners: Math.max(seen.size, c._count._all),
                    wrong: c._sum.wrong ?? 0,
                };
            })
            .map((i) => ({ ...i, rate: Math.round((i.struggled / i.learners) * 100) }))
            .sort((a, b) => b.struggled - a.struggled || b.wrong - a.wrong)
            .slice(0, 20);

        res.json({ threshold: C.PASS_THRESHOLD, lessons, items });
    })
);

/* ───── Support inbox ───── */
adminRoutes.get('/support', ah(async (_req, res) => res.json(await supportService.threads())));
adminRoutes.get('/support/:id', ah(async (req, res) => res.json(await supportService.adminThread(parse(userId, req.params.id)))));
adminRoutes.post('/support/:id', ah(async (req, res) => res.status(201).json(await supportService.reply(parse(userId, req.params.id), parse(message, req.body).body))));
