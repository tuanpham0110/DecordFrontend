import { Link } from 'react-router-dom';
import { Button, ErrorState, Progress, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';

const ACTIVITY_ICON = { done: 'check-circle', start: 'play', badge: 'star' };

const SUGGESTIONS = [
    { to: '/on-luyen', icon: 'target', title: 'Ôn luyện từ vựng', text: 'Củng cố các từ đã học ở chặng 1.' },
    { to: '/so-tay', icon: 'notebook', title: 'Tra cứu sổ tay', text: 'Tìm nhanh nghĩa của từ Mường – Việt.' },
    { to: '/cam-nang', icon: 'guide', title: 'Đọc cẩm nang', text: 'Mẹo xưng hô và mẫu câu công vụ.' },
];

function greeting() {
    const h = new Date().getHours();
    if (h < 11) return 'Chào buổi sáng';
    if (h < 14) return 'Chào buổi trưa';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
}

function DashboardSkeleton() {
    return (
        <div className="dash" aria-busy="true" aria-label="Đang tải">
            <Skeleton h={220} r={24} />
            <Skeleton h={112} r={18} />
            <div className="dash__grid">
                <Skeleton h={240} r={18} />
                <Skeleton h={240} r={18} />
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const { data, error, loading, reload } = useAsync(() => learning.overview(), []);

    if (loading) return <DashboardSkeleton />;
    if (error) return <ErrorState onRetry={reload} />;

    const { current } = data;
    // Vietnamese given names are often compound ("Minh Anh"), so use the full display name.
    const firstName = user?.name?.trim() || 'bạn';

    return (
        <div className="dash">
            {/* Welcome */}
            <section className="welcome">
                <div className="welcome__copy">
                    <p className="welcome__hello">{greeting()},</p>
                    <h1>Chào mừng {firstName} trở lại</h1>
                    <p className="welcome__lead">
                        Cùng học tiếng Mường mỗi ngày để tiến bộ hơn nhé! Hành trình kết nối văn hoá truyền thống đang chờ bạn.
                    </p>
                    {current && (
                        <Button to={`/bai-hoc/${current.lesson.id}`} variant="leaf" iconRight="arrow-right">
                            {current.lesson.status === 'current' ? 'Học tiếp bài ' + current.lesson.id : 'Bắt đầu bài học mới'}
                        </Button>
                    )}
                </div>
                <img src="/assets/mascot-cheer.webp" alt="" className="welcome__mascot" />
            </section>

            {/* Stats strip */}
            <section className="stats" aria-label="Thống kê học tập">
                <div className="stat stat--wide">
                    <span className="icon-badge">
                        <Icon name="bars" size={22} strokeWidth={3} />
                    </span>
                    <div className="stat__body">
                        <span className="stat__label">Tiến độ học tập</span>
                        <strong className="stat__value">{data.percent}%</strong>
                        <div className="stat__progress">
                            <Progress value={data.percent} label="Tiến độ toàn khoá" />
                            <span>
                                {data.completed}/{data.total} bài
                            </span>
                        </div>
                    </div>
                </div>
                <div className="stat">
                    <span className="icon-badge icon-badge--warm">
                        <Icon name="flame" size={22} />
                    </span>
                    <div className="stat__body">
                        <span className="stat__label">Chuỗi học tập</span>
                        <strong className="stat__value">
                            {data.streakDays} <small>ngày</small>
                        </strong>
                    </div>
                </div>
                <div className="stat">
                    <span className="icon-badge">
                        <Icon name="book" size={22} />
                    </span>
                    <div className="stat__body">
                        <span className="stat__label">Bài đã hoàn thành</span>
                        <strong className="stat__value">
                            {data.completed} <small>bài</small>
                        </strong>
                    </div>
                </div>
                <div className="stat">
                    <span className="icon-badge icon-badge--warm">
                        <Icon name="star" size={22} />
                    </span>
                    <div className="stat__body">
                        <span className="stat__label">Điểm trung bình</span>
                        <strong className="stat__value">
                            {data.averageScore}
                            <small>%</small>
                        </strong>
                    </div>
                </div>
            </section>

            <div className="dash__grid">
                {/* Continue */}
                <section className="panel continue">
                    <div className="panel__head">
                        <h2 className="panel__title">Tiếp tục bài học</h2>
                        <Link to="/bai-hoc" className="more-link">
                            Xem lộ trình <Icon name="arrow-right" size={16} />
                        </Link>
                    </div>
                    <div className="panel__body">
                        {current ? (
                            <Link to={`/bai-hoc/${current.lesson.id}`} className="lesson-card">
                                <img src="/assets/lesson-greeting.webp" alt="" className="lesson-card__thumb" />
                                <div className="lesson-card__body">
                                    <span className={`tag ${current.stage.tone === 'clay' ? '' : `tag--${current.stage.tone}`}`}>
                                        Chặng {current.stage.id}: {current.stage.title}
                                    </span>
                                    <h3>
                                        Bài {current.lesson.id}: {current.lesson.title}
                                    </h3>
                                    <p className="lesson-card__meta">
                                        <Icon name="clock" size={15} /> Khoảng {current.lesson.minutes} phút
                                    </p>
                                    <span className="lesson-card__cta">
                                        Tiếp tục học <Icon name="arrow-right" size={16} />
                                    </span>
                                </div>
                            </Link>
                        ) : (
                            <p className="muted">Bạn đã hoàn thành toàn bộ hành trình. Tuyệt vời!</p>
                        )}
                    </div>
                </section>

                {/* Badges */}
                <section className="panel">
                    <div className="panel__head">
                        <h2 className="panel__title">Thành tích của bạn</h2>
                    </div>
                    <div className="panel__body badges">
                        {data.badges.map((b) => (
                            <div key={b.id} className={`badge ${b.earned ? '' : 'is-locked'}`}>
                                <span className="badge__medal">
                                    <Icon name={b.earned ? b.icon : 'lock-small'} size={24} />
                                </span>
                                <strong>{b.title}</strong>
                                <span>{b.desc}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Activity */}
                <section className="panel">
                    <div className="panel__head">
                        <h2 className="panel__title">Hoạt động gần đây</h2>
                    </div>
                    <ul className="activity panel__body">
                        {data.activity.map((a) => (
                            <li key={a.id} className={`activity__item activity__item--${a.type}`}>
                                <Icon name={ACTIVITY_ICON[a.type]} size={18} />
                                <span className="activity__text">{a.text}</span>
                                <time className="activity__time">{a.at}</time>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Suggestions */}
                <section className="panel">
                    <div className="panel__head">
                        <h2 className="panel__title">Gợi ý cho bạn</h2>
                    </div>
                    <div className="panel__body suggest">
                        {SUGGESTIONS.map((s) => (
                            <Link key={s.to} to={s.to} className="suggest__item">
                                <span className="suggest__icon">
                                    <Icon name={s.icon} size={20} />
                                </span>
                                <span className="suggest__text">
                                    <strong>{s.title}</strong>
                                    <span>{s.text}</span>
                                </span>
                                <Icon name="chevron-right" size={18} className="suggest__chev" />
                            </Link>
                        ))}
                    </div>
                </section>
            </div>

            <section className="keep-going">
                <div>
                    <h2>
                        Tiếp tục duy trì,
                        <br />
                        bạn đang tiến bộ rất tốt!
                    </h2>
                    <p>Còn {data.total - data.completed} bài nữa là hoàn thành hành trình.</p>
                </div>
                <Button to="/on-luyen" iconRight="arrow-right">
                    Ôn luyện ngay
                </Button>
            </section>
        </div>
    );
}
