import { useCallback, useEffect, useRef, useState } from 'react';

export const canRecord = () =>
    typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined';

/**
 * Microphone recorder for Shadowing.
 * The recording stays in memory as an object URL. It is only uploaded when the
 * learner explicitly asks for a native-speaker comparison (see speech/assessment.js).
 *
 * status: idle | requesting | recording | recorded | denied | unsupported | error
 */
export default function useRecorder({ maxSeconds = 15 } = {}) {
    const [status, setStatus] = useState(() => (canRecord() ? 'idle' : 'unsupported'));
    const [elapsed, setElapsed] = useState(0);
    const [level, setLevel] = useState(0);
    const [url, setUrl] = useState(null);
    const [blob, setBlob] = useState(null);
    const [error, setError] = useState('');

    const recRef = useRef(null);
    const streamRef = useRef(null);
    const ctxRef = useRef(null);
    const timerRef = useRef(0);
    const rafRef = useRef(0);
    const urlRef = useRef(null);
    const generationRef = useRef(0);

    const release = useCallback(() => {
        clearInterval(timerRef.current);
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (ctxRef.current && ctxRef.current.state !== 'closed') ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
        setLevel(0);
    }, []);

    const revoke = useCallback(() => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
        setUrl(null);
        setBlob(null);
    }, []);

    const stop = useCallback(() => {
        const rec = recRef.current;
        if (rec && rec.state !== 'inactive') rec.stop();
        else release();
    }, [release]);

    const start = useCallback(async () => {
        if (!canRecord()) {
            setStatus('unsupported');
            return;
        }
        const generation = ++generationRef.current;
        const previous = recRef.current;
        if (previous && previous.state !== 'inactive') {
            previous.onstop = null;
            previous.stop();
        }
        release();
        revoke();
        setError('');
        setStatus('requesting');
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        } catch (e) {
            if (generation !== generationRef.current) return;
            const denied = e?.name === 'NotAllowedError' || e?.name === 'SecurityError';
            setStatus(denied ? 'denied' : 'error');
            setError(
                denied
                    ? 'Bạn chưa cho phép dùng micro. Hãy bật quyền micro cho trang này trong cài đặt trình duyệt rồi thử lại.'
                    : e?.name === 'NotFoundError'
                      ? 'Không tìm thấy micro trên thiết bị.'
                      : 'Không mở được micro. Hãy kiểm tra thiết bị và thử lại.'
            );
            return;
        }
        if (generation !== generationRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
        }
        streamRef.current = stream;

        // live input level for the "đang ghi âm" meter
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            const ctx = new Ctx();
            ctxRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            ctx.createMediaStreamSource(stream).connect(analyser);
            const buf = new Uint8Array(analyser.fftSize);
            const tick = () => {
                analyser.getByteTimeDomainData(buf);
                let sum = 0;
                for (let i = 0; i < buf.length; i++) sum += ((buf[i] - 128) / 128) ** 2;
                setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
                rafRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch {
            /* meter is optional */
        }

        const chunks = [];
        let rec;
        try {
            rec = new MediaRecorder(stream);
        } catch {
            release();
            setStatus('error');
            setError('Không khởi tạo được bản ghi. Hãy thử lại hoặc dùng trình duyệt khác.');
            return;
        }
        recRef.current = rec;
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
            if (generation !== generationRef.current) return;
            release();
            const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
            if (!blob.size) {
                setStatus('error');
                setError('Bản ghi trống. Hãy thử ghi âm lại.');
                return;
            }
            const u = URL.createObjectURL(blob);
            urlRef.current = u;
            setUrl(u);
            setBlob(blob);
            setStatus('recorded');
        };
        try {
            rec.start();
        } catch {
            rec.onstop = null;
            release();
            setStatus('error');
            setError('Không bắt đầu được bản ghi. Hãy thử lại.');
            return;
        }
        setElapsed(0);
        setStatus('recording');
        const t0 = Date.now();
        timerRef.current = setInterval(() => {
            const s = (Date.now() - t0) / 1000;
            setElapsed(s);
            if (s >= maxSeconds) stop();
        }, 100);
    }, [maxSeconds, release, revoke, stop]);

    const reset = useCallback(() => {
        generationRef.current++;
        const rec = recRef.current;
        if (rec && rec.state !== 'inactive') {
            rec.onstop = null;
            rec.stop();
        }
        release();
        revoke();
        setElapsed(0);
        setError('');
        setStatus(canRecord() ? 'idle' : 'unsupported');
    }, [release, revoke]);

    // always free the microphone and blob URL
    useEffect(
        () => () => {
            generationRef.current++;
            const rec = recRef.current;
            if (rec && rec.state !== 'inactive') {
                rec.onstop = null;
                rec.stop();
            }
            release();
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        },
        [release]
    );

    return { status, elapsed, level, url, blob, error, maxSeconds, start, stop, reset };
}
