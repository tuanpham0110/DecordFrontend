/**
 * AI tutor client. The backend (/api/ai/chat) holds the Gemini key and the
 * system prompt; it streams Gemini's SSE response straight back to us.
 */
import { request } from '../api.js';
import { tutorHistory } from './history.js';
import { readTutorStream } from './stream.js';

/**
 * Sends the conversation and streams the answer.
 * @param {{role:'user'|'model', text:string}[]} messages
 * @param {{ onToken?: (fullText:string)=>void, signal?: AbortSignal, context?: { lessonId?: number, itemId?: string } }} opts
 *   `context` – ids of the lesson / exercise being asked about; the server looks the content up itself
 * @returns {Promise<string>} the final answer
 */
export async function askTutor(messages, { onToken, signal, context } = {}) {
    const ctx = context && (context.lessonId || context.itemId) ? { lessonId: context.lessonId || undefined, itemId: context.itemId || undefined } : undefined;
    const res = await request('POST', '/ai/chat', {
        body: { messages: tutorHistory(messages), context: ctx },
        raw: true,
        signal,
        timeout: 58000, // includes fallback models and reading the answer, within the server's 60s bound
    });

    return readTutorStream(res, { onToken, signal });
}
