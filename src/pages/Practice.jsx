import { useMemo, useState } from 'react';
import { Button, ErrorState, Progress, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';

function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ───────────── Flashcards ───────────── */
function Flashcards({ words }) {
    const [deck, setDeck] = useState(words);
    const [i, setI] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const card = deck[i];

    const go = (d) => {
        setFlipped(false);
        setI((x) => (x + d + deck.length) % deck.length);
    };

    return (
        <div className="flash">
            <div className="flash__meta">
                <span>
                    Thẻ {i + 1}/{deck.length}
                </span>
                <button
                    className="link"
                    onClick={() => {
                        setDeck(shuffle(words));
                        setI(0);
                        setFlipped(false);
                    }}
                >
                    Trộn thẻ
                </button>
            </div>
            <Progress value={((i + 1) / deck.length) * 100} tone="leaf" label="Tiến độ bộ thẻ" />

            <button
                className={`flash__card ${flipped ? 'is-flipped' : ''}`}
                onClick={() => setFlipped((v) => !v)}
                aria-pressed={flipped}
                aria-label={flipped ? `${card.word} nghĩa là ${card.meaning}` : `Từ ${card.word}. Chạm để xem nghĩa`}
            >
                <span className="flash__inner">
                    <span className="flash__face flash__front">
                        <span className="tag tag--muted">{card.topic}</span>
                        <strong>{card.word}</strong>
                        <small>Chạm để xem nghĩa</small>
                    </span>
                    <span className="flash__face flash__back">
                        <span className="tag tag--leaf">Tiếng Việt</span>
                        <strong>{card.meaning}</strong>
                        <small>
                            {card.word} = {card.meaning}
                        </small>
                    </span>
                </span>
            </button>

            <div className="flash__nav">
                <Button variant="light" iconLeft="arrow-left" onClick={() => go(-1)}>
                    Trước
                </Button>
                <Button variant="green" iconRight="arrow-right" onClick={() => go(1)}>
                    Thẻ tiếp
                </Button>
            </div>
        </div>
    );
}

/* ───────────── Quiz ───────────── */
function buildQuiz(words) {
    return shuffle(words).map((w) => {
        const others = shuffle(words.filter((o) => o.id !== w.id)).slice(0, 3);
        return { word: w, options: shuffle([w, ...others]) };
    });
}

function Quiz({ words }) {
    const [quiz, setQuiz] = useState(() => buildQuiz(words));
    const [i, setI] = useState(0);
    const [picked, setPicked] = useState(null);
    const [score, setScore] = useState(0);
    const done = i >= quiz.length;

    if (done) {
        const pct = Math.round((score / quiz.length) * 100);
        return (
            <div className="quiz-result">
                <img src={pct >= 60 ? '/assets/mascot-cheer.webp' : '/assets/mascot-point.webp'} alt="" />
                <h2>{pct >= 60 ? 'Làm tốt lắm!' : 'Cố lên một chút nữa!'}</h2>
                <p>
                    Bạn trả lời đúng <strong>{score}</strong>/{quiz.length} câu ({pct}%).
                </p>
                <Button
                    iconLeft="refresh"
                    onClick={() => {
                        setQuiz(buildQuiz(words));
                        setI(0);
                        setScore(0);
                        setPicked(null);
                    }}
                >
                    Làm lại
                </Button>
            </div>
        );
    }

    const q = quiz[i];
    const answered = picked !== null;

    return (
        <div className="quiz">
            <div className="flash__meta">
                <span>
                    Câu {i + 1}/{quiz.length}
                </span>
                <span>Đúng: {score}</span>
            </div>
            <Progress value={(i / quiz.length) * 100} tone="clay" label="Tiến độ bài trắc nghiệm" />
            <h2 className="quiz__q">
                <span className="quiz__word">{q.word.word}</span> nghĩa là gì?
            </h2>
            <div className="quiz__opts" role="radiogroup">
                {q.options.map((o, idx) => {
                    const correct = o.id === q.word.id;
                    const state = !answered ? '' : correct ? 'is-correct' : picked === o.id ? 'is-wrong' : 'is-dim';
                    return (
                        <button
                            key={o.id}
                            role="radio"
                            aria-checked={picked === o.id}
                            className={`quiz__opt ${state}`}
                            disabled={answered}
                            onClick={() => {
                                setPicked(o.id);
                                if (correct) setScore((s) => s + 1);
                            }}
                        >
                            <span className="quiz__key">{String.fromCharCode(65 + idx)}</span>
                            {o.meaning}
                            {answered && correct && <Icon name="check" size={18} strokeWidth={2.5} className="quiz__mark" />}
                            {answered && !correct && picked === o.id && <Icon name="x" size={18} strokeWidth={2.5} className="quiz__mark" />}
                        </button>
                    );
                })}
            </div>
            <div className={`quiz__feedback ${answered ? 'is-shown' : ''}`} aria-live="polite">
                {answered && (
                    <>
                        <p className={picked === q.word.id ? 'ok' : 'bad'}>
                            {picked === q.word.id ? 'Chính xác!' : `Chưa đúng. “${q.word.word}” nghĩa là “${q.word.meaning}”.`}
                        </p>
                        <Button
                            variant="green"
                            iconRight="arrow-right"
                            onClick={() => {
                                setI((x) => x + 1);
                                setPicked(null);
                            }}
                        >
                            {i + 1 === quiz.length ? 'Xem kết quả' : 'Câu tiếp theo'}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

export default function Practice({ trial = false }) {
    const { user } = useAuth();
    const [mode, setMode] = useState('cards');
    const { data, error, loading, reload } = useAsync(() => learning.vocabulary(), []);
    const words = useMemo(() => data ?? [], [data]);

    return (
        <div className={trial ? 'container trial' : ''}>
            <header className="page-head">
                <div>
                    {trial && <span className="eyebrow">Học thử 5 phút</span>}
                    <h1>{trial ? 'Năm từ đầu tiên của bạn' : 'Ôn luyện'}</h1>
                    <p>Lật thẻ để ghi nhớ, rồi tự kiểm tra bằng câu hỏi nhanh.</p>
                </div>
                <div className="segmented" role="tablist" aria-label="Chế độ ôn luyện">
                    <button role="tab" aria-selected={mode === 'cards'} onClick={() => setMode('cards')}>
                        Thẻ ghi nhớ
                    </button>
                    <button role="tab" aria-selected={mode === 'quiz'} onClick={() => setMode('quiz')}>
                        Trắc nghiệm
                    </button>
                </div>
            </header>

            <div className="practice">
                {error ? (
                    <ErrorState onRetry={reload} />
                ) : loading ? (
                    <Skeleton h={360} r={24} />
                ) : mode === 'cards' ? (
                    <Flashcards words={words} />
                ) : (
                    <Quiz key="quiz" words={words} />
                )}
            </div>

            {trial && !user && (
                <aside className="trial-cta">
                    <p>
                        <strong>Thích không?</strong> Tạo tài khoản để lưu tiến độ và học tiếp 14 bài trong hành trình.
                    </p>
                    <Button to="/dang-ky" iconRight="arrow-right">
                        Đăng ký miễn phí
                    </Button>
                </aside>
            )}
        </div>
    );
}
