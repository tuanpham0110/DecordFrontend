import { ApiError } from '../api.js';

/** Require both Gemini STOP and our proxy's completion event before accepting an answer. */
export async function readTutorStream(res, { onToken, signal } = {}) {
    if (!res.body) throw new ApiError('Trợ lý không trả lời. Vui lòng thử lại.', undefined, { code: 'ai-incomplete' });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let stopped = false;
    let complete = false;
    const incomplete = () => new ApiError('Câu trả lời AI chưa hoàn tất. Vui lòng thử lại.', undefined, { code: 'ai-incomplete' });
    const frame = (raw) => {
        const lines = raw.split('\n');
        const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
        const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
        if (!data) return;
        let json;
        try { json = JSON.parse(data); } catch { throw incomplete(); }
        if (event === 'muonglab-error') throw new ApiError(json.message || incomplete().message, undefined, { code: json.code || 'ai-incomplete' });
        if (event === 'muonglab-complete') {
            complete = true;
            return;
        }
        if (json.error) throw incomplete();
        const candidate = json.candidates?.[0];
        if (json.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
            throw new ApiError('Câu hỏi này không được trợ lý trả lời. Hãy hỏi theo cách khác nhé.', undefined, { code: 'ai-blocked' });
        }
        if (candidate?.finishReason) {
            if (candidate.finishReason !== 'STOP') throw incomplete();
            stopped = true;
        }
        const piece = candidate?.content?.parts?.map((p) => typeof p.text === 'string' ? p.text : '').join('') ?? '';
        if (piece) {
            full += piece;
            onToken?.(full);
        }
    };
    try {
        for (;;) {
            if (signal?.aborted) throw signal.reason;
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            buffer = buffer.replace(/\r\n/g, '\n');
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
                frame(buffer.slice(0, boundary));
                buffer = buffer.slice(boundary + 2);
            }
        }
        buffer += decoder.decode();
        if (buffer.trim() || !stopped || !complete || !full.trim()) throw incomplete();
        return full;
    } catch (e) {
        await reader.cancel(e).catch(() => {});
        throw e;
    } finally {
        reader.releaseLock();
    }
}
