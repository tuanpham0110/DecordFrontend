import { useEffect, useState } from 'react';
import { Button, ErrorState, Skeleton, TextField } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { auth, learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import { FormAlert, PasswordMeter, validatePassword } from './auth/shared.jsx';

const GOALS = [
    { value: 5, label: '5 câu', note: 'Nhẹ nhàng' },
    { value: 10, label: '10 câu', note: 'Đều đặn' },
    { value: 20, label: '20 câu', note: 'Chăm chỉ' },
    { value: 30, label: '30 câu', note: 'Bứt tốc' },
];

function initials(name = '') {
    const parts = name.trim().split(/\s+/);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) || '?').toUpperCase();
}

const joined = (ts) => new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/* ───────────── Profile ───────────── */
function ProfileCard({ me }) {
    const { user, updateProfile } = useAuth();
    const toast = useToast();
    const [name, setName] = useState(user?.name ?? me.name);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const dirty = name.trim() !== (user?.name ?? '').trim();

    async function onSubmit(e) {
        e.preventDefault();
        const clean = name.trim();
        if (clean.length < 2) return setError('Họ và tên cần ít nhất 2 ký tự.');
        if (clean.length > 80) return setError('Họ và tên quá dài.');
        setSaving(true);
        try {
            await updateProfile({ name: clean });
            setName(clean);
            toast('Đã cập nhật họ và tên.');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="panel acct-card" aria-labelledby="acct-profile">
            <header className="acct-card__head">
                <span className="acct-card__icon">
                    <Icon name="user" size={20} />
                </span>
                <div>
                    <h2 id="acct-profile">Hồ sơ</h2>
                    <p>Tên này hiện trong lời chào và kết quả học của bạn.</p>
                </div>
            </header>
            <form className="acct-form" onSubmit={onSubmit} noValidate>
                <div className="acct-id">
                    <span className="avatar avatar--lg" aria-hidden="true">
                        {initials(name || user?.name)}
                    </span>
                    <div>
                        <strong>{user?.email}</strong>
                        <span>
                            Tham gia từ {joined(me.createdAt)}
                            {me.google && ' · Đã liên kết Google'}
                        </span>
                    </div>
                </div>
                <div className="acct-label">
                    <span>Họ và tên</span>
                    <TextField
                        label="Họ và tên"
                        icon="user"
                        autoComplete="name"
                        value={name}
                        maxLength={80}
                        onChange={(e) => {
                            setName(e.target.value);
                            setError('');
                        }}
                        error={error}
                    />
                </div>
                <div className="acct-label">
                    <span>Email đăng nhập</span>
                    <TextField label="Email" icon="mail" type="email" value={user?.email ?? ''} disabled readOnly hint="Email dùng để đăng nhập và không thay đổi được." />
                </div>
                <div className="acct-actions">
                    <Button type="submit" variant="green" loading={saving} disabled={!dirty}>
                        Lưu thay đổi
                    </Button>
                </div>
            </form>
        </section>
    );
}

/* ───────────── Daily goal ───────────── */
function GoalCard({ initial }) {
    const toast = useToast();
    const [goal, setGoal] = useState(initial);
    const [busy, setBusy] = useState(null);

    async function pick(value) {
        if (value === goal || busy) return;
        setBusy(value);
        try {
            setGoal(await learning.setGoal(value));
            toast(`Mục tiêu mới: ${value} câu mỗi ngày`);
        } catch (err) {
            toast(err.message, { tone: 'error' });
        } finally {
            setBusy(null);
        }
    }

    return (
        <section className="panel acct-card" aria-labelledby="acct-goal">
            <header className="acct-card__head">
                <span className="acct-card__icon acct-card__icon--clay">
                    <Icon name="target" size={20} />
                </span>
                <div>
                    <h2 id="acct-goal">Mục tiêu mỗi ngày</h2>
                    <p>Số câu bạn muốn luyện mỗi ngày. Đạt mục tiêu liên tục để giữ chuỗi ngày học.</p>
                </div>
            </header>
            <div className="acct-goals" role="radiogroup" aria-label="Mục tiêu mỗi ngày">
                {GOALS.map((g) => (
                    <button key={g.value} type="button" role="radio" aria-checked={goal === g.value} className="acct-goal" disabled={busy != null} onClick={() => pick(g.value)}>
                        <strong>{g.label}</strong>
                        <span>{g.note}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}

/* ───────────── Password ───────────── */
function PasswordCard({ hasPassword, onChanged }) {
    const { changePassword } = useAuth();
    const toast = useToast();
    const empty = { currentPassword: '', newPassword: '', confirm: '' };
    const [form, setForm] = useState(empty);
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const set = (k) => (e) => {
        setForm((f) => ({ ...f, [k]: e.target.value }));
        if (errors[k]) setErrors((x) => ({ ...x, [k]: '' }));
        setFormError('');
    };

    async function onSubmit(e) {
        e.preventDefault();
        const next = {
            currentPassword: hasPassword && !form.currentPassword ? 'Vui lòng nhập mật khẩu hiện tại.' : '',
            newPassword: validatePassword(form.newPassword) || (hasPassword && form.newPassword === form.currentPassword ? 'Mật khẩu mới cần khác mật khẩu hiện tại.' : ''),
            confirm: !form.confirm ? 'Vui lòng nhập lại mật khẩu mới.' : form.confirm !== form.newPassword ? 'Mật khẩu nhập lại không khớp.' : '',
        };
        setErrors(next);
        if (Object.values(next).some(Boolean)) return;
        setSaving(true);
        try {
            await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
            setForm(empty);
            toast(hasPassword ? 'Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.' : 'Đã tạo mật khẩu cho tài khoản.');
            onChanged();
        } catch (err) {
            if (err.field && err.field in next) setErrors((x) => ({ ...x, [err.field]: err.message }));
            else setFormError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="panel acct-card" aria-labelledby="acct-password">
            <header className="acct-card__head">
                <span className="acct-card__icon">
                    <Icon name="lock" size={20} />
                </span>
                <div>
                    <h2 id="acct-password">{hasPassword ? 'Đổi mật khẩu' : 'Tạo mật khẩu'}</h2>
                    <p>
                        {hasPassword
                            ? 'Sau khi đổi, các thiết bị khác đang đăng nhập tài khoản này sẽ phải đăng nhập lại.'
                            : 'Tài khoản đang đăng nhập bằng Google. Tạo mật khẩu để có thể đăng nhập bằng email.'}
                    </p>
                </div>
            </header>
            <form className="acct-form" onSubmit={onSubmit} noValidate>
                <FormAlert>{formError}</FormAlert>
                {hasPassword && (
                    <div className="acct-label">
                        <span>Mật khẩu hiện tại</span>
                        <TextField label="Mật khẩu hiện tại" icon="lock" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} />
                    </div>
                )}
                <div className="acct-label">
                    <span>Mật khẩu mới</span>
                    <TextField
                        label="Mật khẩu mới"
                        icon="lock"
                        type="password"
                        autoComplete="new-password"
                        value={form.newPassword}
                        onChange={set('newPassword')}
                        error={errors.newPassword}
                        hint="Tối thiểu 8 ký tự, có cả chữ cái và chữ số."
                    />
                </div>
                {!errors.newPassword && <PasswordMeter value={form.newPassword} />}
                <div className="acct-label">
                    <span>Nhập lại mật khẩu mới</span>
                    <TextField label="Nhập lại mật khẩu mới" icon="lock" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
                </div>
                <div className="acct-actions">
                    <Button type="submit" variant="green" loading={saving} disabled={!form.newPassword}>
                        {hasPassword ? 'Đổi mật khẩu' : 'Tạo mật khẩu'}
                    </Button>
                </div>
            </form>
        </section>
    );
}

/* ───────────── Sign out / delete ───────────── */
function DangerCard({ me }) {
    const { user, logout, deleteAccount } = useAuth();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setValue('');
            setError('');
        }
    }, [open]);

    async function onDelete(e) {
        e.preventDefault();
        if (!value) return setError(me.hasPassword ? 'Vui lòng nhập mật khẩu để xác nhận.' : 'Vui lòng nhập email để xác nhận.');
        setBusy(true);
        try {
            await deleteAccount(me.hasPassword ? { password: value } : { confirmEmail: value });
            toast('Tài khoản và toàn bộ dữ liệu học đã được xoá.', { tone: 'info' });
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <section className="panel acct-card acct-card--danger" aria-labelledby="acct-danger">
            <header className="acct-card__head">
                <span className="acct-card__icon acct-card__icon--danger">
                    <Icon name="alert" size={20} />
                </span>
                <div>
                    <h2 id="acct-danger">Phiên đăng nhập & dữ liệu</h2>
                    <p>Đăng xuất khỏi thiết bị này, hoặc xoá vĩnh viễn tài khoản cùng toàn bộ tiến độ học.</p>
                </div>
            </header>
            <div className="acct-rows">
                <div className="acct-row">
                    <div>
                        <strong>Đăng xuất</strong>
                        <span>Tiến độ học vẫn được giữ nguyên cho lần đăng nhập sau.</span>
                    </div>
                    <Button variant="light" iconLeft="logout" onClick={logout}>
                        Đăng xuất
                    </Button>
                </div>
                <div className="acct-row">
                    <div>
                        <strong>Xoá tài khoản</strong>
                        <span>Xoá hồ sơ, kết quả bài học, danh sách ôn tập và sổ tay. Không thể khôi phục.</span>
                    </div>
                    <Button variant="light" className="btn--danger" iconLeft="trash" onClick={() => setOpen(true)}>
                        Xoá tài khoản
                    </Button>
                </div>
            </div>

            <Modal
                open={open}
                onClose={() => !busy && setOpen(false)}
                title="Xoá tài khoản vĩnh viễn?"
                footer={
                    <>
                        <Button variant="light" onClick={() => setOpen(false)} disabled={busy}>
                            Giữ tài khoản
                        </Button>
                        <Button type="submit" form="acct-delete" className="btn--danger-solid" loading={busy}>
                            Xoá vĩnh viễn
                        </Button>
                    </>
                }
            >
                <form id="acct-delete" className="acct-form acct-form--modal" onSubmit={onDelete} noValidate>
                    <p className="modal__lead">
                        Toàn bộ tiến độ, kết quả bài học, câu ôn tập và sổ tay của <strong>{user?.email}</strong> sẽ bị xoá và không thể khôi phục.
                    </p>
                    <div className="acct-label">
                        <span>{me.hasPassword ? 'Nhập mật khẩu để xác nhận' : `Nhập email ${user?.email} để xác nhận`}</span>
                        <TextField
                            label={me.hasPassword ? 'Mật khẩu' : 'Email'}
                            icon={me.hasPassword ? 'lock' : 'mail'}
                            type={me.hasPassword ? 'password' : 'email'}
                            autoComplete={me.hasPassword ? 'current-password' : 'off'}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                setError('');
                            }}
                            error={error}
                            autoFocus
                        />
                    </div>
                </form>
            </Modal>
        </section>
    );
}

export default function Account() {
    const { data: me, error, loading, reload } = useAsync(() => auth.me(), []);

    return (
        <div className="account">
            <header className="page-head">
                <div>
                    <h1>Tài khoản</h1>
                    <p>Quản lý hồ sơ, mục tiêu học và bảo mật tài khoản của bạn.</p>
                </div>
            </header>
            {error ? (
                <ErrorState onRetry={reload}>{error.message}</ErrorState>
            ) : loading && !me ? (
                <div className="account__grid" aria-busy="true">
                    <Skeleton h={320} r={18} />
                    <Skeleton h={320} r={18} />
                </div>
            ) : (
                <div className="account__grid">
                    <div className="account__col">
                        <ProfileCard me={me} />
                        <GoalCard initial={me.dailyGoal} />
                    </div>
                    <div className="account__col">
                        <PasswordCard hasPassword={me.hasPassword} onChanged={reload} />
                        <DangerCard me={me} />
                    </div>
                </div>
            )}
        </div>
    );
}
