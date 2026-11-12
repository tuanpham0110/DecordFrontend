import { useEffect } from 'react';
import Icon from '../Icon.jsx';
import AudioPlayer, { VoiceNote } from './AudioPlayer.jsx';
import useRecorder from '../../hooks/useRecorder.js';
import { assessor } from '../../services/speech/assessment.js';

export const RATINGS = [
    { key: 'good', label: 'Giống mẫu', icon: 'check-circle', tone: 'ok' },
    { key: 'ok', label: 'Gần giống', icon: 'gauge', tone: 'mid' },
    { key: 'again', label: 'Cần luyện thêm', icon: 'refresh', tone: 'bad' },
];

const STATUS_TEXT = {
    idle: 'Nhấn để bắt đầu ghi âm',
    requesting: 'Đang xin quyền dùng micro…',
    recording: 'Đang ghi âm… nhấn để dừng',
    recorded: 'Đã ghi âm. Nghe lại và so sánh với mẫu',
};

/**
 * Shadowing: listen → record → compare → self-assess.
 * Audio never leaves the browser. When `assessor.available` becomes true a
 * real recogniser can be wired in (see services/speech/assessment.js).
 */
export default function ShadowExercise({ item, rating, onRate, playerRef, busy, autoPlay }) {
    const rec = useRecorder({ maxSeconds: 15 });

    useEffect(() => {
        rec.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.id]);

    const recording = rec.status === 'recording';
    const blocked = rec.status === 'denied' || rec.status === 'unsupported' || rec.status === 'error';

    return (
        <div className="ex ex--shadow">
            <div className="shadow">
                <div className="shadow__main">
                    <div className="shadow__sentence">
                        <strong lang="mtq">{item.text}</strong>
                        <span>{item.meaning}</span>
                    </div>
                    <AudioPlayer ref={playerRef} src={item.audioUrl} text={item.text} autoPlay={autoPlay} label="Nghe câu mẫu" />
                    <VoiceNote src={item.audioUrl} />

                    <div className={`mic mic--${rec.status}`}>
                        <button
                            type="button"
                            className="mic__btn"
                            onClick={recording ? rec.stop : rec.start}
                            disabled={rec.status === 'requesting' || rec.status === 'unsupported'}
                            aria-label={recording ? 'Dừng ghi âm' : rec.status === 'recorded' ? 'Ghi âm lại' : 'Bắt đầu ghi âm'}
                            style={{ '--lvl': rec.level }}
                        >
                            <Icon name={recording ? 'stop' : 'mic'} size={30} />
                        </button>
                        <p className="mic__status" aria-live="polite">
                            {recording ? (
                                <>
                                    <span className="mic__dot" /> {rec.elapsed.toFixed(1)}s / {rec.maxSeconds}s
                                </>
                            ) : (
                                STATUS_TEXT[rec.status]
                            )}
                        </p>
                        {rec.error && (
                            <p className="mic__err" role="alert">
                                <Icon name="alert" size={16} /> {rec.error}
                            </p>
                        )}
                        {rec.status === 'unsupported' && (
                            <p className="mic__err" role="alert">
                                <Icon name="alert" size={16} /> Trình duyệt này chưa hỗ trợ ghi âm. Bạn vẫn có thể nghe mẫu và nói theo, rồi tự đánh giá.
                            </p>
                        )}
                    </div>

                    {rec.url && (
                        <div className="compare">
                            <div className="compare__row">
                                <span className="compare__label">Mẫu</span>
                                <AudioPlayer src={item.audioUrl} text={item.text} size="sm" label="Nghe lại mẫu" />
                            </div>
                            <div className="compare__row">
                                <span className="compare__label">Bạn</span>
                                <AudioPlayer src={rec.url} text="" size="sm" label="Nghe lại bản ghi của bạn" />
                            </div>
                            <button type="button" className="tool-btn" onClick={rec.start}>
                                <Icon name="refresh" size={16} /> Ghi âm lại
                            </button>
                        </div>
                    )}
                </div>

                <aside className="shadow__tips">
                    <h4>
                        <Icon name="bulb" size={18} /> Gợi ý
                    </h4>
                    <ul>
                        {(item.tips || []).map((t) => (
                            <li key={t}>{t}</li>
                        ))}
                    </ul>
                    {!assessor.available && (
                        <p className="shadow__honest">
                            Hệ thống chưa chấm điểm phát âm tự động cho tiếng Mường. Hãy nghe lại hai bản ghi và tự đánh giá. Bản ghi không được
                            tải lên máy chủ.
                        </p>
                    )}
                </aside>
            </div>

            <div className="selfrate">
                <p className="selfrate__q">{rec.url || blocked ? 'Bạn thấy mình nói giống mẫu đến đâu?' : 'Ghi âm xong, hãy tự đánh giá:'}</p>
                <div className="selfrate__opts" role="radiogroup" aria-label="Tự đánh giá">
                    {RATINGS.map((r) => (
                        <button
                            key={r.key}
                            type="button"
                            role="radio"
                            aria-checked={rating === r.key}
                            className={`rate rate--${r.tone} ${rating === r.key ? 'is-on' : ''}`}
                            disabled={busy || (!rec.url && !blocked)}
                            onClick={() => onRate(r.key)}
                        >
                            <Icon name={r.icon} size={18} />
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
