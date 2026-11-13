/**
 * AI tutor proxy (Google Gemini). The API key never leaves the server.
 * The response is Gemini's own SSE stream, piped through unchanged.
 */
import { Router } from 'express';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { ah, parse } from '../../lib/http.js';
import { HttpError, tooMany, unavailable } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { dayKey } from '../../lib/time.js';
import { requireAuth } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { getContent } from '../content/content.service.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function systemPrompt(C) {
    const verified = [...C.VOCABULARY.map((v) => `- "${v.word}" = "${v.meaning}"`), ...C.SENTENCES.map((s) => `- "${s.text}" = "${s.meaning}"`)].join('\n');
    return `Bạn là "Ếch Mường" – trợ lý học tập của MUONGLAB, nền tảng giúp công chức trẻ học tiếng Mường để giao tiếp với bà con.
Luôn trả lời bằng tiếng Việt, thân thiện, ngắn gọn (tối đa khoảng 150 từ), dùng gạch đầu dòng khi liệt kê.

Bạn có thể giúp:
- Giải thích từ, câu, cách phát âm trong chương trình học.
- Hướng dẫn cách dùng các tính năng: Bài học (${C.STAGES.length} chặng, mỗi bài gồm Bắc âm cầu – nghe chọn đáp án, Lắp khung câu – ghép câu, Shadowing – nghe và nói lại), Ôn luyện (câu sai được nhắc lại theo lịch ngắt quãng), Sổ tay (lưu từ/câu, lật thẻ), Cẩm nang.
- Quy tắc: đạt từ ${C.PASS_THRESHOLD}% mỗi bài để mở bài tiếp theo; phải hoàn thành 100% một chặng thì chặng sau mới mở khoá.
- Gợi ý phương pháp học, động viên người học.

QUY TẮC BẮT BUỘC về tiếng Mường:
- Chỉ những từ/câu sau đã được đội ngũ chuyên môn kiểm chứng:
${verified}
- Với từ hoặc câu tiếng Mường KHÔNG có trong danh sách trên: nói rõ là chưa có trong dữ liệu đã kiểm chứng, không được bịa hoặc đoán nghĩa/cách viết. Nếu nêu một khả năng, phải ghi rõ "chưa kiểm chứng" và khuyên người học hỏi người bản địa.
- Không tự nhận là người bản địa. Tiếng Mường có nhiều phương ngữ, cách nói có thể khác nhau theo vùng.
Từ chối lịch sự các yêu cầu không liên quan tới việc học ngôn ngữ, văn hoá Mường hoặc cách dùng MUONGLAB.`;
}

/* Per-user daily quota (in memory – resets on restart; move to Redis/DB when scaling out). */
const usage = new Map();
function takeQuota(userId) {
    const key = `${dayKey()}:${userId}`;
    const n = (usage.get(key) ?? 0) + 1;
    if (n > env.AI_DAILY_LIMIT) throw tooMany(`Bạn đã dùng hết ${env.AI_DAILY_LIMIT} lượt hỏi AI hôm nay. Hẹn bạn ngày mai nhé!`, { code: 'ai-quota' });
    usage.set(key, n);
    if (usage.size > 10_000) for (const k of usage.keys()) if (!k.startsWith(dayKey())) usage.delete(k);
}

function geminiError(status, body) {
    if (status === 400 && /API key/i.test(body)) return unavailable('API key Gemini trên máy chủ không hợp lệ.', { code: 'ai-key' });
    if (status === 401 || status === 403) return unavailable('API key Gemini không có quyền gọi model này.', { code: 'ai-key' });
    if (status === 404) return unavailable(`Không tìm thấy model "${env.GEMINI_MODEL}".`, { code: 'ai-model' });
    if (status === 429) return tooMany('Trợ lý AI đang quá tải (giới hạn của gói miễn phí). Đợi một lát rồi thử lại.', { code: 'ai-busy' });
    return new HttpError(502, 'Không gọi được trợ lý AI. Vui lòng thử lại.', { code: 'ai-upstream' });
}

const schema = z.object({
    messages: z
        .array(z.object({ role: z.enum(['user', 'model']), text: z.string().trim().min(1).max(2000) }))
        .min(1)
        .max(30),
});

export const aiRoutes = Router();

aiRoutes.post(
    '/chat',
    requireAuth,
    aiLimiter,
    ah(async (req, res) => {
        if (!env.aiEnabled) throw unavailable('Trợ lý AI chưa được cấu hình trên máy chủ.', { code: 'ai-disabled' });
        const { messages } = parse(schema, req.body);
        const firstUser = messages.findIndex((m) => m.role === 'user');
        if (firstUser < 0) throw new HttpError(400, 'Thiếu câu hỏi.');
        takeQuota(req.user.id);

        const C = await getContent();
        const ctrl = new AbortController();
        res.on('close', () => ctrl.abort());

        const upstream = await fetch(`${ENDPOINT}/${encodeURIComponent(env.GEMINI_MODEL)}:streamGenerateContent?alt=sse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt(C) }] },
                contents: messages.slice(firstUser).map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
                generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
            }),
            signal: ctrl.signal,
        });
        if (!upstream.ok || !upstream.body) {
            const body = await upstream.text().catch(() => '');
            logger.warn(`Gemini ${upstream.status}: ${body.slice(0, 300)}`);
            throw geminiError(upstream.status, body);
        }

        res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
        res.flushHeaders();
        Readable.fromWeb(upstream.body)
            .on('error', (e) => {
                if (e.name !== 'AbortError') logger.warn('AI stream error:', e.message);
                res.end();
            })
            .pipe(res);
    })
);
