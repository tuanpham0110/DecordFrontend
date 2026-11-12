import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { review } from '../services/api.js';
import Icon from '../components/Icon.jsx';
import { Logo } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { NAV_ITEMS } from './nav.js';

function initials(name = '') {
    const parts = name.trim().split(/\s+/);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) || '?').toUpperCase();
}

function UserMenu() {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
        const esc = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', esc);
        };
    }, [open]);

    return (
        <div className="user-menu" ref={ref}>
            <button className="user-menu__trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
                <span className="avatar">{initials(user?.name)}</span>
                <span className="user-menu__name">{user?.name}</span>
                <Icon name="chevron-down" size={16} />
            </button>
            {open && (
                <div className="user-menu__pop" role="menu">
                    <div className="user-menu__who">
                        <strong>{user?.name}</strong>
                        <span>{user?.email}</span>
                    </div>
                    <button
                        role="menuitem"
                        className="user-menu__item"
                        onClick={logout}
                    >
                        <Icon name="logout" size={18} />
                        Đăng xuất
                    </button>
                </div>
            )}
        </div>
    );
}

export default function AppLayout() {
    const [open, setOpen] = useState(false);
    const [due, setDue] = useState(0);
    const location = useLocation();
    useEffect(() => {
        setOpen(false);
        let alive = true;
        review
            .queue({ scope: 'due' })
            .then((q) => alive && setDue(q.length))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [location.pathname]);

    return (
        <div className={`app ${open ? 'is-nav-open' : ''}`}>
            <aside className="sidebar" aria-label="Điều hướng ứng dụng">
                <div className="sidebar__brand">
                    <Logo to="/tong-quan" light />
                </div>
                <nav className="sidebar__nav">
                    {NAV_ITEMS.map((item) => (
                        <NavLink key={item.to} to={item.to} className="sidebar__link">
                            <Icon name={item.icon} size={20} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
                <div className="sidebar__foot">
                    <img src="/assets/mascot-point.webp" alt="" className="sidebar__mascot" loading="lazy" />
                    <p>
                        Mỗi ngày 5 phút,
                        <br />
                        giao tiếp được ngay.
                    </p>
                </div>
            </aside>
            <div className="app__scrim" onClick={() => setOpen(false)} aria-hidden="true" />

            <div className="app__main">
                <header className="topbar">
                    <button className="topbar__toggle" onClick={() => setOpen(true)} aria-label="Mở menu">
                        <Icon name="menu" size={22} />
                    </button>
                    <div className="topbar__brand">
                        <Logo to="/tong-quan" compact />
                    </div>
                    <div className="topbar__right">
                        <Link
                            to="/on-luyen"
                            className="icon-btn"
                            aria-label={due ? `${due} câu đến hạn ôn tập` : 'Không có câu nào cần ôn'}
                            title={due ? `${due} câu đến hạn ôn tập` : 'Không có câu nào cần ôn'}
                        >
                            <Icon name="bell" size={20} />
                            {due > 0 && <span className="icon-btn__count">{due > 9 ? '9+' : due}</span>}
                        </Link>
                        <UserMenu />
                    </div>
                </header>
                <main className="app__content" id="main">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
