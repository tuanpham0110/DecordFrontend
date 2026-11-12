import { Outlet } from 'react-router-dom';
import { Logo } from '../components/ui.jsx';

export default function AuthLayout() {
    return (
        <div className="auth">
            <aside className="auth__aside" aria-hidden="true">
                <Logo light />
                <div className="auth__aside-copy">
                    <p className="auth__quote">“Mỗi ngày 5 phút, giao tiếp được ngay.”</p>
                    <p className="auth__sub">Học tiếng Mường để làm việc gần dân hơn.</p>
                </div>
                <img className="auth__scene" src="/assets/hero-scene.webp" alt="" />
                <img className="auth__mascot" src="/assets/mascot-book.webp" alt="" />
            </aside>
            <main className="auth__main">
                <div className="auth__mobile-logo">
                    <Logo />
                </div>
                <div className="auth__card">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
