import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Logo } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { AuthScenery, FrogHand, FrogHead } from '../components/FrogHug.jsx';

const GREETING = {
    '/dang-nhap': { title: 'Xin chào,', sub: 'đăng nhập để học tiếp nhé!', mood: 'happy' },
    '/dang-ky': { title: 'Tham gia nào,', sub: 'tạo tài khoản của bạn!', mood: 'open' },
    '/quen-mat-khau': { title: 'Đừng lo,', sub: 'mình cùng lấy lại mật khẩu!', mood: 'open' },
    '/xac-thuc': { title: 'Sắp xong rồi,', sub: 'nhập mã xác thực nhé!', mood: 'open' },
    '/dat-lai-mat-khau': { title: 'Mật khẩu mới,', sub: 'nhớ giữ thật kỹ nhé!', mood: 'happy' },
};

export default function AuthLayout() {
    const { pathname } = useLocation();
    const g = GREETING[pathname] ?? GREETING['/dang-nhap'];

    // auth screens are full-bleed illustrations: no visible page scrollbar
    useEffect(() => {
        document.documentElement.classList.add('no-scrollbar');
        return () => document.documentElement.classList.remove('no-scrollbar');
    }, []);

    return (
        <div className="auth2">
            <AuthScenery />
            <header className="auth2__top">
                <Logo light />
                <Link to="/" className="auth2__home">
                    <Icon name="arrow-left" size={16} /> Trang chủ
                </Link>
            </header>

            <main className="auth2__main">
                <div className="auth2__greet">
                    <h2>{g.title}</h2>
                    <p>{g.sub}</p>
                </div>

                <div className="frog-stage">
                    <span className="frog-sparks" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                    </span>
                    <div className="frog-body" aria-hidden="true" />
                    <FrogHead mood={g.mood} />
                    <div className="frog-card">
                        <FrogHand side="left" />
                        <FrogHand side="right" />
                        <div className="auth__card">
                            <Outlet />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
