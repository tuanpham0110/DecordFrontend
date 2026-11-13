/**
 * AI tutor client. The backend (/api/ai/chat) holds the Gemini key and the
 * system prompt; it streams Gemini's SSE response straight back to us.
 */
import { ApiError, request } from '../api.js';

/**
 * Sends the conversation and streams the answer.
 * @param {{role:'user'|'model', text:string}[]} messages
 * @param {{ onToken?: (fullText:string)=>void, signal?: AbortSignal }} opts
 * @returns {Promise<string>} the final answer
 */
export async function askTutor(messages, { onToken, signal } = {}) {
    const res = await request('POST', '/ai/chat', {
        body: { messages: messages.filter((m) => m.text?.trim()).map(({ role, text }) => ({ role, text })) },
        raw: true,
        signal,
        timeout: 45000, // the server may walk through fallback models before the first token
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let blocked = false;
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            try {
                const json = JSON.parse(line.slice(5));
                const cand = json.candidates?.[0];
                if (json.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY') blocked = true;
                const piece = cand?.content?.parts?.map((p) => p.text || '').join('') ?? '';
                if (piece) {
                    full += piece;
                    onToken?.(full);
                }
            } catch {
                /* partial line – ignore */
            }
        }
    }
    if (!full) throw new ApiError(blocked ? 'Câu hỏi này không được trợ lý trả lời. Hãy hỏi theo cách khác nhé.' : 'Trợ lý không trả lời. Vui lòng thử lại.');
    return full;
}
