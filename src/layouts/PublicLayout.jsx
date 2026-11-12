import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button, Logo } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { NAV_ITEMS } from './nav.js';

export default function PublicLayout() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();

    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <>
            <header className={`site-header ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
                <div className="container site-header__inner">
                    <Logo />
                    <nav className="site-nav" aria-label="Điều hướng chính">
                        {NAV_ITEMS.map((item) => (
                            <NavLink key={item.to} to={item.publicTo ?? item.to} end className="site-nav__link">
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                    <div className="site-header__actions">
                        {user ? (
                            <Button to="/tong-quan" variant="green" size="sm" iconRight="arrow-right">
                                Vào học
                            </Button>
                        ) : (
                            <>
                                <Button to="/dang-nhap" variant="outline" size="sm">
                                    Đăng nhập
                                </Button>
                                <Button to="/dang-ky" variant="outline-clay" size="sm">
                                    Đăng ký
                                </Button>
                            </>
                        )}
                    </div>
                    <button
                        className="site-header__toggle"
                        onClick={() => setOpen((v) => !v)}
                        aria-expanded={open}
                        aria-label={open ? 'Đóng menu' : 'Mở menu'}
                    >
                        <Icon name={open ? 'x' : 'menu'} size={22} />
                    </button>
                </div>
            </header>
            <Outlet />
            <footer className="site-footer">
                <div className="container site-footer__inner">
                    <Logo />
                    <p>Nền tảng học tập và tra cứu tiếng Mường cho đội ngũ công chức trẻ.</p>
                    <p className="site-footer__copy">© {new Date().getFullYear()} MUONGLAB</p>
                </div>
            </footer>
        </>
    );
}
