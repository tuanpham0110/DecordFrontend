import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { auth, DEMO_OTP } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { FormAlert, maskEmail } from './shared.jsx';

const LEN = 6;
const COOLDOWN = 60;

function OtpInput({ value, onChange, invalid, disabled }) {
    const refs = useRef([]);
    const digits = Array.from({ length: LEN }, (_, i) => value[i] || '');

    const focus = (i) => refs.current[Math.max(0, Math.min(LEN - 1, i))]?.focus();

    function handleChange(i, raw) {
        const clean = raw.replace(/\D/g, '');
        if (!clean) return;
        const next = (value.slice(0, i) + clean + value.slice(i + clean.length)).slice(0, LEN);
        onChange(next);
        focus(i + clean.length);
    }

    function handleKey(i, e) {
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (digits[i]) onChange(value.slice(0, i) + value.slice(i + 1));
            else if (i > 0) {
                onChange(value.slice(0, i - 1) + value.slice(i));
                focus(i - 1);
            }
        } else if (e.key === 'ArrowLeft') focus(i - 1);
        else if (e.key === 'ArrowRight') focus(i + 1);
    }

    return (
        <div className={`otp ${invalid ? 'has-error' : ''}`} role="group" aria-label="Mã xác thực 6 chữ số">
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={(el) => (refs.current[i] = el)}
                    className={`otp__cell ${d ? 'is-filled' : ''}`}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={LEN}
                    value={d}
                    disabled={disabled}
                    aria-label={`Chữ số ${i + 1}`}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKey(i, e)}
                    onFocus={(e) => e.target.select()}
                    autoFocus={i === 0}
                />
            ))}
        </div>
    );
}

export default function VerifyOtp() {
    const navigate = useNavigate();
    const toast = useToast();
    const [pending] = useState(() => auth.pending());
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [left, setLeft] = useState(COOLDOWN);

    useEffect(() => {
        if (left <= 0) return;
        const t = setTimeout(() => setLeft((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [left]);

    if (!pending) return <Navigate to="/dang-nhap" replace />;
    const isReset = pending.purpose === 'reset';

    async function onSubmit(e) {
        e.preventDefault();
        if (code.length < LEN) {
            setError('Vui lòng nhập đủ 6 chữ số.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await auth.verifyOtp({ code });
            if (isReset) navigate('/dat-lai-mat-khau', { replace: true });
            else {
                toast('Xác thực thành công. Mời bạn đăng nhập.');
                navigate('/dang-nhap', { replace: true });
            }
        } catch (err) {
            setError(err.message);
            setCode('');
        } finally {
            setLoading(false);
        }
    }

    async function resend() {
        await auth.resendOtp();
        setLeft(COOLDOWN);
        toast('Đã gửi lại mã xác thực.');
    }

    return (
        <>
            <Link to={isReset ? '/quen-mat-khau' : '/dang-ky'} className="auth-back">
                <Icon name="arrow-left" size={16} />
                Quay lại
            </Link>
            <div className="auth-head">
                <h1>Xác thực tài khoản</h1>
                <p>
                    Chúng tôi đã gửi mã xác thực (OTP) đến <strong>{maskEmail(pending.email)}</strong>. Vui lòng nhập mã để{' '}
                    {isReset ? 'tiếp tục đặt lại mật khẩu' : 'hoàn tất xác thực'}.
                </p>
            </div>
            <form className="auth-form" onSubmit={onSubmit} noValidate>
                <OtpInput
                    value={code}
                    onChange={(v) => {
                        setCode(v);
                        setError('');
                    }}
                    invalid={!!error}
                    disabled={loading}
                />
                <FormAlert>{error}</FormAlert>
                <p className="otp__resend">
                    Bạn không nhận được mã?{' '}
                    <button type="button" className="link" onClick={resend} disabled={left > 0}>
                        {left > 0 ? `Gửi lại (${left}s)` : 'Gửi lại'}
                    </button>
                </p>
                <Button type="submit" size="lg" block loading={loading} disabled={code.length < LEN}>
                    Xác thực
                </Button>
            </form>
            {import.meta.env.DEV && (
                <p className="auth-demo">
                    Mã dùng thử: <code>{DEMO_OTP}</code>
                </p>
            )}
        </>
    );
}
