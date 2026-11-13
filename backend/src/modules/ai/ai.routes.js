/**
 * AI tutor proxy (Google Gemini). The API key never leaves the server.
 * The response is Gemini's own SSE stream, passed through unchanged.
 *
 * Free-tier models are regularly overloaded (HTTP 503) or retired (404), so each
 * question walks a chain of models (GEMINI_MODEL, then GEMINI_FALLBACK_MODELS)
 * and uses the first one that starts answering in time.
 */
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { ah, parse } from '../../lib/http.js';
import { HttpError, tooMany, unavailable } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
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

/* Per-user daily quota, counted in the DB so it holds across serverless instances and restarts. */
async function takeQuota(userId) {
    const day = dayKey();
    const { count } = await prisma.aiUsage.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, count: 1 },
        update: { count: { increment: 1 } },
        select: { count: true },
    });
    if (count > env.AI_DAILY_LIMIT) {
        await refundQuota(userId, day);
        throw tooMany(`Bạn đã dùng hết ${env.AI_DAILY_LIMIT} lượt hỏi AI hôm nay. Hẹn bạn ngày mai nhé!`, { code: 'ai-quota' });
    }
    return day;
}
/** A question that got no answer does not count. */
function refundQuota(userId, day) {
    return prisma.aiUsage.updateMany({ where: { userId, day, count: { gt: 0 } }, data: { count: { decrement: 1 } } }).catch(() => {});
}

/* ───────────── Upstream call with model fallback ───────────── */
const FIRST_CHUNK_TIMEOUT = 12_000; // an overloaded model often accepts the request and then stalls
const TRY_NEXT = new Set([404, 408, 429, 500, 502, 503, 504]);

/**
 * Starts a streamed answer on one model. Resolves with { reader, first } once the first
 * chunk has arrived; throws { status, body } / a timeout error otherwise.
 */
async function openStream(model, payload, clientSignal) {
    const ctrl = new AbortController();
    const onClientAbort = () => ctrl.abort(clientSignal.reason);
    if (clientSignal.aborted) onClientAbort();
    else clientSignal.addEventListener('abort', onClientAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(new DOMException('Model did not start answering in time', 'TimeoutError')), FIRST_CHUNK_TIMEOUT);
    try {
        const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
            body: JSON.stringify(payload),
            signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
            const body = await res.text().catch(() => '');
            throw Object.assign(new Error(`Gemini ${res.status}`), { status: res.status, body });
        }
        const reader = res.body.getReader();
        const first = await reader.read();
        if (first.done) throw Object.assign(new Error('Gemini returned an empty stream'), { status: 502, body: '' });
        return { reader, first: first.value, cancel: () => ctrl.abort() };
    } catch (e) {
        ctrl.abort();
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

function upstreamError(last) {
    const status = last?.status;
    const body = last?.body ?? '';
    if (status === 400 && /API key/i.test(body)) return unavailable('API key Gemini trên máy chủ không hợp lệ.', { code: 'ai-key' });
    if (status === 401 || status === 403) return unavailable('API key Gemini không có quyền gọi model này.', { code: 'ai-key' });
    if (status === 404) return unavailable('Model AI đã cấu hình không còn khả dụng. Quản trị viên cần cập nhật GEMINI_MODEL.', { code: 'ai-model' });
    if (status === 400) return new HttpError(502, 'Trợ lý AI từ chối yêu cầu này. Hãy thử hỏi theo cách khác.', { code: 'ai-upstream' });
    return unavailable('Trợ lý AI đang quá tải. Bạn thử lại sau ít phút nhé.', { code: 'ai-busy' });
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
        const day = await takeQuota(req.user.id);

        const client = new AbortController();
        res.on('close', () => !res.writableEnded && client.abort());

        let stream = null;
        let last = null;
        try {
            const C = await getContent();
            const payload = {
                systemInstruction: { parts: [{ text: systemPrompt(C) }] },
                contents: messages.slice(firstUser).map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
                generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
            };
            for (const model of env.aiModels) {
                try {
                    stream = { model, ...(await openStream(model, payload, client.signal)) };
                    break;
                } catch (e) {
                    if (client.signal.aborted) break; // the learner closed the chat
                    last = e;
                    logger.warn(`AI model ${model} failed (${e.status ?? e.name}): ${String(e.body ?? e.message).replace(/\s+/g, ' ').slice(0, 200)}`);
                    const retryable = e.status == null || TRY_NEXT.has(e.status);
                    if (!retryable) break;
                }
            }
        } catch (e) {
            await refundQuota(req.user.id, day);
            throw e;
        }
        if (!stream) {
            await refundQuota(req.user.id, day);
            if (client.signal.aborted) return void res.end();
            throw upstreamError(last);
        }

        res.status(200).set({
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
            'X-AI-Model': stream.model,
        });
        res.flushHeaders();
        try {
            res.write(stream.first);
            for (;;) {
                const { value, done } = await stream.reader.read();
                if (done) break;
                res.write(value);
            }
        } catch (e) {
            if (!client.signal.aborted) logger.warn(`AI stream error (${stream.model}):`, e.message);
        } finally {
            stream.cancel();
            res.end();
        }
    })
);
