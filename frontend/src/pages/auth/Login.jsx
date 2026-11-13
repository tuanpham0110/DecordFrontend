import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Checkbox, TextField } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { FormAlert, SocialLogin, isEmail } from './shared.jsx';

export default function Login() {
    const { login } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const [form, setForm] = useState({ email: '', password: '', remember: true });
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [loading, setLoading] = useState(false);

    const set = (k) => (e) => {
        const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm((f) => ({ ...f, [k]: v }));
        if (errors[k]) setErrors((x) => ({ ...x, [k]: '' }));
    };

    async function onSubmit(e) {
        e.preventDefault();
        const next = {
            email: !form.email ? 'Vui lòng nhập email.' : !isEmail(form.email) ? 'Email chưa đúng định dạng.' : '',
            password: !form.password ? 'Vui lòng nhập mật khẩu.' : '',
        };
        setErrors(next);
        setFormError('');
        if (next.email || next.password) return;

        setLoading(true);
        try {
            const user = await login(form);
            toast(`Chào mừng ${user.name} quay lại!`);
            navigate(location.state?.from || '/tong-quan', { replace: true });
        } catch (err) {
            if (err.field === 'unverified') {
                navigate('/xac-thuc');
                return;
            }
            setFormError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <div className="auth-head">
                <h1>Đăng nhập</h1>
                <p>Tiếp tục hành trình học tiếng Mường của bạn.</p>
            </div>
            <form className="auth-form" onSubmit={onSubmit} noValidate>
                {location.state?.from && !formError && (
                    <FormAlert tone="info">
                        {location.state.verified
                            ? 'Tài khoản đã được xác thực. Đăng nhập để tiếp tục nơi bạn đang xem.'
                            : 'Nội dung này dành cho thành viên. Hãy đăng nhập hoặc tạo tài khoản miễn phí – bạn sẽ quay lại đúng trang đang xem.'}
                    </FormAlert>
                )}
                <FormAlert>{formError}</FormAlert>
                <TextField
                    label="Email"
                    icon="mail"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={set('email')}
                    error={errors.email}
                    autoFocus
                />
                <TextField
                    label="Mật khẩu"
                    icon="lock"
                    type="password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={set('password')}
                    error={errors.password}
                />
                <div className="auth-row">
                    <Checkbox checked={form.remember} onChange={set('remember')}>
                        Ghi nhớ đăng nhập
                    </Checkbox>
                    <Link to="/quen-mat-khau" className="link">
                        Quên mật khẩu?
                    </Link>
                </div>
                <Button type="submit" size="lg" block loading={loading}>
                    Đăng nhập
                </Button>
                <div className="divider">Hoặc đăng nhập bằng</div>
                <SocialLogin />
            </form>
            <p className="auth-foot">
                Chưa có tài khoản?{' '}
                <Link to="/dang-ky" state={{ from: location.state?.from }} className="link">
                    Đăng ký ngay
                </Link>
            </p>
            {import.meta.env.DEV && (
                <p className="auth-demo">
                    Tài khoản dùng thử: <code>demo@muonglab.vn</code> / <code>muonglab123</code>
                </p>
            )}
        </>
    );
}
