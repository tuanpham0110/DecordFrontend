import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Progress } from '../ui.jsx';
import Icon from '../Icon.jsx';
import AudioPlayer, { VoiceNote } from './AudioPlayer.jsx';
import { normalizeAnswer, pickRound, shuffle } from '../../utils/learning.js';

/**
 * Free practice over the verified word list (the same public list as the handbook).
 * Nothing here changes lesson scores or the review schedule – it is extra practice.
 *
 *  - match:     pair Mường words with their Vietnamese meaning
 *  - listen:    hear a word / sentence and type what you heard
 *  - translate: see the Vietnamese meaning and type the Mường word / sentence
 *
 * Entries the learner struggles with (`weak` from the server) come first.
 */

export const DRILLS = [
    { key: 'match', label: 'Ghép cặp', icon: 'puzzle', desc: 'Ghép từ tiếng Mường với nghĩa tiếng Việt.' },
    { key: 'listen', label: 'Nghe và gõ lại', icon: 'headphones', desc: 'Nghe rồi gõ lại đúng từ, đúng dấu.' },
    { key: 'translate', label: 'Dịch sang tiếng Mường', icon: 'book', desc: 'Nhìn nghĩa tiếng Việt, gõ từ tiếng Mường.' },
];

const ROUND = 8;
const PAIRS = 5;


/* ───────────── Ghép cặp ───────────── */
function Match({ entries, onDone }) {
    const [round, setRound] = useState(0);
    const set = useMemo(() => pickRound(entries.filter((e) => e.type === 'word'), PAIRS), [entries, round]);
    const left = useMemo(() => shuffle(set), [set]);
    const right = useMemo(() => shuffle(set), [set]);
    const [pick, setPick] = useState(null);
    const [matched, setMatched] = useState(() => new Set());
    const [wrong, setWrong] = useState(null);
    const [mistakes, setMistakes] = useState(0);
    const missed = useRef(new Set());

    useEffect(() => {
        setPick(null);
        setMatched(new Set());
        setMistakes(0);
        missed.current = new Set();
    }, [set]);

    const done = set.length > 0 && matched.size === set.length;
    useEffect(() => {
        if (done) onDone?.({ total: set.length, correct: set.length - missed.current.size, missed: set.filter((e) => missed.current.has(e.id)) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [done]);

    function choose(side, e) {
        if (matched.has(e.id)) return;
        if (!pick || pick.side === side) return setPick({ side, id: e.id });
        if (pick.id === e.id) {
            setMatched((m) => new Set(m).add(e.id));
            setPick(null);
        } else {
            missed.current.add(side === 'vi' ? pick.id : e.id);
            setMistakes((n) => n + 1);
            setWrong({ a: pick.id, b: e.id, side });
            setPick(null);
            setTimeout(() => setWrong(null), 600);
        }
    }

    if (set.length < 2) return <p className="muted">Cần ít nhất 2 từ đã kiểm chứng để ghép cặp.</p>;

    const cls = (side, e) => {
        if (matched.has(e.id)) return 'is-correct';
        if (wrong && ((wrong.side === side && wrong.b === e.id) || (wrong.side !== side && wrong.a === e.id))) return 'is-wrong';
        if (pick?.side === side && pick.id === e.id) return 'is-picked';
        return '';
    };

    return (
        <div className="drill drill--match">
            <div className="flash__meta">
                <span>
                    Đã ghép {matched.size}/{set.length}
                </span>
                <span>Nhầm: {mistakes}</span>
            </div>
            <Progress value={(matched.size / set.length) * 100} tone="leaf" label="Tiến độ ghép cặp" />
            <p className="drill__hint">Chọn một từ tiếng Mường, rồi chọn nghĩa của nó.</p>
            <div className="match">
                <ul className="match__col" aria-label="Tiếng Mường">
                    {left.map((e) => (
                        <li key={e.id}>
                            <button type="button" lang="mtq" className={`match__tile ${cls('mtq', e)}`} disabled={matched.has(e.id)} aria-pressed={pick?.side === 'mtq' && pick.id === e.id} onClick={() => choose('mtq', e)}>
                                {e.text}
                            </button>
                        </li>
                    ))}
                </ul>
                <ul className="match__col" aria-label="Tiếng Việt">
                    {right.map((e) => (
                        <li key={e.id}>
                            <button type="button" className={`match__tile ${cls('vi', e)}`} disabled={matched.has(e.id)} aria-pressed={pick?.side === 'vi' && pick.id === e.id} onClick={() => choose('vi', e)}>
                                {e.meaning}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            {done && (
                <div className="drill__end" role="status">
                    <p>
                        <Icon name="check-circle" size={18} /> {mistakes ? `Xong! Bạn nhầm ${mistakes} lần.` : 'Hoàn hảo – không nhầm lần nào!'}
                    </p>
                    <Button iconLeft="shuffle" onClick={() => setRound((r) => r + 1)}>
                        Ván mới
                    </Button>
                </div>
            )}
        </div>
    );
}

/* ───────────── Nghe & gõ / Dịch ───────────── */
function TypeDrill({ entries, mode, onDone }) {
    const [round, setRound] = useState(0);
    const deck = useMemo(() => pickRound(entries, ROUND), [entries, round]);
    const [i, setI] = useState(0);
    const [value, setValue] = useState('');
    const [result, setResult] = useState(null); // { correct, expected }
    const [log, setLog] = useState([]);
    const inputRef = useRef(null);
    const card = deck[i];
    const done = i >= deck.length;

    useEffect(() => {
        setI(0);
        setLog([]);
        setValue('');
        setResult(null);
    }, [deck]);
    useEffect(() => {
        if (!done && !result) inputRef.current?.focus();
    }, [i, done, result]);
    useEffect(() => {
        if (done && log.length) onDone?.({ total: log.length, correct: log.filter((l) => l.correct).length, missed: log.filter((l) => !l.correct).map((l) => l.entry) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [done]);

    if (!deck.length) return <p className="muted">Chưa có từ đã kiểm chứng để luyện.</p>;

    if (done) {
        const right = log.filter((l) => l.correct).length;
        return (
            <div className="quiz-result">
                <img src={right / log.length >= 0.8 ? '/assets/mascot-cheer.webp' : '/assets/mascot-point.webp'} alt="" />
                <h2>{right === log.length ? 'Đúng hết!' : 'Xong lượt luyện!'}</h2>
                <p>
                    Bạn gõ đúng <strong>{right}</strong>/{log.length}.
                </p>
                {right < log.length && (
                    <ul className="review-log">
                        {log
                            .filter((l) => !l.correct)
                            .map((l) => (
                                <li key={l.entry.id}>
                                    <Icon name="x-circle" size={18} className="bad" />
                                    <span lang="mtq">{l.entry.text}</span>
                                    <small>{l.entry.meaning}</small>
                                </li>
                            ))}
                    </ul>
                )}
                <Button iconLeft="refresh" onClick={() => setRound((r) => r + 1)}>
                    Luyện lượt mới
                </Button>
            </div>
        );
    }

    function check(e) {
        e?.preventDefault();
        if (result) return next();
        if (!value.trim()) return;
        const answer = normalizeAnswer(value);
        // several verified entries can share a meaning: any of them is right when translating
        const accepted = mode === 'translate' ? entries.filter((x) => normalizeAnswer(x.meaning) === normalizeAnswer(card.meaning)) : [card];
        const correct = accepted.some((x) => normalizeAnswer(x.text) === answer);
        setResult({ correct, expected: card.text });
        setLog((l) => [...l, { entry: card, correct }]);
    }
    function next() {
        setResult(null);
        setValue('');
        setI((x) => x + 1);
    }

    return (
        <form className="drill drill--type" onSubmit={check}>
            <div className="flash__meta">
                <span>
                    Câu {i + 1}/{deck.length}
                </span>
                <span>Đúng: {log.filter((l) => l.correct).length}</span>
            </div>
            <Progress value={(i / deck.length) * 100} tone="clay" label="Tiến độ luyện gõ" />
            <div className="drill__prompt">
                {mode === 'listen' ? (
                    <>
                        <AudioPlayer key={card.id} text={card.text} autoPlay label="Nghe" />
                        <VoiceNote />
                        <p className="drill__hint">Gõ lại đúng những gì bạn nghe, kể cả dấu thanh.</p>
                    </>
                ) : (
                    <>
                        <span className="tag tag--muted">{card.topic}</span>
                        <strong className="drill__meaning">“{card.meaning}”</strong>
                        <p className="drill__hint">Viết bằng tiếng Mường {card.type === 'sentence' ? '(cả câu)' : ''}.</p>
                    </>
                )}
            </div>
            <label className="sr-only" htmlFor="drill-input">
                Câu trả lời
            </label>
            <input
                id="drill-input"
                ref={inputRef}
                className={`drill__input ${result ? (result.correct ? 'is-correct' : 'is-wrong') : ''}`}
                lang="mtq"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={200}
                value={value}
                readOnly={!!result}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Gõ câu trả lời…"
            />
            {result && (
                <div className={`feedback ${result.correct ? 'feedback--ok' : 'feedback--bad'}`} role="status" aria-live="polite">
                    <div className="feedback__row">
                        <span className="feedback__icon">
                            <Icon name={result.correct ? 'check' : 'x'} size={20} strokeWidth={2.75} />
                        </span>
                        <div className="feedback__text">
                            <strong>{result.correct ? 'Chính xác!' : 'Chưa đúng'}</strong>
                            <span>
                                <b lang="mtq">{result.expected}</b> = {card.meaning}
                            </span>
                        </div>
                    </div>
                </div>
            )}
            <div className="drill__actions">
                {!result && (
                    <Button type="button" variant="ghost" onClick={() => (setResult({ correct: false, expected: card.text }), setLog((l) => [...l, { entry: card, correct: false }]))}>
                        Không biết
                    </Button>
                )}
                <Button type="submit" variant="leaf" iconRight={result ? 'arrow-right' : undefined} disabled={!result && !value.trim()}>
                    {result ? (i + 1 === deck.length ? 'Xem kết quả' : 'Câu tiếp') : 'Kiểm tra'}
                </Button>
            </div>
            <p className="muted small drill__note">Đáp án theo dữ liệu đã được kiểm chứng. Tiếng Mường có nhiều phương ngữ – cách viết ở vùng bạn có thể khác.</p>
        </form>
    );
}

export default function WordDrills({ entries, mode }) {
    if (mode === 'match') return <Match entries={entries} />;
    return <TypeDrill key={mode} entries={entries} mode={mode} />;
}
