import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, ErrorState, Ring, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import ExerciseStage from '../components/learn/ExerciseStage.jsx';
import { learning, notebook } from '../services/api.js';
import { createTrialAdapter } from '../services/trial.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function serverAdapter(lessonId) {
    return {
        start: () => learning.startLesson(lessonId),
        answer: (itemId, r) => learning.answer(lessonId, itemId, r),
        rate: (itemId, r) => learning.rateShadow(lessonId, itemId, r),
        saveStep: (step) => learning.saveStep(lessonId, step).catch(() => {}),
        finish: () => learning.finishLesson(lessonId),
        restart: () => learning.restartLesson(lessonId),
        save: (entry) => notebook.save(entry),
        savedIds: () => notebook.list().then((l) => new Set(l.map((n) => n.id))),
    };
}

/* ───────────── Intro ───────────── */
function Intro({ data, steps, onStart, resumed }) {
    return (
        <div className="intro">
            <div className="intro__head">
                <span className="tag tag--leaf">
                    Chặng {data.stage.id}: {data.stage.title}
                </span>
                <h1>
                    Bài {data.lesson.id}: {data.lesson.title}
                </h1>
                <p>
                    Khoảng {data.lesson.minutes} phút · {steps.length} câu luyện tập
                </p>
            </div>
            {data.lesson.goals?.length > 0 && (
                <div className="intro__goals">
                    <h3>Sau bài này bạn sẽ</h3>
                    <ul>
                        {data.lesson.goals.map((g) => (
                            <li key={g}>
                                <Icon name="check" size={16} strokeWidth={2.5} /> {g}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <ol className="intro__parts">
                {data.parts.map((p, i) => (
                    <li key={p.key}>
                        <span className="intro__num">{i + 1}</span>
                        <Icon name={p.icon} size={22} />
                        <div>
                            <strong>{p.title}</strong>
                            <span>
                                {p.subtitle} · {p.items.length} câu
                            </span>
                        </div>
                    </li>
                ))}
            </ol>
            <p className="intro__rule">
                <Icon name="info" size={16} />
                <span>
                    Trả lời đúng ngay lần đầu từ <b>{data.threshold}%</b> số câu nghe và ghép câu để mở khoá bài tiếp theo. Phần Shadowing được ghi nhận là đã
                    thực hành.
                </span>
            </p>
            <p className="intro__keys">
                <Icon name="keyboard" size={16} />
                <span>
                    Phím tắt: <kbd>1</kbd>–<kbd>4</kbd> chọn đáp án · <kbd>Enter</kbd> kiểm tra / tiếp tục · <kbd>R</kbd> nghe lại
                </span>
            </p>
            <Button size="lg" variant="leaf" iconRight="arrow-right" onClick={onStart}>
                {resumed ? 'Học tiếp' : 'Bắt đầu học'}
            </Button>
        </div>
    );
}

/* ───────────── Result ───────────── */
function Result({ result, trial, onRetry, lessonId }) {
    const { parts, score, passed, threshold } = result;
    const rows = [
        { icon: 'headphones', label: 'Bắc âm cầu', value: `${parts.listen.correct}/${parts.listen.total} đúng`, ok: parts.listen.correct === parts.listen.total },
        { icon: 'puzzle', label: 'Lắp khung câu', value: `${parts.build.correct}/${parts.build.total} đúng`, ok: parts.build.correct === parts.build.total },
        {
            icon: 'mic',
            label: 'Luyện nói',
            value: parts.shadow.practiced ? `Đã thực hành ${parts.shadow.practiced}/${parts.shadow.total} câu` : 'Chưa thực hành',
            ok: parts.shadow.practiced === parts.shadow.total,
        },
    ];
    const reviewIds = (result.review || []).map((r) => r.itemId).join(',');

    return (
        <div className="result">
            <div className="result__hero">
                <img src={passed ? '/assets/mascot-cheer.webp' : '/assets/mascot-point.webp'} alt="" className="result__mascot" />
                <div className="result__score">
                    <Ring value={score} size={148} stroke={14}>
                        <strong className="ring__num ring__num--md">{score}%</strong>
                    </Ring>
                    <span className={`result__badge ${passed ? 'is-pass' : 'is-fail'}`}>
                        {passed ? `Đạt (từ ${threshold}%)` : `Cần đạt ${threshold}%`}
                    </span>
                </div>
                <div className="result__copy">
                    <h1>{passed ? `Hoàn thành bài ${result.lessonId}!` : 'Gần được rồi!'}</h1>
                    <p>
                        {passed
                            ? result.unlocked?.length
                                ? `Bạn đã mở khoá Bài ${result.unlocked[0].id}: ${result.unlocked[0].title}.`
                                : 'Kết quả đã được lưu vào hành trình của bạn.'
                            : `Bạn cần trả lời đúng ít nhất ${threshold}% để mở khoá bài tiếp theo. Ôn lại các câu sai rồi thử lại nhé.`}
                    </p>
                    <ul className="result__rows">
                        {rows.map((r) => (
                            <li key={r.label}>
                                <span className={`result__icon ${r.ok ? '' : 'is-warn'}`}>
                                    <Icon name={r.icon} size={20} />
                                </span>
                                <span className="result__label">{r.label}</span>
                                <strong>{r.value}</strong>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {result.review?.length > 0 && (
                <section className="consolidate">
                    <img src="/assets/mascot-book.webp" alt="" />
                    <div>
                        <h2>Củng cố bài vừa học</h2>
                        <p>
                            Còn {result.review.length} câu cần luyện lại.
                            {!trial && ' Các câu này đã được thêm vào mục Ôn luyện.'}
                        </p>
                        <ul className="consolidate__list">
                            {result.review.map((r) => (
                                <li key={r.itemId}>
                                    <Icon name={r.part === 'listen' ? 'headphones' : r.part === 'build' ? 'puzzle' : 'mic'} size={16} />
                                    {r.label}
                                </li>
                            ))}
                        </ul>
                        {!trial && (
                            <Button to={`/on-luyen/phien?items=${encodeURIComponent(reviewIds)}`} variant="green" iconRight="arrow-right">
                                Ôn {result.review.length > 1 ? 'các câu này' : 'câu này'}
                            </Button>
                        )}
                    </div>
                </section>
            )}

            <div className="result__actions">
                {trial ? (
                    <>
                        <Button variant="light" iconLeft="refresh" onClick={onRetry}>
                            Học thử lại
                        </Button>
                        <Button to="/dang-ky" iconRight="arrow-right">
                            Đăng ký để lưu tiến độ
                        </Button>
                    </>
                ) : (
                    <>
                        <Button to="/bai-hoc" variant="ghost" iconLeft="bars">
                            Xem tiến độ
                        </Button>
                        <Button variant="light" iconLeft="refresh" onClick={onRetry}>
                            Học lại
                        </Button>
                        {passed && result.next ? (
                            <Button to={`/hoc/${result.next.id}`} variant="leaf" iconRight="arrow-right">
                                Học bài {result.next.id}
                            </Button>
                        ) : (
                            <Button to={`/bai-hoc/${lessonId}`} variant="leaf" iconRight="arrow-right">
                                {passed ? 'Về trang bài học' : 'Xem lại bài học'}
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/* ───────────── Player ───────────── */
export default function LessonPlayer({ trial = false }) {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { user } = useAuth();
    const adapter = useMemo(() => (trial ? createTrialAdapter() : serverAdapter(lessonId)), [trial, lessonId]);

    const [state, setState] = useState({ loading: true, error: null, data: null });
    const [step, setStep] = useState(0);
    const [furthest, setFurthest] = useState(0);
    const [answers, setAnswers] = useState({});
    const [ratings, setRatings] = useState({});
    const [saved, setSaved] = useState(new Set());
    const [result, setResult] = useState(null);
    const [finishing, setFinishing] = useState(false);
    const [confirmExit, setConfirmExit] = useState(false);
    const [nonce, setNonce] = useState(0);

    const backTo = trial ? '/' : `/bai-hoc/${lessonId}`;

    useEffect(() => {
        let alive = true;
        setState({ loading: true, error: null, data: null });
        setResult(null);
        adapter
            .start()
            .then((data) => {
                if (!alive) return;
                const items = data.parts.flatMap((p) => p.items);
                const a = data.session.answers || {};
                const r = Object.fromEntries(Object.entries(data.session.shadow || {}).map(([k, v]) => [k, v.rating]));
                const firstOpen = items.findIndex((it) => (it.part === 'shadow' ? !r[it.id] : !a[it.id]));
                const touched = Object.keys(a).length + Object.keys(r).length > 0;
                const start = touched ? (firstOpen === -1 ? items.length : firstOpen + 1) : Math.min(data.session.step || 0, items.length);
                setAnswers(a);
                setRatings(r);
                setStep(start);
                setFurthest(start);
                setState({ loading: false, error: null, data });
            })
            .catch((error) => alive && setState({ loading: false, error, data: null }));
        if (!trial && adapter.savedIds) adapter.savedIds().then((s) => alive && setSaved(s)).catch(() => {});
        return () => {
            alive = false;
        };
    }, [adapter, trial, nonce]);

    const data = state.data;
    const items = useMemo(() => (data ? data.parts.flatMap((p) => p.items) : []), [data]);
    const total = items.length;
    const onResult = step > total;
    const item = step >= 1 && step <= total ? items[step - 1] : null;
    const inProgress = !result && step > 0 && (Object.keys(answers).length > 0 || Object.keys(ratings).length > 0);

    const go = useCallback(
        (s) => {
            setStep(s);
            setFurthest((f) => Math.max(f, s));
            adapter.saveStep(s);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [adapter]
    );

    async function finish() {
        setFinishing(true);
        try {
            const r = await adapter.finish();
            setResult(r);
            setStep(total + 1);
            if (!trial && r.passed && r.unlocked?.length) toast(`Đã mở khoá Bài ${r.unlocked[0].id}: ${r.unlocked[0].title}`);
        } catch (e) {
            toast(e.message || 'Không chấm được bài. Vui lòng thử lại.', { tone: 'error' });
        } finally {
            setFinishing(false);
        }
    }

    function next() {
        if (step >= total) finish();
        else go(step + 1);
    }

    async function retryLesson() {
        try {
            await adapter.restart();
        } catch {
            /* the server simply starts a fresh session next time */
        }
        setResult(null);
        setNonce((n) => n + 1);
    }

    function exit() {
        if (inProgress) setConfirmExit(true);
        else navigate(backTo);
    }

    /* ── states ── */
    if (state.loading) {
        return (
            <div className="player-page">
                <div className="player-shell">
                    <div className="player-main">
                        <Skeleton h={56} r={999} />
                        <Skeleton h={88} r={18} style={{ marginTop: 24 }} />
                        <Skeleton h={320} r={24} style={{ marginTop: 16 }} />
                    </div>
                </div>
            </div>
        );
    }
    if (state.error) {
        const locked = state.error.status === 403;
        return (
            <div className="player-page player-page--center">
                <div className="locked-card">
                    <span className="locked-card__icon">
                        <Icon name={locked ? 'lock' : 'alert'} size={28} />
                    </span>
                    <h1>{locked ? (state.error.code === 'soon' ? 'Bài học đang được biên soạn' : 'Bài học chưa được mở khoá') : 'Không mở được bài học'}</h1>
                    <p>{state.error.message}</p>
                    <div className="row-actions">
                        <Button to="/bai-hoc" variant="light" iconLeft="arrow-left">
                            Về hành trình
                        </Button>
                        {!locked && (
                            <Button variant="green" iconLeft="refresh" onClick={() => setNonce((n) => n + 1)}>
                                Thử lại
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // part boundaries for the rail
    let cursor = 1;
    const partRanges = data.parts.map((p) => {
        const r = { ...p, from: cursor, to: cursor + p.items.length - 1 };
        cursor += p.items.length;
        return r;
    });
    const activePart = item ? partRanges.find((p) => step >= p.from && step <= p.to)?.key : null;
    const isDone = (it) => (it.part === 'shadow' ? !!ratings[it.id] : !!answers[it.id]);

    return (
        <div className="player-page">
            <div className="player-shell">
                {/* Rail */}
                <aside className="rail" aria-label="Các phần của bài học">
                    <button className="rail__back" onClick={exit}>
                        <Icon name="arrow-left" size={16} /> {trial ? 'Về trang chủ' : 'Quay lại bài học'}
                    </button>
                    <div className="rail__lesson">
                        <img src="/assets/lesson-greeting.webp" alt="" />
                        <div>
                            <span className="tag tag--sand">
                                Chặng {data.stage.id}: {data.stage.title}
                            </span>
                            <strong>
                                Bài {data.lesson.id}: {data.lesson.title}
                            </strong>
                        </div>
                    </div>
                    <nav className="rail__nav">
                        <button className={`rail__item ${step === 0 ? 'is-active' : 'is-done'}`} onClick={() => go(0)} disabled={!!result}>
                            <span className="rail__icon">
                                <Icon name="guide" size={18} />
                            </span>
                            Giới thiệu bài học
                        </button>
                        {partRanges.map((p, i) => {
                            const done = p.items.every(isDone);
                            const reachable = p.from <= furthest && !result;
                            return (
                                <button
                                    key={p.key}
                                    className={`rail__item ${activePart === p.key ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
                                    onClick={() => reachable && go(p.from)}
                                    disabled={!reachable}
                                >
                                    <span className="rail__icon">
                                        <Icon name={done ? 'check' : p.icon} size={18} strokeWidth={done ? 2.5 : 1.75} />
                                    </span>
                                    <span>
                                        Bài tập {i + 1}: {p.title}
                                        <small>
                                            {p.items.filter(isDone).length}/{p.items.length} câu
                                        </small>
                                    </span>
                                </button>
                            );
                        })}
                        <div className={`rail__item rail__item--static ${onResult ? 'is-active' : ''}`}>
                            <span className="rail__icon">
                                <Icon name="flag" size={18} />
                            </span>
                            Tổng kết & đánh giá
                        </div>
                    </nav>
                    {data.best != null && !trial && <p className="rail__best">Kết quả tốt nhất: {data.best}%</p>}
                </aside>

                {/* Main */}
                <main className="player-main" id="main">
                    <div className="player-top">
                        <button className="icon-btn player-top__close" onClick={exit} aria-label="Thoát bài học">
                            <Icon name="x" size={20} />
                        </button>
                        {item ? (
                            <>
                                <span className="qpill">
                                    Câu {step}/{total}
                                </span>
                                <ol className="qdots" aria-label="Tiến độ câu hỏi">
                                    {items.map((it, i) => {
                                        const n = i + 1;
                                        const done = isDone(it);
                                        const cls = n === step ? 'is-current' : done ? 'is-done' : '';
                                        return (
                                            <li key={it.id} className={cls}>
                                                <button onClick={() => n <= furthest && go(n)} disabled={n > furthest} aria-label={`Câu ${n}${done ? ', đã làm' : ''}`} aria-current={n === step ? 'step' : undefined}>
                                                    {done && n !== step ? <Icon name="check" size={13} strokeWidth={3} /> : n}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ol>
                                <div className="qbar" aria-hidden="true">
                                    <span style={{ width: `${(items.filter(isDone).length / total) * 100}%` }} />
                                </div>
                            </>
                        ) : (
                            <span className="player-top__title">{onResult ? 'Kết quả bài học' : `Bài ${data.lesson.id}: ${data.lesson.title}`}</span>
                        )}
                    </div>

                    {step === 0 && <Intro data={data} steps={items} resumed={furthest > 0 || Object.keys(answers).length > 0} onStart={() => go(Math.max(1, furthest))} />}

                    {item && (
                        <ExerciseStage
                            key={`${item.id}-${nonce}`}
                            item={item}
                            initial={
                                item.part === 'shadow'
                                    ? { rating: ratings[item.id] }
                                    : answers[item.id] && {
                                          response: answers[item.id].response,
                                          result: {
                                              correct: answers[item.id].correct,
                                              answer: answers[item.id].answer,
                                              explain: answers[item.id].explain,
                                              translation: answers[item.id].translation,
                                          },
                                      }
                            }
                            onAnswer={async (resp) => {
                                const r = await adapter.answer(item.id, resp);
                                setAnswers((a) => ({ ...a, [item.id]: a[item.id] ? { ...a[item.id], response: resp } : { ...r, response: resp } }));
                                return r;
                            }}
                            onRate={async (rating) => {
                                await adapter.rate(item.id, rating);
                                setRatings((m) => ({ ...m, [item.id]: rating }));
                            }}
                            onSave={
                                adapter.save
                                    ? async (entry) => {
                                          await adapter.save(entry);
                                          setSaved((s) => new Set(s).add(`${entry.type}:${entry.ref}`));
                                          toast('Đã lưu vào sổ tay');
                                      }
                                    : null
                            }
                            saved={item.save ? saved.has(`${item.save.type}:${item.save.ref}`) : false}
                            onNext={next}
                            nextLabel={step >= total ? (finishing ? 'Đang chấm…' : 'Xem kết quả') : 'Tiếp tục'}
                        />
                    )}

                    {onResult && result && <Result result={result} trial={trial} lessonId={data.lesson.id} onRetry={retryLesson} />}

                    {trial && !user && step === 0 && (
                        <p className="trial-note">
                            <Icon name="info" size={16} />
                            <span>
                                Bạn đang học thử, kết quả không được lưu.{' '}
                                <Link to="/dang-ky" className="link">
                                    Tạo tài khoản
                                </Link>{' '}
                                để lưu tiến độ.
                            </span>
                        </p>
                    )}
                </main>
            </div>

            <Modal
                open={confirmExit}
                onClose={() => setConfirmExit(false)}
                title="Tạm dừng bài học?"
                footer={
                    <>
                        <Button variant="light" onClick={() => setConfirmExit(false)}>
                            Học tiếp
                        </Button>
                        <Button variant="green" onClick={() => navigate(backTo)}>
                            Thoát
                        </Button>
                    </>
                }
            >
                <p className="modal__lead">
                    {trial
                        ? 'Bạn đang học thử nên kết quả sẽ không được lưu.'
                        : `Bạn đã làm ${Object.keys(answers).length + Object.keys(ratings).length}/${total} câu. Tiến độ đã được lưu tự động – lần sau bạn có thể học tiếp đúng câu đang dừng.`}
                </p>
            </Modal>
        </div>
    );
}
