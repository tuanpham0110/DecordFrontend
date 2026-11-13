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

/* ───────────── "Đăng nhập bằng Microsoft" (MSAL popup) ───────────── */
let msalPromise = null;
function msalFor(clientId) {
    msalPromise ??= import('@azure/msal-browser').then(async ({ PublicClientApplication }) => {
        const app = new PublicClientApplication({
            auth: { clientId, authority: 'https://login.microsoftonline.com/common', redirectUri: window.location.origin },
            cache: { cacheLocation: 'sessionStorage' },
        });
        await app.initialize();
        return app;
    });
    msalPromise.catch(() => (msalPromise = null));
    return msalPromise;
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

function MicrosoftButton({ clientId, onError }) {
    const { microsoftLogin } = useAuth();
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    async function signIn() {
        if (busy) return;
        setBusy(true);
        try {
            const app = await msalFor(clientId);
            const result = await app.loginPopup({ scopes: ['openid', 'profile', 'email'], prompt: 'select_account' });
            const user = await microsoftLogin(result.idToken);
            toast(`Chào mừng ${user.name}!`);
        } catch (e) {
            // closing the popup is not an error worth showing
            if (!/user_cancelled|popup_window_error|interaction_in_progress/.test(e?.errorCode ?? '')) onError?.(e?.status != null ? e.message : 'Không đăng nhập được bằng Microsoft. Vui lòng thử lại.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <button type="button" className="auth-ms" onClick={signIn} disabled={busy}>
            <MicrosoftMark />
            {busy ? 'Đang mở Microsoft…' : 'Tiếp tục với Microsoft'}
        </button>
    );
}

function GoogleButton({ clientId, onError }) {
    const { googleLogin } = useAuth();
    const toast = useToast();
    const slot = useRef(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
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

    return failed ? null : <div className="auth-google" ref={slot} />;
}

/**
 * Google / Microsoft sign-in. Each button appears only when the backend has its client id
 * configured (GET /api/meta) – with neither, this whole section is not rendered.
 * After a successful sign-in the auth context holds the user and the guest-only route redirects.
 */
export function SocialLogin({ label = 'Hoặc đăng nhập bằng', onError }) {
    const meta = useMeta();
    if (!meta?.googleClientId && !meta?.microsoftClientId) return null;
    return (
        <>
            <div className="divider">{label}</div>
            <div className="auth-providers">
                {meta.googleClientId && <GoogleButton clientId={meta.googleClientId} onError={onError} />}
                {meta.microsoftClientId && <MicrosoftButton clientId={meta.microsoftClientId} onError={onError} />}
            </div>
        </>
    );
}

/** Mask "ngngth@gmail.com" → "ng••••@gmail.com" */
export function maskEmail(email = '') {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    return `${name.slice(0, 2)}${'•'.repeat(Math.min(4, Math.max(2, name.length - 2)))}@${domain}`;
}
