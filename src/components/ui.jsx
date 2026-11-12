import { forwardRef, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

/* ───────────── Button ───────────── */
export function Button({
    variant = 'clay',
    size,
    block,
    loading,
    iconRight,
    iconLeft,
    to,
    className = '',
    children,
    disabled,
    ...rest
}) {
    const cls = [
        'btn',
        variant !== 'clay' && `btn--${variant}`,
        size && `btn--${size}`,
        block && 'btn--block',
        loading && 'is-loading',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const content = (
        <>
            {iconLeft && <Icon name={iconLeft} size={18} />}
            {children}
            {iconRight && <Icon name={iconRight} size={18} />}
            {loading && <span className="spinner" aria-hidden="true" />}
        </>
    );

    if (to) {
        return (
            <Link to={to} className={cls} {...rest}>
                {content}
            </Link>
        );
    }
    return (
        <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
            {content}
        </button>
    );
}

/* ───────────── TextField ───────────── */
export const TextField = forwardRef(function TextField(
    { label, icon, error, hint, type = 'text', className = '', disabled, ...rest },
    ref
) {
    const id = useId();
    const [reveal, setReveal] = useState(false);
    const isPassword = type === 'password';
    const msgId = `${id}-msg`;

    return (
        <div className={`field ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}>
            <div className="field__control">
                {icon && <Icon name={icon} size={20} className="field__icon" />}
                <label htmlFor={id} className="sr-only">
                    {label}
                </label>
                <input
                    ref={ref}
                    id={id}
                    className="field__input"
                    type={isPassword && reveal ? 'text' : type}
                    placeholder={label}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error || hint ? msgId : undefined}
                    disabled={disabled}
                    {...rest}
                />
                {isPassword && (
                    <button
                        type="button"
                        className="field__action"
                        onClick={() => setReveal((v) => !v)}
                        aria-label={reveal ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                        <Icon name={reveal ? 'eye-off' : 'eye'} size={20} />
                    </button>
                )}
            </div>
            {error ? (
                <p id={msgId} className="field__msg" role="alert">
                    <Icon name="alert" size={14} />
                    {error}
                </p>
            ) : hint ? (
                <p id={msgId} className="field__hint">
                    {hint}
                </p>
            ) : null}
        </div>
    );
});

/* ───────────── Checkbox ───────────── */
export function Checkbox({ children, error, className = '', ...rest }) {
    return (
        <label className={`check ${error ? 'has-error' : ''} ${className}`}>
            <input type="checkbox" {...rest} />
            <span className="check__box">
                <Icon name="check" size={13} strokeWidth={3} />
            </span>
            <span>{children}</span>
        </label>
    );
}

/* ───────────── Progress ───────────── */
export function Progress({ value, tone, label, className = '' }) {
    const v = Math.max(0, Math.min(100, value));
    return (
        <div
            className={`progress ${tone ? `progress--${tone}` : ''} ${className}`}
            style={{ '--value': `${v}%` }}
            role="progressbar"
            aria-valuenow={v}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
        />
    );
}

/* ───────────── Ring ───────────── */
export function Ring({ value, size = 200, stroke = 24, children }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(100, value));
    return (
        <div className="ring" style={{ width: size, height: size }}>
            <svg width={size} height={size} aria-hidden="true">
                <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
                <circle
                    className="ring__fill"
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    strokeWidth={stroke}
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - v / 100)}
                />
            </svg>
            <div className="ring__label">{children}</div>
        </div>
    );
}

/* ───────────── States ───────────── */
export function EmptyState({ title, children, action, art = '/assets/mascot-point.webp' }) {
    return (
        <div className="state">
            {art && <img className="state__art" src={art} alt="" loading="lazy" />}
            <h3 className="state__title">{title}</h3>
            {children && <p className="state__text">{children}</p>}
            {action}
        </div>
    );
}

export function ErrorState({ title = 'Không tải được dữ liệu', children, onRetry }) {
    return (
        <div className="state state--error" role="alert">
            <h3 className="state__title">{title}</h3>
            <p className="state__text">{children || 'Đã có lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.'}</p>
            {onRetry && (
                <Button variant="light" size="sm" iconLeft="refresh" onClick={onRetry}>
                    Thử lại
                </Button>
            )}
        </div>
    );
}

export function Skeleton({ w = '100%', h = 16, r, style }) {
    return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/* ───────────── Logo ───────────── */
export function Logo({ to = '/', light = false, compact = false }) {
    return (
        <Link to={to} className={`logo ${light ? 'logo--light' : ''}`} aria-label="MUONGLAB – Trang chủ">
            <img src="/assets/logo-mark.webp" alt="" width="22" height="26" />
            {!compact && <span>MUONGLAB</span>}
        </Link>
    );
}
