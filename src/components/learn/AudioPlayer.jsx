import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import Icon from '../Icon.jsx';
import usePlayback from '../../hooks/usePlayback.js';

const RATES = [0.75, 1, 1.25];
const RATE_KEY = 'muonglab.rate';

function readRate() {
    try {
        const r = Number(localStorage.getItem(RATE_KEY));
        return RATES.includes(r) ? r : 1;
    } catch {
        return 1;
    }
}

/** Deterministic bar heights so each phrase has its own "shape". */
function bars(text, n) {
    let h = 2166136261;
    for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return Array.from({ length: n }, (_, i) => {
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        const env = Math.sin((Math.PI * (i + 0.5)) / n) ** 0.6; // louder in the middle
        return 0.18 + 0.82 * env * (((h >>> 0) % 1000) / 1000) ** 0.7;
    });
}

const fmt = (s) => `0:${String(Math.max(0, Math.round(s))).padStart(2, '0')}`;

/**
 * Sample-audio player. Replays via the imperative `play()` handle (used for
 * the R keyboard shortcut). Rate preference is remembered per browser.
 */
const AudioPlayer = forwardRef(function AudioPlayer({ src, text, autoPlay = false, size = 'md', label = 'Phát âm thanh mẫu' }, ref) {
    const [rate, setRate] = useState(readRate);
    const pb = usePlayback({ src, text, rate });
    const shape = useMemo(() => bars(text || '', size === 'sm' ? 22 : 40), [text, size]);

    useImperativeHandle(ref, () => ({ play: pb.play, stop: pb.stop }), [pb.play, pb.stop]);

    useEffect(() => {
        if (!autoPlay) return;
        const t = setTimeout(pb.play, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, src, autoPlay]);

    const cycleRate = () => {
        const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
        setRate(next);
        try {
            localStorage.setItem(RATE_KEY, String(next));
        } catch {
            /* ignore */
        }
    };

    return (
        <div className={`player player--${size} ${pb.playing ? 'is-playing' : ''}`}>
            <button
                type="button"
                className="player__btn"
                onClick={pb.playing ? pb.stop : pb.play}
                aria-label={pb.playing ? 'Dừng phát' : label}
                disabled={!pb.supported}
            >
                <Icon name={pb.playing ? 'pause' : 'play'} size={size === 'sm' ? 16 : 22} />
            </button>
            <div className="player__wave" aria-hidden="true" style={{ '--p': pb.progress }}>
                {shape.map((v, i) => (
                    <span key={i} style={{ '--h': v }} className={i / shape.length < pb.progress ? 'is-on' : ''} />
                ))}
            </div>
            {size !== 'sm' && (
                <span className="player__time" aria-hidden="true">
                    {fmt(pb.progress * pb.duration)}/{fmt(pb.duration || Math.max(0.7, (text?.length || 0) * 0.085))}
                </span>
            )}
            <button type="button" className="player__rate" onClick={cycleRate} aria-label={`Tốc độ phát ${rate}x, bấm để đổi`}>
                {rate}x
            </button>
            {pb.error && (
                <p className="player__err" role="alert">
                    {pb.error}
                </p>
            )}
            {!pb.supported && (
                <p className="player__err" role="alert">
                    Trình duyệt này chưa hỗ trợ phát âm thanh mẫu.
                </p>
            )}
        </div>
    );
});

export default AudioPlayer;

/** Small honesty note shown under players that use the TTS fallback. */
export function VoiceNote({ src }) {
    if (src) return null;
    return (
        <p className="voice-note">
            <Icon name="info" size={14} />
            Giọng đọc máy (tiếng Việt) chỉ để tham khảo – bản thu giọng người Mường đang được bổ sung.
        </p>
    );
}
