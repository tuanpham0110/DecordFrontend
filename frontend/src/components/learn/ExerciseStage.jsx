import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { Button } from '../ui.jsx';
import { BuildExercise, ListenExercise, fromSubmission, toSubmission } from './Exercises.jsx';
import ShadowExercise from './ShadowExercise.jsx';

const HEAD = {
    listen: { icon: 'headphones', title: 'Nghe âm thanh và chọn đáp án đúng!' },
    build: { icon: 'puzzle', title: 'Lắp khung câu' },
    shadow: { icon: 'mic', title: 'Nghe và nhại lại câu vừa nghe' },
};

function Feedback({ result, showExplain, saveState, onSave, mode }) {
    const ok = result.correct;
    const detail = result.explain || result.translation;
    return (
        <div className={`feedback ${ok ? 'feedback--ok' : 'feedback--bad'}`} role="status" aria-live="polite">
            <div className="feedback__row">
                <span className="feedback__icon">
                    <Icon name={ok ? 'check' : 'x'} size={20} strokeWidth={2.75} />
                </span>
                <div className="feedback__text">
                    <strong>{ok ? (mode === 'retry' ? 'Đúng rồi!' : 'Chính xác!') : 'Chưa chính xác!'}</strong>
                    {result.answer != null && (
                        <span>
                            Đáp án đúng là: <b>{Array.isArray(result.answer) ? result.answer.join(' ') : result.answer}</b>
                        </span>
                    )}
                </div>
                {onSave && (
                    <button type="button" className={`save-btn ${saveState === 'saved' ? 'is-saved' : ''}`} onClick={onSave} disabled={saveState !== 'idle'}>
                        <Icon name={saveState === 'saved' ? 'bookmark-filled' : 'bookmark'} size={16} />
                        {saveState === 'saved' ? 'Đã lưu' : saveState === 'saving' ? 'Đang lưu…' : 'Lưu vào sổ tay'}
                    </button>
                )}
            </div>
            {showExplain && detail && (
                <div className="feedback__row feedback__explain">
                    <span className="feedback__icon feedback__icon--soft">
                        <Icon name="book" size={18} />
                    </span>
                    <div className="feedback__text">
                        <strong>{result.explain ? 'Giải thích' : 'Dịch nghĩa'}</strong>
                        <span>{detail}</span>
                    </div>
                </div>
            )}
            <img className="feedback__mascot" src={ok ? '/assets/mascot-cheer.webp' : '/assets/mascot-point.webp'} alt="" />
        </div>
    );
}

/**
 * One exercise with its own check / feedback / footer.
 * Used by both the lesson player and review sessions.
 */
export default function ExerciseStage({
    item,
    initial,
    onAnswer,
    onRate,
    onNext,
    nextLabel = 'Tiếp tục',
    onSave,
    saved = false,
    allowRetry = true,
    allowSkip = true,
    autoPlay = true,
    headline,
    onAsk,
}) {
    const [response, setResponse] = useState(() => fromSubmission(item, initial?.response ?? null));
    const [result, setResult] = useState(initial?.result ?? null);
    const [rating, setRating] = useState(initial?.rating ?? null);
    const [mode, setMode] = useState('first'); // first | retry
    const [showExplain, setShowExplain] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saveState, setSaveState] = useState(saved ? 'saved' : 'idle');
    const playerRef = useRef(null);
    const isShadow = item.part === 'shadow';

    useEffect(() => {
        setSaveState(saved ? 'saved' : 'idle');
    }, [saved, item.id]);

    async function check() {
        if (busy || response == null || result) return;
        setBusy(true);
        setError('');
        try {
            const r = await onAnswer(toSubmission(item, response));
            setResult(r);
            if (!r.correct) setShowExplain(false);
        } catch (e) {
            setError(e.message || 'Không gửi được câu trả lời. Vui lòng thử lại.');
        } finally {
            setBusy(false);
        }
    }

    async function rate(value) {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await onRate(value);
            setRating(value);
        } catch (e) {
            setError(e.message || 'Không lưu được đánh giá. Vui lòng thử lại.');
        } finally {
            setBusy(false);
        }
    }

    async function save() {
        if (!onSave || saveState !== 'idle') return;
        setSaveState('saving');
        try {
            await onSave(item.save);
            setSaveState('saved');
        } catch {
            setSaveState('idle');
            setError('Không lưu được vào sổ tay. Vui lòng thử lại.');
        }
    }

    function retry() {
        setResult(null);
        setResponse(null);
        setShowExplain(false);
        setMode('retry');
    }

    const canContinue = isShadow ? !!rating : !!result;

    // keyboard: 1–4 / A–D choose, Enter check/continue, R replay
    useEffect(() => {
        const onKey = (e) => {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
            if (e.target.closest?.('input, textarea, [role="dialog"]')) return;
            const k = e.key.toLowerCase();
            if (k === 'r') {
                playerRef.current?.play();
                return;
            }
            if (e.key === 'Enter') {
                if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('stage__primary')) return;
                e.preventDefault();
                if (canContinue) onNext();
                else if (!isShadow) check();
                return;
            }
            if (result || isShadow || item.kind === 'order') return;
            const map = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };
            if (k in map && item.options?.[map[k]] != null) setResponse(item.options[map[k]]);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const head = HEAD[item.part];
    const detail = result && (result.explain || result.translation);

    return (
        <div className="stage">
            <header className="stage__head">
                <span className="stage__icon">
                    <Icon name={head.icon} size={26} />
                </span>
                <div>
                    <h2>{headline || (item.part === 'build' ? item.prompt : head.title)}</h2>
                    <p>{item.part === 'build' ? 'Chọn từ phù hợp, kiểm tra rồi xem dịch nghĩa.' : item.prompt || 'Nghe câu mẫu, ghi âm và so sánh.'}</p>
                </div>
            </header>

            <div className="stage__card">
                {item.part === 'listen' && (
                    <ListenExercise item={item} response={response} setResponse={setResponse} result={result} playerRef={playerRef} autoPlay={autoPlay && !result} />
                )}
                {item.part === 'build' && (
                    <BuildExercise item={item} response={response} setResponse={setResponse} result={result} playerRef={playerRef} />
                )}
                {isShadow && <ShadowExercise item={item} rating={rating} onRate={rate} playerRef={playerRef} busy={busy} autoPlay={autoPlay && !rating} />}
            </div>

            {result && <Feedback result={result} mode={mode} showExplain={showExplain} saveState={saveState} onSave={item.save && onSave ? save : null} />}
            {isShadow && rating && (
                <div className={`feedback ${rating === 'again' ? 'feedback--mid' : 'feedback--ok'}`} role="status">
                    <div className="feedback__row">
                        <span className="feedback__icon">
                            <Icon name={rating === 'again' ? 'refresh' : 'check'} size={20} strokeWidth={2.5} />
                        </span>
                        <div className="feedback__text">
                            <strong>{rating === 'again' ? 'Đã thêm vào danh sách ôn tập' : rating === 'skip' ? 'Đã bỏ qua câu này' : 'Đã thực hành!'}</strong>
                            <span>
                                “{item.text}” nghĩa là “{item.meaning}”.
                            </span>
                        </div>
                        {item.save && onSave && (
                            <button type="button" className={`save-btn ${saveState === 'saved' ? 'is-saved' : ''}`} onClick={save} disabled={saveState !== 'idle'}>
                                <Icon name={saveState === 'saved' ? 'bookmark-filled' : 'bookmark'} size={16} />
                                {saveState === 'saved' ? 'Đã lưu' : 'Lưu vào sổ tay'}
                            </button>
                        )}
                    </div>
                    {rating !== 'again' && rating !== 'skip' && <img className="feedback__mascot" src="/assets/mascot-cheer.webp" alt="" />}
                </div>
            )}

            {error && (
                <p className="stage__error" role="alert">
                    <Icon name="alert" size={16} /> {error}
                </p>
            )}

            <footer className="stage__foot">
                <div className="stage__secondary">
                    {result && !result.correct && allowRetry && (
                        <Button variant="light" iconLeft="refresh" onClick={retry}>
                            Làm lại
                        </Button>
                    )}
                    {!result && !isShadow && response != null && (
                        <Button variant="ghost" iconLeft="x" onClick={() => setResponse(null)}>
                            Bỏ chọn
                        </Button>
                    )}
                    {detail && (
                        <Button variant={showExplain ? 'green' : 'light'} iconLeft="book" onClick={() => setShowExplain((v) => !v)} aria-pressed={showExplain}>
                            {result.explain ? 'Xem giải thích' : 'Xem dịch nghĩa'}
                        </Button>
                    )}
                    {onAsk && (result || rating) && (
                        <Button variant="ghost" iconLeft="sparkle" onClick={() => onAsk({ correct: isShadow ? rating !== 'again' : result.correct })}>
                            Hỏi Ếch Mường
                        </Button>
                    )}
                    {isShadow && !rating && allowSkip && (
                        <Button variant="ghost" onClick={() => rate('skip')} disabled={busy}>
                            Bỏ qua câu này
                        </Button>
                    )}
                </div>
                {canContinue ? (
                    <Button variant="leaf" className="stage__primary" iconRight="arrow-right" onClick={onNext}>
                        {nextLabel}
                    </Button>
                ) : isShadow ? (
                    <Button variant="leaf" className="stage__primary" iconRight="arrow-right" disabled>
                        {nextLabel}
                    </Button>
                ) : (
                    <Button variant="leaf" className="stage__primary" onClick={check} disabled={response == null || (Array.isArray(response) && !response.length)} loading={busy}>
                        Kiểm tra
                    </Button>
                )}
            </footer>
        </div>
    );
}
