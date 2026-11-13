import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import AudioPlayer, { VoiceNote } from './AudioPlayer.jsx';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const same = (a, b) => String(a).normalize('NFC').trim().toLowerCase() === String(b).normalize('NFC').trim().toLowerCase();

/* ───────────── Bắc âm cầu: listen & choose ───────────── */
export function ListenExercise({ item, response, setResponse, result, playerRef, autoPlay }) {
    const answered = !!result;
    return (
        <div className="ex ex--listen">
            <div className="ex__audio">
                <AudioPlayer ref={playerRef} src={item.audioUrl} text={item.audioText} autoPlay={autoPlay} />
                <VoiceNote src={item.audioUrl} />
            </div>
            <div className="choices" role="radiogroup" aria-label="Các lựa chọn">
                {item.options.map((o, i) => {
                    const picked = same(response, o);
                    let state = picked ? 'is-picked' : '';
                    if (answered) {
                        if (same(o, result.answer)) state = 'is-correct';
                        else if (picked) state = 'is-wrong';
                        else state = 'is-dim';
                    }
                    return (
                        <button
                            key={o}
                            type="button"
                            role="radio"
                            aria-checked={picked}
                            className={`choice ${state}`}
                            disabled={answered}
                            onClick={() => setResponse(o)}
                        >
                            <span className="choice__key">{LETTERS[i]}</span>
                            <span className="choice__text">{o}</span>
                            {state === 'is-correct' && <Icon name="check" size={18} strokeWidth={2.5} className="choice__mark" />}
                            {state === 'is-wrong' && <Icon name="x" size={18} strokeWidth={2.5} className="choice__mark" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ───────────── Lắp khung câu: fill the blank ───────────── */
function FillExercise({ item, response, setResponse, result, playerRef }) {
    const answered = !!result;
    const slotState = answered ? (result.correct ? 'is-correct' : 'is-wrong') : response ? 'is-filled' : '';
    return (
        <div className="ex ex--fill">
            <div className="frame">
                {item.audioText && <AudioPlayer ref={playerRef} src={item.audioUrl} text={item.audioText} size="sm" label="Nghe cả câu" />}
                <p className="frame__sentence">
                    {item.before && <span>{item.before}</span>}
                    <button
                        type="button"
                        className={`frame__slot ${slotState}`}
                        onClick={() => !answered && setResponse(null)}
                        disabled={answered || !response}
                        aria-label={response ? `Ô trống đang chọn: ${response}. Bấm để bỏ chọn` : 'Ô trống'}
                    >
                        {response || <span className="frame__ph">&nbsp;</span>}
                    </button>
                    {item.after && <span>{item.after}</span>}
                </p>
            </div>
            <div className="tokens tokens--pick" role="radiogroup" aria-label="Các từ để chọn">
                {item.options.map((o, i) => {
                    const picked = same(response, o);
                    let state = picked ? 'is-picked' : '';
                    if (answered) state = same(o, result.answer) ? 'is-correct' : picked ? 'is-wrong' : 'is-dim';
                    return (
                        <button
                            key={o}
                            type="button"
                            role="radio"
                            aria-checked={picked}
                            className={`token ${state}`}
                            disabled={answered}
                            onClick={() => setResponse(picked ? null : o)}
                        >
                            <span className="token__key" aria-hidden="true">
                                {i + 1}
                            </span>
                            {o}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ───────────── Lắp khung câu: arrange words ─────────────
 * response = array of token indexes (so duplicate words stay distinct).
 * Click/Enter adds a token; click a placed token to remove it; drag to reorder
 * on pointer devices; Backspace removes the last; Ctrl+Z undoes.
 */
function OrderExercise({ item, response, setResponse, result, playerRef }) {
    const placed = Array.isArray(response) ? response : [];
    const answered = !!result;
    const history = useRef([]);
    const [dragFrom, setDragFrom] = useState(null);

    const commit = (next) => {
        history.current.push(placed);
        setResponse(next.length ? next : null);
    };
    const add = (idx) => !answered && !placed.includes(idx) && commit([...placed, idx]);
    const removeAt = (pos) => !answered && commit(placed.filter((_, i) => i !== pos));
    const undo = () => {
        if (answered || !history.current.length) return;
        const prev = history.current.pop();
        setResponse(prev.length ? prev : null);
    };
    const move = (from, to) => {
        if (answered || from === to) return;
        const next = [...placed];
        const [x] = next.splice(from, 1);
        next.splice(to, 0, x);
        commit(next);
    };

    useEffect(() => {
        history.current = [];
    }, [item.id]);

    useEffect(() => {
        if (answered) return;
        const onKey = (e) => {
            if (e.target.closest?.('input, textarea')) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
            } else if (e.key === 'Backspace' && placed.length) {
                e.preventDefault();
                removeAt(placed.length - 1);
            } else if (/^[1-9]$/.test(e.key)) {
                const idx = Number(e.key) - 1;
                if (idx < item.tokens.length) add(idx);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const correctSeq = answered ? result.answer : null;

    return (
        <div className="ex ex--order">
            <div className="frame">
                {item.audioText && answered && <AudioPlayer ref={playerRef} src={item.audioUrl} text={item.audioText} size="sm" label="Nghe câu đúng" />}
                <ol className={`order-line ${answered ? (result.correct ? 'is-correct' : 'is-wrong') : ''}`} aria-label="Câu bạn đang ghép">
                    {placed.length === 0 && <li className="order-line__ph">Chọn từ bên dưới để ghép câu</li>}
                    {placed.map((idx, pos) => (
                        <li
                            key={`${idx}-${pos}`}
                            draggable={!answered}
                            onDragStart={() => setDragFrom(pos)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                                if (dragFrom != null) move(dragFrom, pos);
                                setDragFrom(null);
                            }}
                        >
                            <button
                                type="button"
                                className="token token--placed"
                                onClick={() => removeAt(pos)}
                                disabled={answered}
                                aria-label={`${item.tokens[idx]} – bấm để bỏ`}
                            >
                                {item.tokens[idx]}
                            </button>
                        </li>
                    ))}
                </ol>
                {!answered && (
                    <div className="order-tools">
                        <button type="button" className="tool-btn" onClick={undo} disabled={!history.current.length}>
                            <Icon name="undo" size={16} /> Hoàn tác
                        </button>
                        <button type="button" className="tool-btn" onClick={() => placed.length && commit([])} disabled={!placed.length}>
                            <Icon name="refresh" size={16} /> Xoá hết
                        </button>
                    </div>
                )}
                {answered && !result.correct && (
                    <p className="order-answer">
                        <span>Câu đúng:</span> {correctSeq.join(' ')}
                    </p>
                )}
            </div>
            <div className="tokens" aria-label="Các từ để ghép">
                {item.tokens.map((t, idx) => {
                    const used = placed.includes(idx);
                    return (
                        <button
                            key={idx}
                            type="button"
                            className={`token ${used ? 'is-used' : ''}`}
                            disabled={answered || used}
                            onClick={() => add(idx)}
                            aria-label={used ? `${t} (đã dùng)` : t}
                        >
                            <span className="token__key" aria-hidden="true">
                                {idx + 1}
                            </span>
                            {t}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function BuildExercise(props) {
    return props.item.kind === 'order' ? <OrderExercise {...props} /> : <FillExercise {...props} />;
}

/** Converts the UI response into what the server grades. */
export function toSubmission(item, response) {
    if (item.kind === 'order') return (response || []).map((i) => item.tokens[i]);
    return response;
}

/** Restores a stored server response into UI state. */
export function fromSubmission(item, stored) {
    if (stored == null) return null;
    if (item.kind === 'order') {
        const used = new Set();
        return stored.map((t) => {
            const idx = item.tokens.findIndex((x, i) => x === t && !used.has(i));
            used.add(idx);
            return idx;
        });
    }
    return stored;
}
