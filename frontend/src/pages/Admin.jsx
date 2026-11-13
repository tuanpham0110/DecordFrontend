import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button, EmptyState, ErrorState, Skeleton, TextField } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import Conversation from '../components/Conversation.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { admin } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import { WEEKDAY, formatWhen } from '../utils/format.js';

const TABS = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'users', label: 'Người dùng' },
    { key: 'support', label: 'Hỗ trợ' },
];
const PROVIDER = { email: 'Email', google: 'Google', microsoft: 'Microsoft' };
const dateOf = (ts) => new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dayOf = (key) => (key ? key.split('-').reverse().join('/') : '—');

function initials(name = '') {
    const parts = name.trim().split(/\s+/);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) || '?').toUpperCase();
}

/* ───────────── Overview ───────────── */
function Overview({ onOpenSupport }) {
    const { data, error, loading, reload } = useAsync(() => admin.overview(), []);
    if (error) return <ErrorState onRetry={reload}>{error.message}</ErrorState>;
    if (loading && !data) return <Skeleton h={260} r={18} />;
    const max = Math.max(1, ...data.week.map((d) => d.answered));
    const tiles = [
        { icon: 'user', value: data.users, label: 'tài khoản', sub: `+${data.newUsers} trong 7 ngày` },
        { icon: 'flame', value: data.activeToday, label: 'người học hôm nay', sub: 'có luyện ít nhất 1 câu', tone: 'clay' },
        { icon: 'flag', value: data.attempts, label: 'lượt làm bài', sub: data.passRate == null ? 'chưa có dữ liệu' : `${data.passRate}% đạt · ${data.lessonsPassed} bài đã qua` },
        { icon: 'mail', value: data.unreadMessages, label: 'tin nhắn chưa đọc', sub: 'từ người học', tone: 'river', action: onOpenSupport },
    ];
    return (
        <>
            <ul className="hist-stats adm-tiles">
                {tiles.map((t) => (
                    <li key={t.label} className={t.action && t.value > 0 ? 'is-alert' : ''}>
                        <span className={`hist-stats__icon ${t.tone ? `hist-stats__icon--${t.tone}` : ''}`}>
                            <Icon name={t.icon} size={20} />
                        </span>
                        <div>
                            <strong>{t.value}</strong>
                            <span>{t.label}</span>
                            <small>{t.sub}</small>
                        </div>
                        {t.action && t.value > 0 && (
                            <button type="button" className="more-link" onClick={t.action}>
                                Xem <Icon name="arrow-right" size={14} />
                            </button>
                        )}
                    </li>
                ))}
            </ul>
            <section className="panel adm-week">
                <div className="panel__head">
                    <h2 className="panel__title">Hoạt động 7 ngày qua</h2>
                    <span className="muted small">Số câu người học đã luyện mỗi ngày</span>
                </div>
                <div className="adm-week__chart">
                    {data.week.map((d) => (
                        <div key={d.day} className="adm-week__day" title={`${d.answered} câu · ${d.learners} người học`}>
                            <b>{d.answered}</b>
                            <span className="adm-week__bar">
                                <span style={{ height: `${Math.max(2, (d.answered / max) * 100)}%` }} />
                            </span>
                            <small>
                                {WEEKDAY[new Date(`${d.day}T00:00:00`).getDay()]} · {d.day.slice(8)}/{d.day.slice(5, 7)}
                            </small>
                            <em>{d.learners} người</em>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}

/* ───────────── Users ───────────── */
function Users({ onMessage }) {
    const { user: me } = useAuth();
    const toast = useToast();
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const { data, error, loading, reload } = useAsync(() => admin.users({ q: query, page }), [query, page]);
    const [busy, setBusy] = useState(null);
    const [toDelete, setToDelete] = useState(null);

    // search as you type, without a request per keystroke
    useEffect(() => {
        const t = setTimeout(() => {
            setQuery(q.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    async function setRole(u, role) {
        setBusy(u.id);
        try {
            await admin.setRole(u.id, role);
            toast(role === 'admin' ? `${u.name} đã là quản trị viên.` : `Đã gỡ quyền quản trị của ${u.name}.`);
            reload();
        } catch (e) {
            toast(e.message, { tone: 'error' });
        } finally {
            setBusy(null);
        }
    }

    async function remove() {
        const u = toDelete;
        setBusy(u.id);
        try {
            await admin.deleteUser(u.id);
            toast(`Đã xoá tài khoản ${u.email}.`, { tone: 'info' });
            setToDelete(null);
            reload();
        } catch (e) {
            toast(e.message, { tone: 'error' });
        } finally {
            setBusy(null);
        }
    }

    return (
        <section className="panel adm-users">
            <div className="adm-users__bar">
                <TextField className="field--search" label="Tìm theo tên hoặc email" icon="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
                {data && <span className="muted small">{data.total} tài khoản</span>}
            </div>
            {error ? (
                <ErrorState onRetry={reload}>{error.message}</ErrorState>
            ) : loading && !data ? (
                <div className="adm-users__loading">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} h={56} r={12} />
                    ))}
                </div>
            ) : data.users.length === 0 ? (
                <EmptyState title="Không tìm thấy tài khoản">Hãy thử từ khoá khác.</EmptyState>
            ) : (
                <>
                    <div className="adm-table" role="table" aria-label="Danh sách người dùng">
                        <div className="adm-table__row adm-table__row--head" role="row">
                            <span role="columnheader">Người dùng</span>
                            <span role="columnheader">Tham gia</span>
                            <span role="columnheader">Tiến độ</span>
                            <span role="columnheader">Hoạt động gần nhất</span>
                            <span role="columnheader" className="sr-only">
                                Thao tác
                            </span>
                        </div>
                        {data.users.map((u) => (
                            <div key={u.id} className="adm-table__row" role="row">
                                <span className="adm-user" role="cell">
                                    <span className="avatar">{initials(u.name)}</span>
                                    <span>
                                        <strong>
                                            {u.name}
                                            {u.role === 'admin' && <span className="tag tag--leaf tag--xs">Quản trị</span>}
                                            {u.id === me.id && <span className="tag tag--muted tag--xs">Bạn</span>}
                                        </strong>
                                        <small>
                                            {u.email} · {PROVIDER[u.provider]}
                                            {!u.verified && ' · chưa xác thực'}
                                        </small>
                                    </span>
                                </span>
                                <span role="cell" data-label="Tham gia">
                                    {dateOf(u.createdAt)}
                                </span>
                                <span role="cell" data-label="Tiến độ">
                                    {u.lessonsPassed} bài · {u.attempts} lượt
                                </span>
                                <span role="cell" data-label="Hoạt động">
                                    {dayOf(u.lastActiveDay)}
                                </span>
                                <span className="adm-table__actions" role="cell">
                                    <button className="icon-btn" title="Nhắn tin" aria-label={`Nhắn tin cho ${u.name}`} onClick={() => onMessage(u.id)} disabled={u.id === me.id}>
                                        <Icon name="mail" size={18} />
                                    </button>
                                    <button
                                        className="icon-btn"
                                        title={u.role === 'admin' ? 'Gỡ quyền quản trị' : 'Cấp quyền quản trị'}
                                        aria-label={u.role === 'admin' ? `Gỡ quyền quản trị của ${u.name}` : `Cấp quyền quản trị cho ${u.name}`}
                                        onClick={() => setRole(u, u.role === 'admin' ? 'user' : 'admin')}
                                        disabled={u.id === me.id || busy === u.id}
                                    >
                                        <Icon name={u.role === 'admin' ? 'star' : 'lock'} size={18} />
                                    </button>
                                    <button className="icon-btn" title="Xoá tài khoản" aria-label={`Xoá tài khoản ${u.name}`} onClick={() => setToDelete(u)} disabled={u.id === me.id || u.role === 'admin' || busy === u.id}>
                                        <Icon name="trash" size={18} />
                                    </button>
                                </span>
                            </div>
                        ))}
                    </div>
                    {data.pages > 1 && (
                        <div className="adm-pager">
                            <Button variant="light" size="sm" iconLeft="arrow-left" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                                Trước
                            </Button>
                            <span className="muted small">
                                Trang {data.page}/{data.pages}
                            </span>
                            <Button variant="light" size="sm" iconRight="arrow-right" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                                Sau
                            </Button>
                        </div>
                    )}
                </>
            )}

            <Modal
                open={!!toDelete}
                onClose={() => busy == null && setToDelete(null)}
                title="Xoá tài khoản này?"
                footer={
                    <>
                        <Button variant="light" onClick={() => setToDelete(null)} disabled={busy != null}>
                            Huỷ
                        </Button>
                        <Button className="btn--danger-solid" onClick={remove} loading={busy != null}>
                            Xoá vĩnh viễn
                        </Button>
                    </>
                }
            >
                <p className="modal__lead">
                    Toàn bộ tiến độ, sổ tay và tin nhắn của <strong>{toDelete?.name}</strong> ({toDelete?.email}) sẽ bị xoá và không thể khôi phục.
                </p>
            </Modal>
        </section>
    );
}

/* ───────────── Support inbox ───────────── */
function Inbox({ openId, onOpen }) {
    const { data: threads, error, loading, reload } = useAsync(() => admin.threads(), []);
    const [thread, setThread] = useState(null);
    const [threadError, setThreadError] = useState('');

    useEffect(() => {
        const t = setInterval(() => document.visibilityState === 'visible' && reload(), 20000);
        return () => clearInterval(t);
    }, [reload]);

    useEffect(() => {
        if (!openId) return setThread(null);
        let alive = true;
        const load = () =>
            admin
                .thread(openId)
                .then((t) => alive && (setThread(t), setThreadError('')))
                .catch((e) => alive && setThreadError(e.message));
        setThread(null);
        load().then(reload);
        const t = setInterval(() => document.visibilityState === 'visible' && load(), 20000);
        return () => {
            alive = false;
            clearInterval(t);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openId]);

    async function send(body) {
        const m = await admin.reply(openId, body);
        setThread((t) => ({ ...t, messages: [...t.messages, m] }));
        reload();
    }

    if (error) return <ErrorState onRetry={reload}>{error.message}</ErrorState>;
    return (
        <div className={`adm-inbox ${openId ? 'has-open' : ''}`}>
            <section className="panel adm-inbox__list" aria-label="Các cuộc trò chuyện">
                {loading && !threads ? (
                    <div className="adm-users__loading">
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} h={60} r={12} />
                        ))}
                    </div>
                ) : threads.length === 0 ? (
                    <EmptyState title="Chưa có tin nhắn nào" art="/assets/mascot-cheer.webp">
                        Khi người học nhắn ở trang Hỗ trợ, cuộc trò chuyện sẽ hiện ở đây.
                    </EmptyState>
                ) : (
                    <ul>
                        {threads.map((t) => (
                            <li key={t.user.id}>
                                <button type="button" className={`adm-thread ${openId === t.user.id ? 'is-open' : ''} ${t.unread ? 'is-unread' : ''}`} onClick={() => onOpen(t.user.id)}>
                                    <span className="avatar">{initials(t.user.name)}</span>
                                    <span className="adm-thread__main">
                                        <strong>{t.user.name}</strong>
                                        <small>
                                            {t.lastFromAdmin && 'Bạn: '}
                                            {t.preview}
                                        </small>
                                    </span>
                                    <span className="adm-thread__meta">
                                        <time>{formatWhen(t.lastAt)}</time>
                                        {t.unread > 0 && <b>{t.unread}</b>}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <section className="panel adm-inbox__thread" aria-label="Nội dung cuộc trò chuyện">
                {!openId ? (
                    <EmptyState title="Chọn một cuộc trò chuyện" art="/assets/mascot-point.webp">
                        Tin nhắn chưa đọc được xếp lên đầu danh sách.
                    </EmptyState>
                ) : threadError ? (
                    <ErrorState>{threadError}</ErrorState>
                ) : !thread ? (
                    <div className="support__loading">
                        <Skeleton h={48} r={14} w="60%" />
                        <Skeleton h={48} r={14} w="45%" style={{ marginLeft: 'auto' }} />
                    </div>
                ) : (
                    <>
                        <header className="support__head">
                            <button type="button" className="icon-btn adm-inbox__back" onClick={() => onOpen(null)} aria-label="Quay lại danh sách">
                                <Icon name="arrow-left" size={18} />
                            </button>
                            <span className="avatar">{initials(thread.user.name)}</span>
                            <div>
                                <strong>{thread.user.name}</strong>
                                <span>
                                    {thread.user.email} · tham gia {dateOf(thread.user.createdAt)}
                                </span>
                            </div>
                        </header>
                        <Conversation
                            messages={thread.messages}
                            mine={(m) => m.fromAdmin}
                            onSend={send}
                            otherLabel={thread.user.name}
                            placeholder="Nhập câu trả lời…"
                            empty={<p>Chưa có tin nhắn nào. Bạn có thể nhắn trước cho người học này.</p>}
                        />
                    </>
                )}
            </section>
        </div>
    );
}

export default function Admin() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    if (user?.role !== 'admin') return <Navigate to="/tong-quan" replace />;

    const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'overview';
    const go = (key, extra = {}) => setParams(key === 'overview' ? extra : { tab: key, ...extra });

    return (
        <div className="admin">
            <header className="page-head">
                <div>
                    <h1>Quản trị</h1>
                    <p>Theo dõi hoạt động, quản lý tài khoản và trả lời người học.</p>
                </div>
                <div className="segmented" role="tablist" aria-label="Khu vực quản trị">
                    {TABS.map((t) => (
                        <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </header>
            {tab === 'overview' && <Overview onOpenSupport={() => go('support')} />}
            {tab === 'users' && <Users onMessage={(id) => go('support', { user: id })} />}
            {tab === 'support' && <Inbox openId={params.get('user')} onOpen={(id) => go('support', id ? { user: id } : {})} />}
        </div>
    );
}
