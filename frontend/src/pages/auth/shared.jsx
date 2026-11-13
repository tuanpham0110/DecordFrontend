import { Button } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function validatePassword(v) {
    if (!v) return 'Vui lòng nhập mật khẩu.';
    if (v.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Mật khẩu cần có cả chữ cái và chữ số.';
    return '';
}

export function FormAlert({ children, tone = 'error' }) {
    if (!children) return null;
    return (
        <div className={`auth-alert ${tone === 'info' ? 'auth-alert--info' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
            <Icon name={tone === 'error' ? 'alert' : 'check-circle'} size={18} />
            <span>{children}</span>
        </div>
    );
}

function MicrosoftMark() {
    return (
        <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
    );
}

export function SocialLogin() {
    const toast = useToast();
    const soon = (p) => toast(`Đăng nhập bằng ${p} sẽ sớm được hỗ trợ.`, { tone: 'error' });
    return (
        <div className="auth-social">
            <Button type="button" variant="light" onClick={() => soon('Microsoft')}>
                <MicrosoftMark />
                Microsoft
            </Button>
            <Button type="button" variant="light" onClick={() => soon('Google')}>
                <img src="/assets/google.webp" alt="" width="18" height="18" />
                Google
            </Button>
        </div>
    );
}

/** Mask "ngngth@gmail.com" → "ng••••@gmail.com" */
export function maskEmail(email = '') {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    return `${name.slice(0, 2)}${'•'.repeat(Math.min(4, Math.max(2, name.length - 2)))}@${domain}`;
}
