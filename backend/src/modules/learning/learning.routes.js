import { Router } from 'express';
import { z } from 'zod';
import { ah, parse } from '../../lib/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { learningService as svc } from './learning.service.js';
import { reviewService } from '../review/review.service.js';
import { notebookService } from '../notebook/notebook.service.js';
import { supportService } from '../support/support.service.js';
import { supportLimiter } from '../../middleware/rateLimit.js';

const id = z.coerce.number().int().positive();
const itemId = z.string().min(1).max(100);
const response = z.union([z.string().max(500), z.array(z.string().max(200)).max(30)]);
const contentVersion = z.string().max(128).optional();

export const learningRoutes = Router();
learningRoutes.use(requireAuth);

/* ───── Journey & lessons ───── */
learningRoutes.get('/overview', ah(async (req, res) => res.json(await svc.overview(req.user.id))));
learningRoutes.get('/stages/:id', ah(async (req, res) => res.json(await svc.stage(req.user.id, parse(id, req.params.id)))));
learningRoutes.get('/lessons/:id', ah(async (req, res) => res.json(await svc.lessonInfo(req.user.id, parse(id, req.params.id)))));
learningRoutes.get('/history', ah(async (req, res) => res.json(await svc.history(req.user.id))));
learningRoutes.put(
    '/goal',
    ah(async (req, res) => {
        const { goal } = parse(z.object({ goal: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(30)], { error: 'Mục tiêu không hợp lệ.' }) }), req.body);
        res.json({ goal: await svc.setGoal(req.user.id, goal) });
    })
);

/* ───── Lesson session ───── */
const L = '/lessons/:id/session';
learningRoutes.post(L, ah(async (req, res) => res.json(await svc.startLesson(req.user.id, parse(id, req.params.id)))));
learningRoutes.delete(L, ah(async (req, res) => res.json({ ok: await svc.restartLesson(req.user.id, parse(id, req.params.id)) })));
learningRoutes.patch(
    `${L}/step`,
    ah(async (req, res) => {
        const { step } = parse(z.object({ step: z.number().int().min(0).max(500) }), req.body);
        res.json({ ok: await svc.saveStep(req.user.id, parse(id, req.params.id), step) });
    })
);
learningRoutes.post(
    `${L}/answers`,
    ah(async (req, res) => {
        const b = parse(z.object({ itemId, response, contentVersion }), req.body);
        res.json(await svc.answer(req.user.id, parse(id, req.params.id), b.itemId, b.response, b.contentVersion));
    })
);
learningRoutes.post(
    `${L}/shadow`,
    ah(async (req, res) => {
        const b = parse(z.object({ itemId, rating: z.enum(['good', 'ok', 'again', 'skip'], { error: 'Đánh giá không hợp lệ.' }), contentVersion }), req.body);
        res.json(await svc.rateShadow(req.user.id, parse(id, req.params.id), b.itemId, b.rating, b.contentVersion));
    })
);
learningRoutes.post(`${L}/finish`, ah(async (req, res) => {
    const b = parse(z.object({ contentVersion }), req.body ?? {});
    res.json(await svc.finishLesson(req.user.id, parse(id, req.params.id), b.contentVersion));
}));

/* ───── Review (spaced repetition) ───── */
learningRoutes.get(
    '/review/queue',
    ah(async (req, res) => {
        const q = parse(z.object({ scope: z.enum(['due', 'all']).optional(), items: z.string().max(2000).optional() }), req.query);
        const itemIds = q.items ? q.items.split(',').filter(Boolean) : undefined;
        res.json(await reviewService.queue(req.user.id, { scope: q.scope, itemIds }));
    })
);
learningRoutes.get('/review', ah(async (req, res) => res.json(await reviewService.list(req.user.id))));
learningRoutes.post(
    '/review/answers',
    ah(async (req, res) => {
        const b = parse(z.object({ itemId, response, reviewToken: z.string().max(2048).optional() }), req.body);
        res.json(await reviewService.answer(req.user.id, b.itemId, b.response, b.reviewToken));
    })
);

/* ───── Notebook ───── */
const entryId = z.string().regex(/^(word|sentence):[\w-]+$/, 'Mục không hợp lệ.');
learningRoutes.get('/notebook/catalog', ah(async (req, res) => res.json(await notebookService.catalog(req.user.id))));
learningRoutes.get('/notebook', ah(async (req, res) => res.json(await notebookService.list(req.user.id))));
learningRoutes.post(
    '/notebook',
    ah(async (req, res) => {
        const b = parse(z.object({ type: z.enum(['word', 'sentence']), ref: z.string().min(1).max(100) }), req.body);
        res.status(201).json(await notebookService.save(req.user.id, b));
    })
);
learningRoutes.delete('/notebook/:entryId', ah(async (req, res) => res.json({ ok: await notebookService.remove(req.user.id, parse(entryId, req.params.entryId)) })));
learningRoutes.post('/notebook/:entryId/favorite', ah(async (req, res) => res.json(await notebookService.toggleFavorite(req.user.id, parse(entryId, req.params.entryId)))));
learningRoutes.post(
    '/notebook/:entryId/review',
    ah(async (req, res) => {
        const { known } = parse(z.object({ known: z.boolean() }), req.body);
        res.json(await notebookService.markCard(req.user.id, parse(entryId, req.params.entryId), known));
    })
);

/* ───── Support (messages to the admins) ───── */
const supportBody = z.object({ body: z.string({ error: 'Vui lòng nhập nội dung.' }).trim().min(1, 'Vui lòng nhập nội dung.').max(2000, 'Tin nhắn tối đa 2000 ký tự.') });
learningRoutes.get('/support', ah(async (req, res) => res.json(await supportService.thread(req.user.id))));
learningRoutes.get('/support/unread', ah(async (req, res) => res.json({ unread: await supportService.unread(req.user.id) })));
learningRoutes.post('/support', supportLimiter, ah(async (req, res) => res.status(201).json(await supportService.send(req.user, parse(supportBody, req.body).body))));
