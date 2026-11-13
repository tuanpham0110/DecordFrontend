import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, TextField } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { auth } from '../../services/api.js';
import { isEmail } from './shared.jsx';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        const msg = !email ? 'Vui lòng nhập email.' : !isEmail(email) ? 'Email chưa đúng định dạng.' : '';
        setError(msg);
        if (msg) return;
        setLoading(true);
        try {
            await auth.requestReset({ email });
            navigate('/xac-thuc');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Link to="/dang-nhap" className="auth-back">
                <Icon name="arrow-left" size={16} />
                Quay lại đăng nhập
            </Link>
            <div className="auth-head">
                <h1>Quên mật khẩu</h1>
                <p>Nhập email của bạn để nhận mã xác thực.</p>
            </div>
            <form className="auth-form" onSubmit={onSubmit} noValidate>
                <TextField
                    label="Email"
                    icon="mail"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                    }}
                    error={error}
                    autoFocus
                />
                <Button type="submit" size="lg" block loading={loading}>
                    Gửi mã
                </Button>
            </form>
        </>
    );
}
