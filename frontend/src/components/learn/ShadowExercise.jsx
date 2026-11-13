import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import AudioPlayer, { VoiceNote } from './AudioPlayer.jsx';
import useRecorder from '../../hooks/useRecorder.js';
import { assessor, band } from '../../services/speech/assessment.js';
import useMeta from '../../hooks/useMeta.js';
import { useAuth } from '../../context/AuthContext.jsx';

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

/** Similarity gauge: learner vs native speaker. */
function NativeCompare({ item, blob, onSuggest, disabled, available }) {
    const [state, setState] = useState({ status: 'idle', result: null, error: '' });
    const ctrl = useRef(null);

    useEffect(() => {
        ctrl.current?.abort();
        setState({ status: 'idle', result: null, error: '' });
    }, [blob, item.id]);
    useEffect(() => () => ctrl.current?.abort(), []);

    async function run() {
        ctrl.current?.abort();
        ctrl.current = new AbortController();
        setState({ status: 'loading', result: null, error: '' });
        try {
            const result = await assessor.assess(blob, { itemId: item.id }, ctrl.current.signal);
            setState({ status: 'done', result, error: '' });
        } catch (e) {
            if (e.name !== 'AbortError') setState({ status: 'error', result: null, error: e.message });
        }
    }

    const r = state.result;
    const b = r ? band(r.score) : null;
    const pct = r?.score ?? 0;
    const C = 2 * Math.PI * 34;

    return (
        <div className={`native ${available ? '' : 'is-pending'} ${b ? `native--${b.tone}` : ''}`}>
            <div className="native__gauge" aria-hidden={!r}>
                <svg viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" className="native__track" />
                    <circle cx="40" cy="40" r="34" className="native__fill" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
                </svg>
                <span className="native__num">{r ? `${r.score}%` : state.status === 'loading' ? '…' : '--%'}</span>
            </div>
            <div className="native__body">
                <strong className="native__title">
                    <Icon name="gauge" size={16} /> Độ giống người bản địa
                </strong>
                {!available ? (
                    <p className="native__text">Tính năng so sánh % với giọng người bản địa sẽ hoạt động khi kết nối dịch vụ chấm phát âm.</p>
                ) : r ? (
                    <>
                        <p className={`native__band native__band--${b.tone}`}>{b.label}</p>
                        {r.words?.length > 0 && (
                            <p className="native__words" lang="mtq">
                                {r.words.map((w, i) => (
                                    <span key={i} className={`w w--${w.status}`} title={w.score != null ? `${Math.round(w.score)}%` : undefined}>
                                        {w.text}
                                    </span>
                                ))}
                            </p>
                        )}
                        {r.transcript && <p className="native__text">Hệ thống nghe được: “{r.transcript}”</p>}
                        <div className="native__actions">
                            <button type="button" className="tool-btn" onClick={run}>
                                <Icon name="refresh" size={14} /> So sánh lại
                            </button>
                            <button type="button" className="tool-btn tool-btn--accent" disabled={disabled} onClick={() => onSuggest(b.key)}>
                                <Icon name="check" size={14} /> Dùng kết quả này
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="native__text">
                            {blob ? 'Bản ghi của bạn sẽ được gửi lên máy chủ để so sánh với giọng người bản địa.' : 'Ghi âm câu nói của bạn trước, sau đó bấm so sánh.'}
                        </p>
                        {state.error && (
                            <p className="mic__err" role="alert">
                                <Icon name="alert" size={14} /> {state.error}
                            </p>
                        )}
                        <button type="button" className="btn btn--leaf btn--sm" onClick={run} disabled={!blob || state.status === 'loading'}>
                            {state.status === 'loading' ? 'Đang so sánh…' : 'So sánh với người bản địa'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * Shadowing: listen → record → compare → self-assess.
 * Audio stays in the browser unless the learner presses "So sánh với người bản địa" and the
 * backend has a pronunciation service configured (see services/speech/assessment.js).
 */
export default function ShadowExercise({ item, rating, onRate, playerRef, busy, autoPlay }) {
    const meta = useMeta();
    const { user } = useAuth();
    // comparison needs an account (the upload is tied to the learner)
    const speechOn = !!meta?.speech && !!user;
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

                    <NativeCompare item={item} blob={rec.blob} onSuggest={onRate} disabled={busy} available={speechOn} />
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
                    <p className="shadow__honest">
                        {speechOn
                            ? 'Bấm “So sánh với người bản địa” để xem % độ giống. Bản ghi chỉ được gửi lên máy chủ khi bạn bấm nút này.'
                            : 'Hệ thống chưa kết nối dịch vụ chấm phát âm tiếng Mường. Hãy nghe lại hai bản ghi và tự đánh giá. Bản ghi không được tải lên máy chủ.'}
                    </p>
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
