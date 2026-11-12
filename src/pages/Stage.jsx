import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, ErrorState, Progress, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import { STATUS_META } from './Lesson.jsx';

const ROW_ICON = { done: 'check', current: 'play', locked: 'lock', soon: 'clock' };

export default function Stage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: stage, error, loading, reload } = useAsync(() => learning.stage(id), [id]);

    if (error) {
        return (
            <ErrorState title="Không tìm thấy chặng học" onRetry={error.status === 404 ? undefined : reload}>
                {error.message}
            </ErrorState>
        );
    }

    const current = stage?.lessons.find((l) => l.status === 'current');
    const lastDone = stage ? [...stage.lessons].reverse().find((l) => l.status === 'done') : null;
    const focus = current || lastDone;

    return (
        <div className="stage-page">
            <nav className="crumbs" aria-label="Đường dẫn">
                <Link to="/bai-hoc">Bài học</Link>
                <Icon name="chevron-right" size={14} />
                <span aria-current="page">Chặng {id}</span>
            </nav>

            {loading ? (
                <>
                    <Skeleton h={120} r={18} />
                    <Skeleton h={360} r={18} style={{ marginTop: 24 }} />
                </>
            ) : (
                <div className={`stage-board stage-board--${stage.tone}`}>
                    <header className="stage-board__head">
                        <div>
                            <span className="eyebrow">Chặng {stage.id}</span>
                            <h1>{stage.title}</h1>
                            <p>{stage.summary}</p>
                        </div>
                        <div className="stage-board__progress">
                            <span>
                                <strong>{stage.completed}</strong>/{stage.total} bài hoàn thành
                            </span>
                            <Progress value={stage.percent} tone={stage.tone} label="Tiến độ chặng" />
                        </div>
                    </header>

                    <ol className="lesson-table">
                        {stage.lessons.map((l) => {
                            const open = l.status === 'done' || l.status === 'current';
                            return (
                                <li key={l.id} className={`lrow is-${l.status}`}>
                                    <button
                                        className="lrow__btn"
                                        onClick={() => navigate(`/bai-hoc/${l.id}`)}
                                        aria-label={`Bài ${l.id}: ${l.title} – ${STATUS_META[l.status].text}`}
                                    >
                                        <span className="lrow__num">Bài {l.id}</span>
                                        <span className="lrow__title">
                                            {l.title}
                                            <small>
                                                {l.status === 'soon'
                                                    ? 'Đang biên soạn'
                                                    : l.status === 'locked'
                                                      ? l.lockReason
                                                      : `${l.minutes} phút${l.best != null ? ` · Tốt nhất ${l.best}%` : ''}${l.inProgress ? ' · Đang làm dở' : ''}`}
                                            </small>
                                        </span>
                                        <span className={`lrow__state lrow__state--${l.status}`} title={STATUS_META[l.status].text}>
                                            <Icon name={ROW_ICON[l.status]} size={16} strokeWidth={l.status === 'done' ? 3 : 2} />
                                        </span>
                                    </button>
                                    {open && (
                                        <Link to={`/hoc/${l.id}`} className="lrow__go" aria-label={`Vào học bài ${l.id}`}>
                                            {l.inProgress ? 'Học tiếp' : l.status === 'done' ? 'Ôn lại' : 'Học'}
                                        </Link>
                                    )}
                                </li>
                            );
                        })}
                    </ol>

                    <footer className="stage-board__foot">
                        <Link to="/bai-hoc" className="back-link">
                            <Icon name="arrow-left" size={16} /> Lộ trình
                        </Link>
                        {focus ? (
                            <Button to={`/bai-hoc/${focus.id}`} variant="green" size="lg" iconRight="arrow-right">
                                Xem bài {focus.id}
                            </Button>
                        ) : (
                            <span className="muted">
                                {stage.status === 'soon' ? 'Nội dung chặng này đang được biên soạn.' : 'Hoàn thành chặng trước để mở khoá.'}
                            </span>
                        )}
                    </footer>
                    <img src="/assets/journey-landscape.webp" alt="" className="stage-board__art" aria-hidden="true" />
                </div>
            )}
        </div>
    );
}
