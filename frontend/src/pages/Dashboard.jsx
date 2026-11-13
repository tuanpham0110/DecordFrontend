import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ErrorState, Progress, Ring, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import GlobalSearch from '../components/GlobalSearch.jsx';
import { WEEKDAY, formatWhen } from '../utils/format.js';

const GOALS = [5, 10, 20, 30];
const PART_ICON = { listen: 'headphones', build: 'puzzle', shadow: 'mic' };

function greeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return 'Chào buổi sáng';
    if (h >= 11 && h < 14) return 'Chào buổi trưa';
    if (h >= 14 && h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối'; // 18:00 – 04:59
}

function DashboardSkeleton() {
    return (
        <div className="dash" aria-busy="true" aria-label="Đang tải">
            <div className="dash__top">
                <Skeleton h={260} r={24} />
                <Skeleton h={260} r={24} />
            </div>
            <div className="dash__grid">
                <Skeleton h={240} r={18} />
                <Skeleton h={240} r={18} />
            </div>
        </div>
    );
}

function pct(c, t) {
    return t ? Math.round((c / t) * 100) : null;
}

/* ── Continue card: exact resume point, or the next lesson ── */
function ContinueCard({ data, name }) {
    const { resume, current } = data;
    const fresh = data.completed === 0 && !resume && !data.recent.length;
    let body;
    if (resume) {
        body = {
            label: `Đang dừng ở câu ${resume.done + 1}/${resume.total} · ${resume.part}`,
            title: `Bài ${resume.lessonId}: ${resume.title}`,
            sub: `Chặng ${resume.stageId}: ${resume.stageTitle}`,
            to: `/hoc/${resume.lessonId}`,
            cta: 'Học tiếp',
            progress: (resume.done / resume.total) * 100,
        };
    } else if (current) {
        body = {
            label: fresh ? 'Bài học đầu tiên' : 'Bài học tiếp theo',
            title: `Bài ${current.lesson.id}: ${current.lesson.title}`,
            sub: `Chặng ${current.stage.id}: ${current.stage.title} · ${current.lesson.minutes} phút`,
            to: `/hoc/${current.lesson.id}`,
            cta: current.lesson.attempts ? 'Làm lại bài' : 'Bắt đầu học',
        };
    }

    return (
        <section className="welcome">
            <div className="welcome__copy">
                <p className="welcome__hello">{greeting()},</p>
                <h1>{fresh ? `Chào mừng ${name}!` : `${name}, học tiếp nhé`}</h1>
                {body ? (
                    <Link to={body.to} className="continue-card">
                        <img src="/assets/lesson-greeting.webp" alt="" />
                        <span className="continue-card__body">
                            <small>{body.label}</small>
                            <strong>{body.title}</strong>
                            <span>{body.sub}</span>
                            {body.progress != null && <Progress value={body.progress} tone="leaf" label="Tiến độ bài đang học" />}
                        </span>
                        <span className="continue-card__cta">
                            {body.cta} <Icon name="arrow-right" size={18} />
                        </span>
                    </Link>
                ) : (
                    <p className="welcome__lead">Bạn đã học hết các bài hiện có. Các bài mới đang được biên soạn – trong lúc chờ, hãy ôn lại kiến thức nhé.</p>
                )}
            </div>
            <img src="/assets/mascot-cheer.webp" alt="" className="welcome__mascot" />
        </section>
    );
}

/* ── Daily goal + streak ── */
function TodayCard({ stats, onGoal }) {
    const [editing, setEditing] = useState(false);
    const { today, streak, week } = stats;
    const value = Math.min(100, (today.answered / today.goal) * 100);
    const max = Math.max(today.goal, ...week.map((d) => d.answered), 1);
    return (
        <section className="today panel">
            <div className="panel__head">
                <h2 className="panel__title">Hôm nay</h2>
                <button className="link link--sm" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
                    {editing ? 'Xong' : 'Đổi mục tiêu'}
                </button>
            </div>
            {editing && (
                <div className="goal-pick" role="radiogroup" aria-label="Mục tiêu mỗi ngày">
                    {GOALS.map((g) => (
                        <button key={g} role="radio" aria-checked={today.goal === g} className="chip" onClick={() => onGoal(g)}>
                            {g} câu
                        </button>
                    ))}
                </div>
            )}
            <div className="today__body">
                <Ring value={value} size={112} stroke={12}>
                    <strong className="ring__num ring__num--sm">
                        {today.answered}
                        <small>/{today.goal}</small>
                    </strong>
                </Ring>
                <div className="today__facts">
                    <p>
                        {today.answered >= today.goal ? (
                            <strong className="ok">Đã đạt mục tiêu hôm nay!</strong>
                        ) : (
                            <>
                                Còn <strong>{today.goal - today.answered} câu</strong> để đạt mục tiêu ngày.
                            </>
                        )}
                    </p>
                    <p className="today__streak">
                        <Icon name="flame" size={18} />
                        <span>
                            <strong>{streak}</strong> ngày liên tiếp
                        </span>
                    </p>
                </div>
            </div>
            <div className="week" aria-label="Số câu đã luyện 7 ngày qua">
                {week.map((d) => (
                    <div key={d.day} className={`week__day ${d.answered >= today.goal ? 'is-met' : ''}`} title={`${d.answered} câu`}>
                        <span className="week__bar">
                            <span style={{ height: `${(d.answered / max) * 100}%` }} />
                        </span>
                        <small>{WEEKDAY[d.weekday]}</small>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const toast = useToast();
    const { data, error, loading, reload } = useAsync(() => learning.overview(), []);

    if (loading && !data) return <DashboardSkeleton />;
    if (error) return <ErrorState onRetry={reload}>{error.message}</ErrorState>;

    const name = user?.name?.trim() || 'bạn';
    const { stats, review } = data;
    const parts = [
        { key: 'listen', label: 'Luyện nghe', value: pct(stats.parts.listen.correct, stats.parts.listen.total), detail: `${stats.parts.listen.correct}/${stats.parts.listen.total} câu đúng lần đầu` },
        { key: 'build', label: 'Lắp ghép câu', value: pct(stats.parts.build.correct, stats.parts.build.total), detail: `${stats.parts.build.correct}/${stats.parts.build.total} câu đúng lần đầu` },
        { key: 'shadow', label: 'Luyện nói', value: pct(stats.parts.shadow.practiced, stats.parts.shadow.total), detail: `${stats.parts.shadow.practiced} câu đã thực hành` },
    ];

    async function setGoal(g) {
        try {
            await learning.setGoal(g);
            toast(`Mục tiêu mới: ${g} câu mỗi ngày`);
            reload();
        } catch (e) {
            toast(e.message, { tone: 'error' });
        }
    }

    return (
        <div className="dash">
            <GlobalSearch stages={data.stages} />
            <div className="dash__top">
                <ContinueCard data={data} name={name} />
                <TodayCard stats={stats} onGoal={setGoal} />
            </div>

            <div className="dash__grid">
                {/* Journey */}
                <section className="panel journey-mini">
                    <div className="panel__head">
                        <h2 className="panel__title">Hành trình của tôi</h2>
                        <Link to="/bai-hoc" className="more-link">
                            Xem lộ trình <Icon name="arrow-right" size={16} />
                        </Link>
                    </div>
                    <div className="panel__body journey-mini__body">
                        <div className="journey-mini__ring">
                            <Ring value={data.percent} size={120} stroke={13}>
                                <strong className="ring__num ring__num--sm">{data.percent}%</strong>
                            </Ring>
                            <span>
                                {data.completed}/{data.total} bài
                            </span>
                        </div>
                        <ul className="journey-mini__stages">
                            {data.stages.map((s) => (
                                <li key={s.id} className={`jm jm--${s.tone}`}>
                                    <Link to={`/bai-hoc/chang/${s.id}`}>
                                        <span className="jm__num">{s.code}</span>
                                        <span className="jm__main">
                                            <strong>{s.title}</strong>
                                            <Progress value={s.percent} tone={s.tone} label={`Tiến độ chặng ${s.id}`} />
                                        </span>
                                        <span className="jm__count">
                                            {!s.unlocked ? <Icon name="lock" size={16} aria-label="Đang khoá" /> : s.status === 'soon' ? 'Sắp có' : `${s.completed}/${s.total}`}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Review */}
                <section className="panel review-mini">
                    <div className="panel__head">
                        <h2 className="panel__title">Cần ôn tập</h2>
                        {review.total > 0 && (
                            <Link to="/on-luyen" className="more-link">
                                Tất cả <Icon name="arrow-right" size={16} />
                            </Link>
                        )}
                    </div>
                    <div className="panel__body">
                        {review.total === 0 ? (
                            <div className="mini-empty">
                                <Icon name="check-circle" size={22} />
                                <p>{review.mastered ? `Tuyệt! Bạn đã thuộc ${review.mastered} câu từng làm sai.` : 'Chưa có câu nào cần ôn. Các câu bạn làm sai sẽ tự xuất hiện ở đây.'}</p>
                            </div>
                        ) : (
                            <>
                                <p className="review-mini__count">
                                    <strong>{review.due}</strong> câu đến hạn ôn{review.total > review.due ? ` · ${review.total - review.due} câu ôn sau` : ''}
                                </p>
                                <ul className="review-mini__list">
                                    {review.top.map((r) => (
                                        <li key={r.itemId}>
                                            <Icon name={PART_ICON[r.part]} size={16} />
                                            <span>{r.label}</span>
                                            <small>Sai {r.wrong} lần</small>
                                        </li>
                                    ))}
                                </ul>
                                {review.due ? (
                                    <Button to="/on-luyen/phien" variant="green" size="sm" iconRight="arrow-right">
                                        Ôn ngay
                                    </Button>
                                ) : (
                                    <p className="muted small">Các câu còn lại chưa đến hạn – hãy quay lại sau.</p>
                                )}
                            </>
                        )}
                    </div>
                </section>

                {/* Skills */}
                <section className="panel">
                    <div className="panel__head">
                        <h2 className="panel__title">Kết quả luyện tập</h2>
                        {stats.averageScore != null && <span className="muted small">Điểm TB các bài: {stats.averageScore}%</span>}
                    </div>
                    <ul className="skills panel__body">
                        {parts.map((p) => (
                            <li key={p.key}>
                                <span className="skills__icon">
                                    <Icon name={PART_ICON[p.key]} size={20} />
                                </span>
                                <span className="skills__main">
                                    <span className="skills__row">
                                        <strong>{p.label}</strong>
                                        <b>{p.value == null ? '—' : `${p.value}%`}</b>
                                    </span>
                                    <Progress value={p.value ?? 0} tone="leaf" label={p.label} />
                                    <small>{p.value == null ? 'Chưa có dữ liệu' : p.detail}</small>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Activity */}
                <section className="panel">
                    <div className="panel__head">
                        <h2 className="panel__title">Hoạt động gần đây</h2>
                        {data.recent.length > 0 && (
                            <Link to="/lich-su" className="more-link">
                                Lịch sử học <Icon name="arrow-right" size={16} />
                            </Link>
                        )}
                    </div>
                    {data.recent.length ? (
                        <ul className="history panel__body">
                            {data.recent.map((a) => (
                                <li key={a.id}>
                                    <span className={`score-chip ${a.passed ? 'is-pass' : 'is-fail'}`}>{a.score}%</span>
                                    <Link to={`/bai-hoc/${a.lessonId}`} className="history__main">
                                        <strong>
                                            Bài {a.lessonId}: {a.title}
                                        </strong>
                                        <small>{a.passed ? 'Hoàn thành' : 'Chưa đạt – cần ôn lại'}</small>
                                    </Link>
                                    <time>{formatWhen(a.at)}</time>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="panel__body mini-empty">
                            <Icon name="calendar" size={22} />
                            <p>Kết quả các bài bạn học sẽ hiện ở đây.</p>
                        </div>
                    )}
                </section>
            </div>

            <section className="badges-strip" aria-label="Huy hiệu">
                <h2>Huy hiệu</h2>
                <ul>
                    {data.badges.map((b) => (
                        <li key={b.id} className={`badge ${b.earned ? '' : 'is-locked'}`} title={b.desc}>
                            <span className="badge__medal">
                                <Icon name={b.earned ? b.icon : 'lock-small'} size={20} />
                            </span>
                            <span>
                                <strong>{b.title}</strong>
                                <small>{b.desc}</small>
                            </span>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
