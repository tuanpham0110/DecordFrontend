import { useCallback, useEffect, useRef, useState } from 'react';

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang?.toLowerCase().startsWith('vi')) || null;
}

/**
 * Plays a recording when `src` is available; otherwise falls back to the
 * browser's Vietnamese TTS voice (reference only – not a native Mường speaker).
 * Exposes { playing, progress (0–1), duration, source, supported, error, play, stop }.
 */
export default function usePlayback({ src, text, rate = 1 }) {
    const [state, setState] = useState({ playing: false, progress: 0, duration: 0, error: '' });
    const audioRef = useRef(null);
    const rafRef = useRef(0);
    const source = src ? 'recording' : 'tts';
    const supported = !!src || canSpeak();

    const stop = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (!src && canSpeak()) window.speechSynthesis.cancel();
        setState((s) => ({ ...s, playing: false, progress: 0 }));
    }, [src]);

    const play = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        if (src) {
            let a = audioRef.current;
            if (!a || a.dataset.src !== src) {
                a = new Audio(src);
                a.dataset.src = src;
                audioRef.current = a;
            }
            a.playbackRate = rate;
            a.currentTime = 0;
            const tick = () => {
                if (!a.duration) return (rafRef.current = requestAnimationFrame(tick));
                setState((s) => ({ ...s, progress: a.currentTime / a.duration, duration: a.duration }));
                if (!a.paused) rafRef.current = requestAnimationFrame(tick);
            };
            a.onended = () => setState((s) => ({ ...s, playing: false, progress: 1 }));
            a.onerror = () => setState((s) => ({ ...s, playing: false, error: 'Không tải được tệp âm thanh.' }));
            a.play()
                .then(() => {
                    setState((s) => ({ ...s, playing: true, error: '' }));
                    rafRef.current = requestAnimationFrame(tick);
                })
                .catch(() => setState((s) => ({ ...s, playing: false, error: 'Trình duyệt chặn phát âm thanh. Hãy bấm lại nút phát.' })));
            return;
        }

        if (!canSpeak()) {
            setState((s) => ({ ...s, error: 'Trình duyệt chưa hỗ trợ phát âm thanh mẫu.' }));
            return;
        }
        const synth = window.speechSynthesis;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'vi-VN';
        const voice = pickVoice();
        if (voice) u.voice = voice;
        u.rate = rate;
        // TTS gives no reliable position events, so progress is estimated.
        const est = Math.max(0.7, (text.length * 0.085) / rate);
        const start = performance.now();
        const tick = () => {
            const p = Math.min(0.97, (performance.now() - start) / 1000 / est);
            setState((s) => ({ ...s, progress: p }));
            rafRef.current = requestAnimationFrame(tick);
        };
        u.onstart = () => {
            setState({ playing: true, progress: 0, duration: est, error: '' });
            rafRef.current = requestAnimationFrame(tick);
        };
        u.onend = () => {
            cancelAnimationFrame(rafRef.current);
            setState((s) => ({ ...s, playing: false, progress: 1 }));
        };
        u.onerror = (e) => {
            cancelAnimationFrame(rafRef.current);
            if (e.error === 'canceled' || e.error === 'interrupted') return;
            setState((s) => ({ ...s, playing: false, error: 'Không phát được giọng đọc. Hãy thử lại.' }));
        };
        setState((s) => ({ ...s, duration: est }));
        synth.speak(u);
    }, [src, text, rate]);

    // stop and release on unmount / when the content changes
    useEffect(
        () => () => {
            cancelAnimationFrame(rafRef.current);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (canSpeak()) window.speechSynthesis.cancel();
        },
        [src, text]
    );

    useEffect(() => {
        setState({ playing: false, progress: 0, duration: 0, error: '' });
    }, [src, text]);

    return { ...state, source, supported, play, stop };
}
