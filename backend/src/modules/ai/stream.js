/** Validates streamed Gemini frames without holding the whole answer in memory. */
export class GeminiStreamState {
    constructor() {
        this.decoder = new TextDecoder();
        this.buffer = '';
        this.complete = false;
        this.hasText = false;
    }

    push(chunk) {
        this.buffer += this.decoder.decode(chunk, { stream: true });
        this.buffer = this.buffer.replace(/\r\n/g, '\n');
        this.readFrames();
    }

    readFrames() {
        let boundary;
        while ((boundary = this.buffer.indexOf('\n\n')) !== -1) {
            const frame = this.buffer.slice(0, boundary);
            this.buffer = this.buffer.slice(boundary + 2);
            const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
            if (!data) continue;
            let json;
            try { json = JSON.parse(data); } catch { throw streamError('Phản hồi AI không hợp lệ.', 'ai-bad-response'); }
            if (json.error) throw streamError('Trợ lý AI gặp lỗi khi trả lời. Vui lòng thử lại.', 'ai-upstream');
            const candidate = json.candidates?.[0];
            if (json.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
                throw streamError('Câu hỏi này không được trợ lý trả lời. Hãy hỏi theo cách khác nhé.', 'ai-blocked');
            }
            const text = candidate?.content?.parts?.map((part) => typeof part.text === 'string' ? part.text : '').join('') ?? '';
            if (text.trim()) this.hasText = true;
            if (candidate?.finishReason) {
                if (candidate.finishReason !== 'STOP') throw streamError('Câu trả lời AI chưa hoàn tất. Vui lòng thử lại.', 'ai-incomplete');
                this.complete = true;
            }
        }
    }

    finish() {
        this.buffer += this.decoder.decode();
        this.readFrames();
        if (this.buffer.trim() || !this.complete || !this.hasText) {
            throw streamError('Trợ lý chưa trả lời đầy đủ. Vui lòng thử lại.', 'ai-incomplete');
        }
    }
}

function streamError(message, code) {
    return Object.assign(new Error(message), { code });
}

/** Refund provider failures/empty replies; user cancellation after delivered text still counts. */
export const shouldRefund = (state, cancelled) => !cancelled || !state.hasText;
