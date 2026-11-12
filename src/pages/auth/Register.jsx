import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Checkbox, TextField } from '../../components/ui.jsx';
import { auth } from '../../services/api.js';
import { FormAlert, SocialLogin, isEmail, validatePassword } from './shared.jsx';

export default function Register() {
    const navigate = useNavigate();
    const location = useLocation();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', agree: false });
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
            name: form.name.trim().length < 2 ? 'Vui lòng nhập họ và tên.' : '',
            email: !form.email ? 'Vui lòng nhập email.' : !isEmail(form.email) ? 'Email chưa đúng định dạng.' : '',
            password: validatePassword(form.password),
            confirm: !form.confirm ? 'Vui lòng nhập lại mật khẩu.' : form.confirm !== form.password ? 'Mật khẩu nhập lại không khớp.' : '',
            agree: form.agree ? '' : 'Bạn cần đồng ý với điều khoản để tiếp tục.',
        };
        setErrors(next);
        setFormError('');
        if (Object.values(next).some(Boolean)) return;

        setLoading(true);
        try {
            await auth.register(form);
            navigate('/xac-thuc', { state: { from: location.state?.from } });
        } catch (err) {
            if (err.field) setErrors((x) => ({ ...x, [err.field]: err.message }));
            else setFormError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <div className="auth-head">
                <h1>Đăng ký</h1>
                <p>Tạo tài khoản miễn phí để lưu tiến độ học.</p>
            </div>
            <form className="auth-form" onSubmit={onSubmit} noValidate>
                <FormAlert>{formError}</FormAlert>
                <TextField label="Họ và tên" icon="user" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} autoFocus />
                <TextField label="Email" icon="mail" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
                <TextField
                    label="Mật khẩu"
                    icon="lock"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={set('password')}
                    error={errors.password}
                    hint="Tối thiểu 8 ký tự."
                />
                <TextField
                    label="Xác nhận mật khẩu"
                    icon="lock"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={set('confirm')}
                    error={errors.confirm}
                />
                <div className="auth-row auth-row--stack">
                    <Checkbox checked={form.agree} onChange={set('agree')} error={errors.agree}>
                        Tôi đồng ý với{' '}
                        <a href="#dieu-khoan" className="link">
                            Điều khoản sử dụng
                        </a>{' '}
                        và{' '}
                        <a href="#bao-mat" className="link">
                            Chính sách bảo mật
                        </a>
                    </Checkbox>
                    {errors.agree && <p className="field__msg">{errors.agree}</p>}
                </div>
                <Button type="submit" size="lg" block loading={loading}>
                    Đăng ký
                </Button>
                <div className="divider">Hoặc đăng ký bằng</div>
                <SocialLogin />
            </form>
            <p className="auth-foot">
                Đã có tài khoản?{' '}
                <Link to="/dang-nhap" className="link">
                    Đăng nhập ngay
                </Link>
            </p>
        </>
    );
}
