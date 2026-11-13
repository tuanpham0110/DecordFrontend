import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useMeta from '../../hooks/useMeta.js';

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function validatePassword(v) {
    if (!v) return 'Vui lòng nhập mật khẩu.';
    if (v.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Mật khẩu cần có cả chữ cái và chữ số.';
    return '';
}

/** 0–4, shown by <PasswordMeter>. */
export function passwordStrength(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
    return s;
}
const LEVELS = ['Rất yếu', 'Yếu', 'Trung bình', 'Khá mạnh', 'Mạnh'];

export function PasswordMeter({ value }) {
    if (!value) return null;
    const score = passwordStrength(value);
    return (
        <div className="pw-meter" data-score={score}>
            <div className="pw-meter__bars" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={i < score ? 'on' : ''} />
                ))}
            </div>
            <span>Độ mạnh: {LEVELS[score]}</span>
        </div>
    );
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

/* ───────────── "Đăng nhập bằng Google" (Google Identity Services) ───────────── */
let gsiPromise = null;
function loadGsi() {
    gsiPromise ??= new Promise((resolve, reject) => {
        if (window.google?.accounts?.id) return resolve();
        const el = document.createElement('script');
        el.src = 'https://accounts.google.com/gsi/client';
        el.async = true;
        el.onload = () => resolve();
        el.onerror = () => {
            gsiPromise = null;
            reject(new Error('Không tải được Google Sign-In.'));
        };
        document.head.appendChild(el);
    });
    return gsiPromise;
}

/**
 * Renders Google's own button. Shown only when the backend has GOOGLE_CLIENT_ID configured
 * (see GET /api/meta) – otherwise this section does not appear at all.
 * After a successful sign-in the auth context holds the user and the guest-only route redirects.
 */
export function SocialLogin({ label = 'Hoặc đăng nhập bằng', onError }) {
    const meta = useMeta();
    const { googleLogin } = useAuth();
    const toast = useToast();
    const slot = useRef(null);
    const [failed, setFailed] = useState(false);
    const clientId = meta?.googleClientId;

    useEffect(() => {
        if (!clientId) return;
        let alive = true;
        loadGsi()
            .then(() => {
                if (!alive || !slot.current) return;
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: async ({ credential }) => {
                        try {
                            const user = await googleLogin(credential);
                            toast(`Chào mừng ${user.name}!`);
                        } catch (e) {
                            onError?.(e.message);
                        }
                    },
                });
                window.google.accounts.id.renderButton(slot.current, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    shape: 'pill',
                    text: 'continue_with',
                    locale: 'vi',
                    width: Math.max(220, Math.min(360, slot.current.offsetWidth || 320)),
                });
            })
            .catch(() => alive && setFailed(true));
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    if (!clientId || failed) return null;
    return (
        <>
            <div className="divider">{label}</div>
            <div className="auth-google" ref={slot} />
        </>
    );
}

/** Mask "ngngth@gmail.com" → "ng••••@gmail.com" */
export function maskEmail(email = '') {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    return `${name.slice(0, 2)}${'•'.repeat(Math.min(4, Math.max(2, name.length - 2)))}@${domain}`;
}
