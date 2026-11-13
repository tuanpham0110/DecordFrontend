import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Button, ErrorState, Progress, Ring, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import { useToast } from '../context/ToastContext.jsx';
import { resumeLabel } from '../utils/learning.js';

const ACTION = {
    done: 'Ôn lại',
    active: 'Tiếp tục học',
    soon: 'Xem chặng',
};

function stageCta(s) {
    if (s.status === 'done') return { text: `Ôn lại chặng ${s.id}`, variant: 'green' };
    if (s.status === 'active') return { text: `Tiếp tục chặng ${s.id}`, variant: 'clay' };
    return { text: `Khám phá chặng ${s.id}`, variant: 'outline' };
}

/** Lock button shown on a stage that is not open yet. Server is the source of truth. */
export function StageLockButton({ stage, size = 'sm' }) {
    const toast = useToast();
    return (
        <button
            type="button"
            className={`lock-btn lock-btn--${size}`}
            onClick={() => toast(stage.lockReason || 'Chặng này chưa được mở khoá.', { tone: 'lock' })}
            aria-label={`Chặng ${stage.id} đang khoá. ${stage.lockReason ?? ''}`}
            title={stage.lockReason ?? undefined}
        >
            <span className="lock-btn__icon">
                <Icon name="lock" size={size === 'sm' ? 14 : 16} />
            </span>
            Đang khoá
        </button>
    );
}

/** Visual "gate" between two stages on the overview list. */
function StageGate({ from, to }) {
    const open = to.unlocked;
    const pct = from.published ? Math.round((from.lessons.filter((l) => l.status === 'done').length / from.published) * 100) : 0;
    return (
        <li className={`sgate ${open ? 'is-open' : 'is-locked'}`} aria-label={open ? `Đã mở khoá chặng ${to.id}` : `Chặng ${to.id} đang khoá`}>
            <span className="sgate__line" aria-hidden="true">
                <span style={{ height: `${open ? 100 : pct}%` }} />
            </span>
            <span className="sgate__knot" aria-hidden="true">
                <Icon name={open ? 'check' : 'lock'} size={14} strokeWidth={open ? 3 : 2} />
            </span>
            <span className="sgate__text">
                {open ? (
                    <>
                        <b>Đã qua cổng chặng {from.id}</b> · Chặng {to.id} đã mở
                    </>
                ) : (
                    <>
                        <b>Cổng chặng {to.id}</b> · {from.published ? `hoàn thành ${pct}% chặng ${from.id}, cần 100% để mở` : `chặng ${from.id} đang biên soạn`}
                    </>
                )}
            </span>
        </li>
    );
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
                    <p>{data ? `Đi qua ${data.stages.length} chặng, khám phá ${data.total} bài học` : ' '}</p>
                </div>
                <img className="journey__path" src="/assets/journey-path.webp" alt="" />
                <img className="journey__mascot" src="/assets/mascot-point.webp" alt="" />

                <ol className="journey__stops">
                    {(data?.stages.slice(0, 3) ?? [1, 2, 3].map((id) => ({ id, placeholder: true }))).map((s) =>
                        s.placeholder ? (
                            <li key={s.id} className={`stop stop--${s.id}`}>
                                <Skeleton h={130} r={16} />
                            </li>
                        ) : (
                            <li key={s.id} className={`stop stop--${s.id} stop--${s.tone} ${s.unlocked ? '' : 'is-locked'}`}>
                                {!s.unlocked && (
                                    <span className="stop__padlock" aria-hidden="true">
                                        <Icon name="lock" size={16} />
                                    </span>
                                )}
                                <span className="stop__label">Chặng {s.id}</span>
                                <strong className="stop__title">{s.title}</strong>
                                <span className="stop__meta">
                                    {!s.unlocked
                                        ? `Mở khi xong 100% chặng ${s.prevId}`
                                        : s.status === 'soon'
                                          ? `${s.plannedTotal ?? s.total} bài · đang biên soạn`
                                          : `${s.completed}/${s.total} bài hoàn thành`}
                                </span>
                                {s.unlocked ? (
                                    <Button to={`/bai-hoc/chang/${s.id}`} size="sm" variant={stageCta(s).variant} iconRight="arrow-right">
                                        {stageCta(s).text}
                                    </Button>
                                ) : (
                                    <StageLockButton stage={s} />
                                )}
                            </li>
                        )
                    )}
                </ol>
            </section>

            {data?.resume || data?.current ? (
                <Link to={`/hoc/${data.resume?.lessonId ?? data.current.lesson.id}`} className="resume-strip">
                    <span className="resume-strip__icon">
                        <Icon name="play" size={18} />
                    </span>
                    <span className="resume-strip__text">
                        <small>{data.resume ? resumeLabel(data.resume) : 'Bài tiếp theo'}</small>
                        <strong>
                            Bài {data.resume ? data.resume.lessonId : data.current.lesson.id}: {data.resume ? data.resume.title : data.current.lesson.title}
                        </strong>
                    </span>
                    <span className="resume-strip__cta">
                        {data.resume ? 'Học tiếp' : 'Bắt đầu'} <Icon name="arrow-right" size={16} />
                    </span>
                </Link>
            ) : null}

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
                        <p>{loading ? '…' : `${data.completed}/${data.total}`} bài đã hoàn thành</p>
                    </div>

                    <ol className="panel overview__list">
                        {loading
                            ? [0, 1, 2].map((i) => <Skeleton key={i} h={72} style={{ margin: '12px 0' }} />)
                            : data.stages.map((s, i) => (
                                  <Fragment key={s.id}>
                                      {i > 0 && <StageGate from={data.stages[i - 1]} to={s} />}
                                      <li className={`srow srow--${s.tone} ${s.unlocked ? '' : 'is-locked'}`}>
                                          <span className="srow__num">{s.unlocked ? s.code : <Icon name="lock" size={18} />}</span>
                                          <div className="srow__main">
                                              <h3>{s.title}</h3>
                                              <p>{s.unlocked ? `Chặng ${s.id}: ${s.completed}/${s.total} bài hoàn thành` : s.lockReason}</p>
                                              <div className="srow__bar">
                                                  <Progress value={s.percent} tone={s.tone} label={`Tiến độ chặng ${s.id}`} />
                                                  <span className="srow__pct">{s.percent}%</span>
                                                  {s.unlocked ? (
                                                      <Link to={`/bai-hoc/chang/${s.id}`} className="link srow__link">
                                                          {ACTION[s.status] ?? 'Xem chặng'}
                                                      </Link>
                                                  ) : (
                                                      <StageLockButton stage={s} />
                                                  )}
                                              </div>
                                          </div>
                                      </li>
                                  </Fragment>
                              ))}
                    </ol>
                </section>
            )}
        </div>
    );
}
