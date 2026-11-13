import { Link, useParams } from 'react-router-dom';
import { Button, ErrorState, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { PARTS } from '../data/parts.js';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import { formatWhen } from '../utils/format.js';
import { LockedStage } from './Stage.jsx';

export const STATUS_META = {
    done: { text: 'Đã hoàn thành', cls: 'tag--leaf', icon: 'check-circle' },
    current: { text: 'Đang học', cls: '', icon: 'play' },
    locked: { text: 'Chưa mở khoá', cls: 'tag--muted', icon: 'lock' },
    soon: { text: 'Đang biên soạn', cls: 'tag--muted', icon: 'clock' },
};

export default function Lesson() {
    const { lessonId } = useParams();
    const { data: l, error, loading, reload } = useAsync(() => learning.lessonInfo(lessonId), [lessonId]);

    if (error?.code === 'stage-locked') return <LockedStage eyebrow={`Bài ${lessonId}`} reason={error.message} />;
    if (error) {
        return (
            <ErrorState title="Không tìm thấy bài học" onRetry={error.status === 404 ? undefined : reload}>
                {error.message}
            </ErrorState>
        );
    }
    if (loading) {
        return (
            <div className="lesson-page">
                <Skeleton h={20} w={180} />
                <Skeleton h={220} r={24} style={{ marginTop: 20 }} />
                <Skeleton h={160} r={18} style={{ marginTop: 20 }} />
            </div>
        );
    }

    const meta = STATUS_META[l.status];
    const playable = l.status === 'done' || l.status === 'current';
    const cta = l.inProgress ? 'Học tiếp' : l.status === 'done' ? 'Học lại' : l.attempts ? 'Làm lại bài' : 'Bắt đầu học';

    return (
        <div className="lesson-page">
            <nav className="crumbs" aria-label="Đường dẫn">
                <Link to="/bai-hoc">Bài học</Link>
                <Icon name="chevron-right" size={14} />
                <Link to={`/bai-hoc/chang/${l.stage.id}`}>Chặng {l.stage.id}</Link>
                <Icon name="chevron-right" size={14} />
                <span aria-current="page">Bài {l.id}</span>
            </nav>

            <header className={`lesson-hero lesson-hero--${l.stage.tone}`}>
                <div className="lesson-hero__copy">
                    <span className={`tag ${meta.cls}`}>
                        <Icon name={meta.icon} size={14} /> {meta.text}
                    </span>
                    <h1>
                        Bài {l.id}: {l.title}
                    </h1>
                    <p className="lesson-hero__meta">
                        <span>
                            <Icon name="flag" size={15} /> Chặng {l.stage.id}: {l.stage.title}
                        </span>
                        <span>
                            <Icon name="clock" size={15} /> Khoảng {l.minutes} phút
                        </span>
                        {l.best != null && (
                            <span>
                                <Icon name="star" size={15} /> Tốt nhất {l.best}%
                            </span>
                        )}
                    </p>
                    {playable ? (
                        <div className="lesson-hero__cta">
                            <Button to={`/hoc/${l.id}`} size="lg" variant="leaf" iconRight="arrow-right">
                                {cta}
                            </Button>
                            {l.inProgress && <span className="muted">Bạn đang làm dở bài này – tiến độ đã được lưu.</span>}
                        </div>
                    ) : (
                        <div className="lock-note">
                            <Icon name={l.status === 'soon' ? 'clock' : 'lock'} size={18} />
                            <span>{l.lockReason}</span>
                        </div>
                    )}
                </div>
                <img src={l.status === 'done' ? '/assets/mascot-cheer.webp' : '/assets/mascot-book.webp'} alt="" className="lesson-hero__art" />
            </header>

            {l.counts && (
                <section className="lesson-parts" aria-label="Cấu trúc bài học">
                    {Object.entries(l.counts).map(([key, n], i) => (
                        <div key={key} className="lpart">
                            <span className="lpart__step">Bài tập {i + 1}</span>
                            <span className="lpart__icon">
                                <Icon name={PARTS[key].icon} size={22} />
                            </span>
                            <h3>{PARTS[key].title}</h3>
                            <p>{PARTS[key].subtitle}</p>
                            <span className="lpart__count">{n} câu</span>
                        </div>
                    ))}
                </section>
            )}

            <div className="lesson-grid">
                {l.goals.length > 0 && (
                    <section className="panel">
                        <div className="panel__head">
                            <h2 className="panel__title">Mục tiêu bài học</h2>
                        </div>
                        <ul className="goal-list panel__body">
                            {l.goals.map((g) => (
                                <li key={g}>
                                    <Icon name="check" size={16} strokeWidth={2.5} />
                                    {g}
                                </li>
                            ))}
                        </ul>
                        <p className="panel__foot muted">
                            Điều kiện hoàn thành: trả lời đúng ngay lần đầu từ {l.threshold}% số câu Bắc âm cầu và Lắp khung câu.
                        </p>
                    </section>
                )}

                <section className="panel">
                    <div className="panel__head">
                        <h2 className="panel__title">Lịch sử làm bài</h2>
                    </div>
                    {l.history.length ? (
                        <ul className="history panel__body">
                            {l.history.map((a) => (
                                <li key={a.id}>
                                    <span className={`score-chip ${a.passed ? 'is-pass' : 'is-fail'}`}>{a.score}%</span>
                                    <span className="history__main">
                                        <strong>{a.passed ? 'Đạt' : 'Chưa đạt'}</strong>
                                        <small>
                                            Nghe {a.parts.listen.correct}/{a.parts.listen.total} · Ghép {a.parts.build.correct}/{a.parts.build.total} · Nói{' '}
                                            {a.parts.shadow.practiced}/{a.parts.shadow.total}
                                        </small>
                                    </span>
                                    <time>{formatWhen(a.at)}</time>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="panel__body muted">Bạn chưa làm bài này lần nào.</p>
                    )}
                </section>
            </div>

            <nav className="pager" aria-label="Chuyển bài">
                {l.prevId ? (
                    <Link to={`/bai-hoc/${l.prevId}`} className="pager__link">
                        <Icon name="arrow-left" size={16} /> Bài {l.prevId}
                    </Link>
                ) : (
                    <span />
                )}
                <Link to={`/bai-hoc/chang/${l.stage.id}`} className="pager__link pager__link--mid">
                    Danh sách bài chặng {l.stage.id}
                </Link>
                {l.nextId ? (
                    <Link to={`/bai-hoc/${l.nextId}`} className="pager__link">
                        Bài {l.nextId} <Icon name="arrow-right" size={16} />
                    </Link>
                ) : (
                    <span />
                )}
            </nav>
        </div>
    );
}
