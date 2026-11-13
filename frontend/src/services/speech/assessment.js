/**
 * Native-speaker comparison – calls the backend (/api/speech/assess), which
 * forwards the recording to the pronunciation service and normalises the result:
 *   { score: 0–100, transcript?, words?: [{ text, status: 'ok'|'miss'|'extra', score? }], scores? }
 *
 * Whether the service is available comes from GET /api/meta (`speech`).
 * Privacy: the recording is uploaded only when the learner presses the compare button.
 */
import { request } from '../api.js';

/** Rating band for a similarity %. */
export function band(score) {
    if (score >= 85) return { key: 'good', label: 'Rất giống người bản địa', tone: 'ok' };
    if (score >= 65) return { key: 'ok', label: 'Khá giống, cần chỉnh nhẹ', tone: 'mid' };
    return { key: 'again', label: 'Cần luyện thêm', tone: 'bad' };
}

export const assessor = {
    name: 'So sánh với người bản địa',
    /**
     * @param {Blob} audioBlob
     * @param {{ itemId: string }} reference
     * @param {AbortSignal} [signal]
     */
    async assess(audioBlob, { itemId }, signal) {
        if (!audioBlob?.size) throw new Error('Chưa có bản ghi để so sánh.');
        const ext = (audioBlob.type.split('/')[1] || 'webm').split(';')[0];
        const form = new FormData();
        form.append('itemId', itemId);
        form.append('audio', audioBlob, `recording.${ext}`);
        return request('POST', '/speech/assess', { form, signal, timeout: 40000 });
    },
};
