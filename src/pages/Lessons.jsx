import { Link } from 'react-router-dom';
import { Button, ErrorState, Progress, Ring, Skeleton } from '../components/ui.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';

const ACTION = {
    done: { label: 'Ôn lại', variant: 'green' },
    active: { label: 'Tiếp tục học', variant: 'clay' },
    locked: { label: 'Xem chặng', variant: 'outline' },
};

function stageCta(s) {
    if (s.status === 'done') return { text: `Ôn lại chặng ${s.id}`, variant: 'green' };
    if (s.status === 'active') return { text: `Tiếp tục chặng ${s.id}`, variant: 'clay' };
    return { text: `Khám phá chặng ${s.id}`, variant: 'outline-river' };
}

export default function Lessons() {
    const { data, error, loading, reload } = useAsync(() => learning.overview(), []);

    return (
        <div className="journey-page">
            {/* Map */}
            <section className="journey">
                <img className="journey__bg" src="/assets/journey-landscape.webp" alt="" />
                <div className="journey__head">
                    <h1>Hành trình học tiếng Mường</h1>
                    <p>Đi qua 3 chặng, khám phá 14 bài học</p>
                </div>
                <img className="journey__path" src="/assets/journey-path.webp" alt="" />
                <img className="journey__mascot" src="/assets/mascot-point.webp" alt="" />

                <ol className="journey__stops">
                    {(data?.stages ?? [1, 2, 3].map((id) => ({ id, placeholder: true }))).map((s) =>
                        s.placeholder ? (
                            <li key={s.id} className={`stop stop--${s.id}`}>
                                <Skeleton h={130} r={16} />
                            </li>
                        ) : (
                            <li key={s.id} className={`stop stop--${s.id} stop--${s.tone}`}>
                                <span className="stop__label">Chặng {s.id}</span>
                                <strong className="stop__title">{s.title}</strong>
                                <span className="stop__meta">{s.total} bài học</span>
                                <Button to={`/bai-hoc/chang/${s.id}`} size="sm" variant={stageCta(s).variant} iconRight="arrow-right">
                                    {stageCta(s).text}
                                </Button>
                            </li>
                        )
                    )}
                </ol>
            </section>

            {/* Overview */}
            {error ? (
                <ErrorState onRetry={reload} />
            ) : (
                <section className="overview">
                    <div className="overview__ring">
                        <h2>Toàn bộ hành trình</h2>
                        {loading ? (
                            <Skeleton w={200} h={200} r={999} />
                        ) : (
                            <Ring value={data.percent} size={200} stroke={22}>
                                <strong className="ring__num">{data.percent}%</strong>
                            </Ring>
                        )}
                        <p>
                            {loading ? '…' : `${data.completed}/${data.total}`} bài đã hoàn thành
                        </p>
                    </div>

                    <div className="panel overview__list">
                        {loading
                            ? [0, 1, 2].map((i) => <Skeleton key={i} h={72} style={{ margin: '12px 0' }} />)
                            : data.stages.map((s) => (
                                    <div key={s.id} className={`srow srow--${s.tone}`}>
                                        <span className="srow__num">{s.code}</span>
                                        <div className="srow__main">
                                            <h3>{s.title}</h3>
                                            <p>
                                                Chặng {s.id}: {s.completed}/{s.total} bài hoàn thành
                                            </p>
                                            <div className="srow__bar">
                                                <Progress value={s.percent} tone={s.tone} label={`Tiến độ chặng ${s.id}`} />
                                                <span className="srow__pct">{s.percent}%</span>
                                                <Link to={`/bai-hoc/chang/${s.id}`} className="link srow__link">
                                                    {ACTION[s.status].label}
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                    </div>
                </section>
            )}
        </div>
    );
}
