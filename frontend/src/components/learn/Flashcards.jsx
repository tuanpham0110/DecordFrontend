import { useEffect, useRef, useState } from 'react';
import { Button, Progress } from '../ui.jsx';
import Icon from '../Icon.jsx';
import AudioPlayer from './AudioPlayer.jsx';

function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Flip cards with "Đã nhớ / Chưa nhớ". Space flips, ←/→ navigate.
 * Unknown cards are queued again at the end of the deck.
 */
export default function Flashcards({ cards, onMark }) {
    const [deck, setDeck] = useState(cards);
    const [i, setI] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [known, setKnown] = useState(() => new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const operation = useRef({ busy: false, version: 0 });

    useEffect(() => {
        setDeck(cards);
        setI(0);
        setFlipped(false);
        setKnown(new Set());
        setBusy(false);
        setError('');
        operation.current.busy = false;
        return () => { operation.current.version++; };
    }, [cards]);

    const card = deck[i];
    const done = i >= deck.length;

    const go = (d) => {
        if (operation.current.busy) return;
        setFlipped(false);
        setI((x) => Math.max(0, Math.min(deck.length - 1, x + d)));
    };
    const restart = () => {
        if (operation.current.busy) return;
        setDeck(shuffle(cards));
        setI(0);
        setKnown(new Set());
        setFlipped(false);
        setError('');
    };
    const mark = async (isKnown) => {
        if (operation.current.busy || !card) return;
        operation.current.busy = true;
        const version = operation.current.version;
        setBusy(true);
        setError('');
        try {
            await onMark?.(card, isKnown);
            if (version !== operation.current.version) return;
            setKnown((current) => {
                const next = new Set(current);
                if (isKnown) next.add(card.id);
                else next.delete(card.id);
                return next;
            });
            if (!isKnown) setDeck((d) => [...d, card]);
            setFlipped(false);
            setI((x) => x + 1);
        } catch (err) {
            if (version === operation.current.version) setError(err.message || 'Chưa lưu được kết quả ôn. Vui lòng thử lại.');
        } finally {
            if (version === operation.current.version) {
                operation.current.busy = false;
                setBusy(false);
            }
        }
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.target.closest?.('input, textarea, button')) return;
            if (e.key === ' ') {
                e.preventDefault();
                setFlipped((v) => !v);
            } else if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'ArrowLeft') go(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    if (!cards.length) return <p className="muted">Chưa có thẻ nào.</p>;

    if (done) {
        return (
            <div className="quiz-result">
                <img src="/assets/mascot-cheer.webp" alt="" />
                <h2>Xong bộ thẻ!</h2>
                <p>
                    Bạn đã nhớ <strong>{known.size}</strong>/{cards.length} thẻ.
                </p>
                <Button
                    iconLeft="shuffle"
                    onClick={restart}
                >
                    Trộn và ôn lại
                </Button>
            </div>
        );
    }

    return (
        <div className="flash">
            <div className="flash__meta">
                <span>
                    Thẻ {i + 1}/{deck.length}
                </span>
                <button
                    className="link"
                    onClick={restart}
                    disabled={busy}
                >
                    Trộn thẻ
                </button>
            </div>
            <Progress value={(i / deck.length) * 100} tone="leaf" label="Tiến độ bộ thẻ" />

            <div className={`flash__card ${flipped ? 'is-flipped' : ''}`}>
                <button
                    className="flash__flip"
                    onClick={() => setFlipped((v) => !v)}
                    aria-pressed={flipped}
                    aria-label={flipped ? `${card.word} nghĩa là ${card.meaning}` : `Thẻ ${card.word}. Bấm để xem nghĩa`}
                />
                <span className="flash__inner" aria-hidden="true">
                    <span className="flash__face flash__front">
                        <span className="tag tag--muted">{card.topic}</span>
                        <strong>{card.word}</strong>
                        <small>Chạm hoặc nhấn Space để xem nghĩa</small>
                    </span>
                    <span className="flash__face flash__back">
                        <span className="tag tag--leaf">Tiếng Việt</span>
                        <strong>{card.meaning}</strong>
                        <small>{card.word}</small>
                    </span>
                </span>
                <div className="flash__audio">
                    <AudioPlayer text={card.word} size="sm" label={`Nghe “${card.word}”`} />
                </div>
            </div>

            <div className="flash__nav">
                <Button variant="light" iconLeft="arrow-left" onClick={() => go(-1)} disabled={i === 0 || busy} aria-label="Thẻ trước" />
                <Button variant="light" iconLeft="refresh" onClick={() => mark(false)} disabled={busy}>
                    Chưa nhớ
                </Button>
                <Button variant="leaf" iconLeft="check" onClick={() => mark(true)} disabled={busy}>
                    Đã nhớ
                </Button>
            </div>
            {error && <p className="stage__error" role="alert">{error}</p>}
            <p className="flash__keys">
                <Icon name="keyboard" size={14} />
                <span>
                    <kbd>Space</kbd> lật thẻ · <kbd>←</kbd> <kbd>→</kbd> chuyển thẻ
                </span>
            </p>
        </div>
    );
}
