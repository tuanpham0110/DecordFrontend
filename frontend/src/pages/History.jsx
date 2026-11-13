import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, EmptyState, ErrorState, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';

const FILTERS = [
    { key: 'all', label: 'Tất cả', test: () => true },
    { key: 'pass', label: 'Đạt', test: (a) => a.passed },
    { key: 'fail', label: 'Chưa đạt', test: (a) => !a.passed },
];

const DAY = 86400000;
const startOfDay = (t) => new Date(t).setHours(0, 0, 0, 0);

function dayLabel(ts) {
    const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
    if (diff === 0) return 'Hôm nay';
    if (diff === 1) return 'Hôm qua';
    return new Date(ts).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}
const timeOf = (ts) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function duration(sec) {
    if (!sec) return null;
    if (sec < 60) return `${sec} giây`;
    return `${Math.round(sec / 60)} phút`;
}

/** "Nghe 3/3 · Ghép câu 1/2 · Nói 2/2" */
function breakdown(parts) {
    const out = [];
    if (parts?.listen?.total) out.push(`Nghe ${parts.listen.correct}/${parts.listen.total}`);
    if (parts?.build?.total) out.push(`Ghép câu ${parts.build.correct}/${parts.build.total}`);
    if (parts?.shadow?.total) out.push(`Nói ${parts.shadow.practiced}/${parts.shadow.total}`);
    return out.join(' · ');
}

export default function History() {
    const { data, error, loading, reload } = useAsync(() => learning.history(), []);
    const [filter, setFilter] = useState('all');

    const stats = useMemo(() => {
        if (!data?.length) return null;
        const passed = data.filter((a) => a.passed).length;
        return {
            attempts: data.length,
            passRate: Math.round((passed / data.length) * 100),
            average: Math.round(data.reduce((n, a) => n + a.score, 0) / data.length),
            minutes: Math.round(data.reduce((n, a) => n + (a.durationSec || 0), 0) / 60),
            lessons: new Set(data.filter((a) => a.passed).map((a) => a.lessonId)).size,
        };
    }, [data]);

    const groups = useMemo(() => {
        const test = FILTERS.find((f) => f.key === filter).test;
        const map = new Map();
        for (const a of (data ?? []).filter(test)) {
            const key = startOfDay(a.at);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(a);
        }
        return [...map.entries()].sort((a, b) => b[0] - a[0]);
    }, [data, filter]);

    return (
        <div className="hist">
            <header className="page-head">
                <div>
                    <h1>Lịch sử học</h1>
                    <p>Kết quả từng lần làm bài của bạn, mới nhất ở trên cùng.</p>
                </div>
                <Button to="/bai-hoc" variant="green" iconRight="arrow-right">
                    Học tiếp
                </Button>
            </header>

            {error ? (
                <ErrorState onRetry={reload}>{error.message}</ErrorState>
            ) : loading && !data ? (
                <>
                    <div className="hist-stats">
                        {[0, 1, 2, 3].map((i) => (
                            <Skeleton key={i} h={88} r={18} />
                        ))}
                    </div>
                    <Skeleton h={320} r={18} />
                </>
            ) : !data.length ? (
                <div className="panel">
                    <EmptyState
                        title="Chưa có lần làm bài nào"
                        art="/assets/mascot-book.webp"
                        action={
                            <Button to="/bai-hoc" variant="green" iconRight="arrow-right">
                                Bắt đầu bài đầu tiên
                            </Button>
                        }
                    >
                        Mỗi lần bạn hoàn thành một bài học, điểm số và chi tiết từng phần sẽ được lưu lại ở đây.
                    </EmptyState>
                </div>
            ) : (
                <>
                    <ul className="hist-stats" aria-label="Tổng kết">
                        <li>
                            <span className="hist-stats__icon">
                                <Icon name="flag" size={20} />
                            </span>
                            <div>
                                <strong>{stats.attempts}</strong>
                                <span>lượt làm bài</span>
                            </div>
                        </li>
                        <li>
                            <span className="hist-stats__icon">
                                <Icon name="check-circle" size={20} />
                            </span>
                            <div>
                                <strong>{stats.passRate}%</strong>
                                <span>
                                    lượt đạt · {stats.lessons} bài đã qua
                                </span>
                            </div>
                        </li>
                        <li>
                            <span className="hist-stats__icon hist-stats__icon--clay">
                                <Icon name="star" size={20} />
                            </span>
                            <div>
                                <strong>{stats.average}%</strong>
                                <span>điểm trung bình</span>
                            </div>
                        </li>
                        <li>
                            <span className="hist-stats__icon hist-stats__icon--river">
                                <Icon name="clock" size={20} />
                            </span>
                            <div>
                                <strong>{stats.minutes}</strong>
                                <span>phút đã học</span>
                            </div>
                        </li>
                    </ul>

                    <div className="chips" role="tablist" aria-label="Lọc kết quả">
                        {FILTERS.map((f) => (
                            <button key={f.key} role="tab" aria-selected={filter === f.key} className="chip" onClick={() => setFilter(f.key)}>
                                {f.label} ({data.filter(f.test).length})
                            </button>
                        ))}
                    </div>

                    {groups.length === 0 ? (
                        <p className="muted hist__none">Không có lượt làm bài nào trong mục này.</p>
                    ) : (
                        groups.map(([day, list]) => (
                            <section key={day} className="panel hist-day" aria-label={dayLabel(day)}>
                                <h2 className="hist-day__title">{dayLabel(day)}</h2>
                                <ul className="history hist-day__list">
                                    {list.map((a) => (
                                        <li key={a.id}>
                                            <span className={`score-chip ${a.passed ? 'is-pass' : 'is-fail'}`}>{a.score}%</span>
                                            <Link to={`/bai-hoc/${a.lessonId}`} className="history__main">
                                                <strong>
                                                    Bài {a.lessonId}: {a.title}
                                                </strong>
                                                <small>
                                                    {a.passed ? 'Đạt' : 'Chưa đạt'}
                                                    {breakdown(a.parts) && ` · ${breakdown(a.parts)}`}
                                                    {duration(a.durationSec) && ` · ${duration(a.durationSec)}`}
                                                </small>
                                            </Link>
                                            <time dateTime={new Date(a.at).toISOString()}>{timeOf(a.at)}</time>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))
                    )}
                    {data.length >= 100 && <p className="muted small hist__none">Hiển thị 100 lượt làm bài gần nhất.</p>}
                </>
            )}
        </div>
    );
}
