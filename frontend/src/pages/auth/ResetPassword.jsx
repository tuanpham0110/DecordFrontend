import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, TextField } from '../../components/ui.jsx';
import { auth } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { FormAlert, PasswordMeter, validatePassword } from './shared.jsx';

export default function ResetPassword() {
    const navigate = useNavigate();
    const toast = useToast();
    const [pending] = useState(() => auth.pending());
    const [form, setForm] = useState({ password: '', confirm: '' });
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!pending?.verified) return <Navigate to="/quen-mat-khau" replace />;

    const set = (k) => (e) => {
        setForm((f) => ({ ...f, [k]: e.target.value }));
        if (errors[k]) setErrors((x) => ({ ...x, [k]: '' }));
    };

    async function onSubmit(e) {
        e.preventDefault();
        const next = {
            password: validatePassword(form.password),
            confirm: !form.confirm ? 'Vui lòng nhập lại mật khẩu mới.' : form.confirm !== form.password ? 'Mật khẩu nhập lại không khớp.' : '',
        };
        setErrors(next);
        if (next.password || next.confirm) return;
        setLoading(true);
        try {
            await auth.resetPassword({ password: form.password });
            toast('Đổi mật khẩu thành công. Mời bạn đăng nhập bằng mật khẩu mới.');
            navigate('/dang-nhap', { replace: true });
        } catch (err) {
            setFormError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <div className="auth-head">
                <h1>Tạo lại mật khẩu</h1>
                <p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
            </div>
            <form className="auth-form" onSubmit={onSubmit} noValidate>
                <FormAlert>{formError}</FormAlert>
                <TextField
                    label="Mật khẩu mới"
                    icon="lock"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={set('password')}
                    error={errors.password}
                    autoFocus
                />
                {!errors.password && <PasswordMeter value={form.password} />}
                <TextField
                    label="Xác nhận lại mật khẩu mới"
                    icon="lock"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={set('confirm')}
                    error={errors.confirm}
                />
                <Button type="submit" size="lg" block loading={loading}>
                    Đổi mật khẩu
                </Button>
            </form>
        </>
    );
}
