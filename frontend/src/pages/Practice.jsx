import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, EmptyState, ErrorState, Progress, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import Flashcards from '../components/learn/Flashcards.jsx';
import { learning, notebook, review } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import { formatDue } from '../utils/format.js';

const PART_ICON = { listen: 'headphones', build: 'puzzle', shadow: 'mic' };

function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ───────────── Review queue ───────────── */
function ReviewQueue() {
    const { data, error, loading, reload } = useAsync(() => review.list(), []);
    const [filter, setFilter] = useState('active');

    if (error) return <ErrorState onRetry={reload}>{error.message}</ErrorState>;
    if (loading) return <Skeleton h={280} r={18} />;

    const active = data.filter((c) => !c.mastered);
    const due = active.filter((c) => c.isDue);
    const mastered = data.filter((c) => c.mastered);
    const list = filter === 'active' ? active : mastered;

    if (!data.length) {
        return (
            <div className="rq-empty">
                <div className="rq-empty__hero">
                    <img src="/assets/mascot-cheer.webp" alt="" />
                    <div>
                        <h2>Chưa có câu nào cần ôn</h2>
                        <p>
                            Khi bạn trả lời sai một câu, hoặc tự đánh giá “Cần luyện thêm” ở phần Shadowing, câu đó sẽ tự vào đây để ôn theo lịch
                            ngắt quãng: ôn ngay → 1 ngày → 3 ngày → 7 ngày → đã thuộc.
                        </p>
                    </div>
                </div>
                <h3 className="rq-empty__label">Trong lúc chờ, bạn có thể</h3>
                <div className="practice-links">
                    <Link to="/on-luyen?tab=cards" className="plink">
                        <span className="plink__icon">
                            <Icon name="layers" size={22} />
                        </span>
                        <strong>Lật thẻ ghi nhớ</strong>
                        <span>Ôn từ vựng đã có hoặc các thẻ bạn đã lưu trong sổ tay.</span>
                        <em>
                            Mở thẻ <Icon name="arrow-right" size={16} />
                        </em>
                    </Link>
                    <Link to="/on-luyen?tab=quiz" className="plink plink--clay">
                        <span className="plink__icon">
                            <Icon name="target" size={22} />
                        </span>
                        <strong>Trắc nghiệm nhanh</strong>
                        <span>Tự kiểm tra nghĩa của các từ tiếng Mường trong chương trình.</span>
                        <em>
                            Làm bài <Icon name="arrow-right" size={16} />
                        </em>
                    </Link>
                    <Link to="/bai-hoc" className="plink plink--river">
                        <span className="plink__icon">
                            <Icon name="book" size={22} />
                        </span>
                        <strong>Học bài mới</strong>
                        <span>Tiếp tục hành trình – mỗi bài chỉ khoảng 5 phút.</span>
                        <em>
                            Xem hành trình <Icon name="arrow-right" size={16} />
                        </em>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="rq">
            <div className="rq__hero">
                <div>
                    <h2>{due.length ? `${due.length} câu đến hạn ôn` : 'Bạn đã ôn hết câu đến hạn'}</h2>
                    <p>
                        Ôn đúng một câu, hệ thống sẽ giãn lịch ôn lần sau (1 → 3 → 7 ngày). Đúng 4 lần liên tiếp là thuộc. Sai thì câu quay về ôn ngay.
                    </p>
                    <div className="rq__stats">
                        <span>
                            <strong>{active.length}</strong> đang ôn
                        </span>
                        <span>
                            <strong>{mastered.length}</strong> đã thuộc
                        </span>
                    </div>
                </div>
                {due.length > 0 ? (
                    <Button to="/on-luyen/phien" size="lg" variant="leaf" iconRight="arrow-right">
                        Bắt đầu ôn
                    </Button>
                ) : (
                    active.length > 0 && (
                        <Button to={`/on-luyen/phien?items=${active.map((c) => c.itemId).join(',')}`} size="lg" variant="light" iconLeft="refresh">
                            Ôn trước hạn
                        </Button>
                    )
                )}
            </div>

            <div className="chips" role="tablist" aria-label="Lọc danh sách">
                <button role="tab" aria-selected={filter === 'active'} className="chip" onClick={() => setFilter('active')}>
                    Đang ôn ({active.length})
                </button>
                <button role="tab" aria-selected={filter === 'mastered'} className="chip" onClick={() => setFilter('mastered')}>
                    Đã thuộc ({mastered.length})
                </button>
            </div>

            {list.length === 0 ? (
                <p className="muted rq__none">{filter === 'active' ? 'Không còn câu nào đang ôn.' : 'Chưa có câu nào được đánh dấu là đã thuộc.'}</p>
            ) : (
                <ul className="rq__list">
                    {list.map((c) => (
                        <li key={c.itemId} className={c.isDue ? 'is-due' : ''}>
                            <span className="rq__icon">
                                <Icon name={PART_ICON[c.part]} size={18} />
                            </span>
                            <span className="rq__main">
                                <strong>{c.label}</strong>
                                <small>
                                    {c.partTitle} · Bài {c.lessonId} · sai {c.wrong} lần{c.right ? `, đúng ${c.right} lần khi ôn` : ''}
                                </small>
                            </span>
                            <span className="boxes" aria-label={`Mức ghi nhớ ${c.box}/5`}>
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <i key={n} className={n <= c.box ? 'on' : ''} />
                                ))}
                            </span>
                            <span className={`rq__due ${c.isDue ? 'is-due' : ''}`}>{formatDue(c.mastered ? null : c.due)}</span>
                            {!c.mastered && (
                                <Link to={`/on-luyen/phien?items=${c.itemId}`} className="rq__go" aria-label={`Ôn câu ${c.label}`}>
                                    <Icon name="arrow-right" size={18} />
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* ───────────── Quick quiz over program vocabulary ───────────── */
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

    if (i >= quiz.length) {
        const p = Math.round((score / quiz.length) * 100);
        return (
            <div className="quiz-result">
                <img src={p >= 80 ? '/assets/mascot-cheer.webp' : '/assets/mascot-point.webp'} alt="" />
                <h2>{p >= 80 ? 'Làm tốt lắm!' : 'Cố lên một chút nữa!'}</h2>
                <p>
                    Bạn trả lời đúng <strong>{score}</strong>/{quiz.length} câu ({p}%).
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
            <div className="choices" role="radiogroup">
                {q.options.map((o, idx) => {
                    const correct = o.id === q.word.id;
                    const state = !answered ? '' : correct ? 'is-correct' : picked === o.id ? 'is-wrong' : 'is-dim';
                    return (
                        <button
                            key={o.id}
                            role="radio"
                            aria-checked={picked === o.id}
                            className={`choice ${state}`}
                            disabled={answered}
                            onClick={() => {
                                setPicked(o.id);
                                if (correct) setScore((s) => s + 1);
                            }}
                        >
                            <span className="choice__key">{String.fromCharCode(65 + idx)}</span>
                            <span className="choice__text">{o.meaning}</span>
                        </button>
                    );
                })}
            </div>
            <div className="quiz__feedback" aria-live="polite">
                {answered && (
                    <>
                        <p className={picked === q.word.id ? 'ok' : 'bad'}>
                            {picked === q.word.id ? 'Chính xác!' : `Chưa đúng. “${q.word.word}” nghĩa là “${q.word.meaning}”.`}
                        </p>
                        <Button
                            variant="leaf"
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

function CardsTab() {
    const { data, error, loading, reload } = useAsync(() => Promise.all([notebook.list(), learning.vocabulary()]), []);
    const [source, setSource] = useState('saved');
    const deck = useMemo(() => {
        if (!data) return [];
        const [saved, vocab] = data;
        if (source === 'saved' && saved.length) return saved.map((n) => ({ id: n.id, word: n.text, meaning: n.meaning, topic: n.topic, savedId: n.id }));
        return vocab.map((v) => ({ id: v.id, word: v.word, meaning: v.meaning, topic: v.topic }));
    }, [data, source]);

    if (error) return <ErrorState onRetry={reload} />;
    if (loading) return <Skeleton h={360} r={24} />;
    const hasSaved = data[0].length > 0;

    return (
        <>
            <div className="chips" role="tablist" aria-label="Nguồn thẻ">
                <button role="tab" aria-selected={source === 'saved' && hasSaved} className="chip" onClick={() => setSource('saved')} disabled={!hasSaved}>
                    Sổ tay của tôi ({data[0].length})
                </button>
                <button role="tab" aria-selected={source === 'all' || !hasSaved} className="chip" onClick={() => setSource('all')}>
                    Toàn bộ từ vựng ({data[1].length})
                </button>
            </div>
            {!hasSaved && (
                <p className="muted small hint-line">
                    Mẹo: bấm “Lưu vào sổ tay” trong bài học để tạo bộ thẻ riêng của bạn.
                </p>
            )}
            <Flashcards key={source} cards={deck} onMark={(c, known) => c.savedId ? notebook.markCard(c.savedId, known) : undefined} />
        </>
    );
}

function QuizTab() {
    const { data, error, loading, reload } = useAsync(() => learning.vocabulary(), []);
    if (error) return <ErrorState onRetry={reload} />;
    if (loading) return <Skeleton h={360} r={24} />;
    return <Quiz words={data} />;
}

const MODES = ['review', 'cards', 'quiz'];

export default function Practice() {
    const [params, setParams] = useSearchParams();
    const mode = MODES.includes(params.get('tab')) ? params.get('tab') : 'review';
    const setMode = (m) => setParams(m === 'review' ? {} : { tab: m }, { replace: true });
    return (
        <div>
            <header className="page-head">
                <div>
                    <h1>Ôn luyện</h1>
                    <p>Ôn lại câu từng làm sai theo lịch ngắt quãng, lật thẻ từ vựng và tự kiểm tra nhanh.</p>
                </div>
                <div className="segmented" role="tablist" aria-label="Chế độ ôn luyện">
                    <button role="tab" aria-selected={mode === 'review'} onClick={() => setMode('review')}>
                        Cần ôn tập
                    </button>
                    <button role="tab" aria-selected={mode === 'cards'} onClick={() => setMode('cards')}>
                        Thẻ ghi nhớ
                    </button>
                    <button role="tab" aria-selected={mode === 'quiz'} onClick={() => setMode('quiz')}>
                        Trắc nghiệm
                    </button>
                </div>
            </header>
            <div className={mode === 'review' ? '' : 'practice'}>
                {mode === 'review' && <ReviewQueue />}
                {mode === 'cards' && <CardsTab />}
                {mode === 'quiz' && <QuizTab />}
            </div>
        </div>
    );
}
