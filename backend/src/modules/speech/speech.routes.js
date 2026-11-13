/**
 * Native-speaker comparison – proxies the learner's recording to the
 * pronunciation service configured in SPEECH_API_URL and normalises the result.
 *
 * Upstream request (multipart/form-data): audio, referenceText, itemId, referenceAudio?
 * Upstream response (JSON): { score | similarity | percent, transcript?, words?, scores? }
 * If your provider's contract differs, adapt `callProvider` / `normalise` only.
 */
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { ah, parse } from '../../lib/http.js';
import { HttpError, badRequest, unavailable } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { requireAuth } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { getContent } from '../content/content.service.js';

const upload = multer({
    storage: multer.memoryStorage(), // recordings are never written to disk
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, /^audio\//.test(file.mimetype)),
});

function clampPct(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.round(Math.max(0, Math.min(100, n <= 1 ? n * 100 : n)));
}

function normalise(json) {
    const score = clampPct(json.score ?? json.similarity ?? json.percent);
    if (score == null) throw new HttpError(502, 'Dịch vụ chấm phát âm trả về dữ liệu không hợp lệ.', { code: 'speech-bad-response' });
    return {
        score,
        transcript: typeof json.transcript === 'string' ? json.transcript : null,
        words: Array.isArray(json.words) ? json.words.map((w) => ({ text: String(w.text ?? ''), status: ['ok', 'miss', 'extra'].includes(w.status) ? w.status : 'ok', score: w.score ?? undefined })) : null,
        scores: json.scores ?? null,
    };
}

async function callProvider({ file, referenceText, itemId, referenceAudio }) {
    const form = new FormData();
    form.append('audio', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'recording.webm');
    form.append('referenceText', referenceText);
    form.append('itemId', itemId);
    if (referenceAudio) form.append('referenceAudio', referenceAudio);

    const res = await fetch(env.SPEECH_API_URL, {
        method: 'POST',
        headers: env.SPEECH_API_KEY ? { Authorization: `Bearer ${env.SPEECH_API_KEY}` } : undefined,
        body: form,
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
        logger.warn(`Speech API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
        throw new HttpError(502, 'Không so sánh được lúc này. Vui lòng thử lại.', { code: 'speech-upstream' });
    }
    return normalise(await res.json());
}

export const speechRoutes = Router();

speechRoutes.post(
    '/assess',
    requireAuth,
    aiLimiter,
    upload.single('audio'),
    ah(async (req, res) => {
        if (!env.speechEnabled) throw unavailable('Dịch vụ so sánh phát âm chưa được kết nối.', { code: 'speech-disabled' });
        if (!req.file?.size) throw badRequest('Chưa có bản ghi để so sánh.', { field: 'audio' });
        const { itemId } = parse(z.object({ itemId: z.string().min(1).max(100) }), req.body);

        // the reference always comes from our own content, never from the client
        const C = await getContent();
        const item = C.ITEMS[itemId];
        if (!item || item.part !== 'shadow') throw badRequest('Câu luyện nói không tồn tại.');

        res.json(await callProvider({ file: req.file, referenceText: item.text, itemId, referenceAudio: item.audioUrl }));
    })
);
