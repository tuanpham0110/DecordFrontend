import Icon from '../Icon.jsx';
import usePlayback from '../../hooks/usePlayback.js';

/** Compact round "play pronunciation" button. */
export default function SpeakButton({ text, src, label }) {
    const pb = usePlayback({ src, text });
    return (
        <button
            type="button"
            className={`speak-btn ${pb.playing ? 'is-playing' : ''}`}
            onClick={pb.playing ? pb.stop : pb.play}
            disabled={!pb.supported}
            aria-label={label || `Nghe “${text}”`}
            title={src ? 'Nghe phát âm' : 'Nghe giọng đọc máy (tham khảo)'}
        >
            <Icon name="volume" size={18} />
        </button>
    );
}
