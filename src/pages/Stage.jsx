import { Link, useParams } from 'react-router-dom';
import { Button, ErrorState, Progress, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';

const STATUS = {
    done: { text: 'Đã hoàn thành', cls: 'tag--leaf' },
    current: { text: 'Đang học', cls: '' },
    todo: { text: 'Chưa học', cls: 'tag--muted' },
};

export default function Stage() {
    const { id } = useParams();
    const { data: stage, error, loading, reload } = useAsync(() => learning.stage(id), [id]);

    return (
        <div className="stage-page">
            <Link to="/bai-hoc" className="auth-back">
                <Icon name="arrow-left" size={16} />
                Hành trình
            </Link>

            {error ? (
                <ErrorState title="Không tìm thấy chặng học" onRetry={reload}>
                    {error.message}
                </ErrorState>
            ) : loading ? (
                <>
                    <Skeleton h={120} r={18} />
                    <Skeleton h={320} r={18} style={{ marginTop: 24 }} />
                </>
            ) : (
                <>
                    <header className={`stage-hero stage-hero--${stage.tone}`}>
                        <span className="stage-hero__num">{stage.code}</span>
                        <div className="stage-hero__copy">
                            <span className="eyebrow">Chặng {stage.id}</span>
                            <h1>{stage.title}</h1>
                            <p>{stage.summary}</p>
                        </div>
                        <div className="stage-hero__progress">
                            <strong>{stage.percent}%</strong>
                            <Progress value={stage.percent} tone={stage.tone} label="Tiến độ chặng" />
                            <span>
                                {stage.completed}/{stage.total} bài hoàn thành
                            </span>
                        </div>
                    </header>

                    <ol className="lesson-list">
                        {stage.lessons.map((l, i) => (
                            <li key={l.id} className={`lesson-row is-${l.status}`}>
                                <span className="lesson-row__idx">
                                    {l.status === 'done' ? <Icon name="check" size={18} strokeWidth={2.5} /> : i + 1}
                                </span>
                                <div className="lesson-row__main">
                                    <h3>
                                        Bài {l.id}: {l.title}
                                    </h3>
                                    <span className="lesson-row__meta">
                                        <Icon name="clock" size={14} /> {l.minutes} phút
                                    </span>
                                </div>
                                <span className={`tag ${STATUS[l.status].cls}`}>{STATUS[l.status].text}</span>
                                <Button
                                    to={`/bai-hoc/${l.id}`}
                                    size="sm"
                                    variant={l.status === 'current' ? 'clay' : l.status === 'done' ? 'light' : 'ghost'}
                                    className="lesson-row__btn"
                                >
                                    {l.status === 'done' ? 'Ôn lại' : l.status === 'current' ? 'Học tiếp' : 'Xem trước'}
                                </Button>
                            </li>
                        ))}
                    </ol>
                </>
            )}
        </div>
    );
}
