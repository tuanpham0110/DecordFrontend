/**
 * Pronunciation check for Shadowing: how close is the learner's recording to the model sentence?
 *
 * Two engines, same response shape { score, transcript?, words?, comment?, engine }:
 *  1. SPEECH_API_URL configured → a dedicated pronunciation service (native-speaker comparison).
 *     Request (multipart/form-data): audio, referenceText, itemId, referenceAudio?
 *     Response (JSON): { score | similarity | percent, transcript?, words?, scores? }
 *  2. otherwise, when GEMINI_API_KEY is set → Gemini writes down what it hears (without knowing the
 *     model sentence) and the transcript is compared with the model sentence syllable by syllable
 *     here. This is an estimate, not a native-speaker comparison – the UI says so.
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
    return Math.round(Math.max(0, Math.min(100, n <= 1 && !Number.isInteger(n) ? n * 100 : n)));
}

function normalise(json, engine) {
    const score = clampPct(json.score ?? json.similarity ?? json.percent);
    if (score == null) throw new HttpError(502, 'Dịch vụ chấm phát âm trả về dữ liệu không hợp lệ.', { code: 'speech-bad-response' });
    return {
        score,
        transcript: typeof json.transcript === 'string' && json.transcript.trim() ? json.transcript.trim().slice(0, 300) : null,
        words: Array.isArray(json.words)
            ? json.words.slice(0, 40).map((w) => ({ text: String(w.text ?? '').slice(0, 40), status: ['ok', 'miss', 'extra'].includes(w.status) ? w.status : 'ok', score: w.score ?? undefined }))
            : null,
        comment: typeof json.comment === 'string' && json.comment.trim() ? json.comment.trim().slice(0, 300) : null,
        scores: json.scores ?? null,
        engine,
    };
}

/* ───────────── Engine 1: dedicated pronunciation service ───────────── */
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
    return normalise(await res.json(), 'native');
}

/* ───────────── Engine 2: Gemini transcribes, we compare ─────────────
 * The model is NOT told the model sentence: asked to grade, it tends to echo the expected text and
 * hand out 100%. It only writes down what it hears; the similarity is computed here, syllable by
 * syllable, so a wrong or silent recording can never score well.
 */
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const TRY_NEXT = new Set([404, 408, 429, 500, 502, 503, 504]);

const TRANSCRIBE_PROMPT = `Hãy nghe bản ghi âm và chép lại CHÍNH XÁC từng âm tiết nghe được, viết bằng chữ Quốc ngữ (kiểu chính tả tiếng Việt, có dấu thanh).
Người nói có thể đang nói tiếng Mường (một ngôn ngữ dân tộc thiểu số ở Việt Nam, âm gần tiếng Việt), tiếng Việt hoặc ngôn ngữ khác: nghe thấy âm gì thì ghi âm đó, KHÔNG sửa thành từ tiếng Việt có nghĩa, KHÔNG dịch, KHÔNG thêm bớt.
Nếu không có tiếng người nói (im lặng, tiếng ồn) thì "transcript" là chuỗi rỗng và "speech" là false.`;

const TRANSCRIBE_SCHEMA = { type: 'OBJECT', properties: { speech: { type: 'BOOLEAN' }, transcript: { type: 'STRING' } }, required: ['speech', 'transcript'] };

async function transcribe(file) {
    const payload = {
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: file.mimetype.split(';')[0], data: file.buffer.toString('base64') } }, { text: TRANSCRIBE_PROMPT }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: 'application/json', responseSchema: TRANSCRIBE_SCHEMA },
    };
    let last = null;
    // the whole chain must answer before the browser gives up (40s) and well inside the function's 60s limit
    const deadline = Date.now() + 36_000;
    for (const model of env.aiModels) {
        const left = deadline - Date.now();
        if (left < 4_000) break;
        try {
            const res = await fetch(`${GEMINI}/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(Math.min(20_000, left)),
            });
            if (!res.ok) throw Object.assign(new Error(`Gemini ${res.status}`), { status: res.status, body: await res.text().catch(() => '') });
            const data = await res.json();
            const json = JSON.parse(data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '');
            return json.speech === false ? '' : String(json.transcript ?? '').trim();
        } catch (e) {
            last = e;
            logger.warn(`Speech via ${model} failed (${e.status ?? e.name}): ${String(e.body ?? e.message).replace(/\s+/g, ' ').slice(0, 200)}`);
            if (e.status != null && !TRY_NEXT.has(e.status)) break;
        }
    }
    if (last?.status === 400) throw new HttpError(502, 'Không đọc được bản ghi âm này. Hãy ghi âm lại rồi thử lại.', { code: 'speech-bad-audio' });
    throw unavailable('Công cụ chấm phát âm đang quá tải. Bạn thử lại sau ít phút nhé.', { code: 'speech-busy' });
}

/* ── similarity ── */
const syllables = (t) =>
    String(t ?? '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\s]/gu, ' ')
        .split(/\s+/)
        .filter(Boolean);
/** Strips tone marks and vowel diacritics: "pổn" → "pon". */
const bare = (w) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

function editDistance(a, b) {
    const A = [...a];
    const B = [...b];
    let prev = B.map((_, j) => j + 1);
    prev.unshift(0);
    for (let i = 1; i <= A.length; i++) {
        const cur = [i];
        for (let j = 1; j <= B.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[B.length];
}
const closeness = (a, b) => (!a.length && !b.length ? 1 : 1 - editDistance(a, b) / Math.max([...a].length, [...b].length));

/** 0–1 for two syllables: the sounds (consonants + vowel) weigh more than the tone / vowel quality marks. */
export function syllableScore(ref, heard) {
    if (ref === heard) return 1;
    return 0.7 * closeness(bare(ref), bare(heard)) + 0.3 * closeness(ref.normalize('NFD'), heard.normalize('NFD'));
}

/**
 * Aligns the heard syllables with the model sentence (order kept) and scores the match.
 * Extra syllables cost points too, so reading a longer, different sentence does not pass.
 */
export function compare(referenceText, transcript) {
    const ref = syllables(referenceText);
    const heard = syllables(transcript);
    if (!heard.length) {
        return { score: 0, words: ref.map((text) => ({ text, status: 'miss', score: 0 })), comment: 'Chưa nghe thấy tiếng nói trong bản ghi. Hãy đưa micro gần hơn và đọc to, rõ từng tiếng.' };
    }
    const n = ref.length;
    const m = heard.length;
    // best[i][j] = best total similarity aligning ref[0..i) with heard[0..j)
    const best = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) best[i][j] = Math.max(best[i - 1][j], best[i][j - 1], best[i - 1][j - 1] + syllableScore(ref[i - 1], heard[j - 1]));
    }
    const per = new Array(n).fill(0);
    const used = new Array(m).fill(false);
    for (let i = n, j = m; i > 0 && j > 0; ) {
        const s = syllableScore(ref[i - 1], heard[j - 1]);
        if (best[i][j] === best[i - 1][j - 1] + s && s > 0) {
            per[i - 1] = s;
            used[j - 1] = true;
            i--;
            j--;
        } else if (best[i][j] === best[i - 1][j]) i--;
        else j--;
    }
    const extras = heard.filter((_, j) => !used[j]);
    const score = Math.round((100 * per.reduce((a, b) => a + b, 0)) / (n + 0.5 * extras.length));
    const words = [
        ...ref.map((text, i) => ({ text, status: per[i] >= 0.6 ? 'ok' : 'miss', score: Math.round(per[i] * 100) })),
        ...extras.slice(0, 6).map((text) => ({ text, status: 'extra' })),
    ];
    const weak = words.filter((w) => w.status === 'miss').map((w) => `“${w.text}”`);
    const comment = !weak.length
        ? score >= 85
            ? 'Máy nghe ra đúng cả câu. Hãy nghe lại mẫu để chỉnh thêm ngữ điệu.'
            : 'Máy nghe ra đủ các tiếng nhưng còn lệch nhẹ. Nghe lại mẫu và đọc chậm, rõ hơn.'
        : `Máy chưa nghe rõ ${weak.slice(0, 4).join(', ')}. Nghe lại mẫu, đọc chậm từng tiếng rồi ghi âm lại.`;
    return { score: Math.max(0, Math.min(100, score)), words, comment };
}

async function assessWithGemini({ file, referenceText }) {
    const transcript = await transcribe(file);
    return normalise({ ...compare(referenceText, transcript), transcript }, 'ai');
}

export const speechRoutes = Router();

speechRoutes.post(
    '/assess',
    requireAuth,
    aiLimiter,
    upload.single('audio'),
    ah(async (req, res) => {
        if (!env.speechEnabled) throw unavailable('Tính năng chấm phát âm chưa được bật trên máy chủ.', { code: 'speech-disabled' });
        if (!req.file?.size) throw badRequest('Chưa có bản ghi để so sánh.', { field: 'audio' });
        const { itemId } = parse(z.object({ itemId: z.string().min(1).max(100) }), req.body);

        // the reference always comes from our own content, never from the client
        const C = await getContent();
        const item = C.ITEMS[itemId];
        if (!item || item.part !== 'shadow') throw badRequest('Câu luyện nói không tồn tại.');

        res.json(
            env.SPEECH_API_URL
                ? await callProvider({ file: req.file, referenceText: item.text, itemId, referenceAudio: item.audioUrl })
                : await assessWithGemini({ file: req.file, referenceText: item.text })
        );
    })
);
