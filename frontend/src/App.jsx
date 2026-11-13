import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import { RequireAuth, useAuth } from './context/AuthContext.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import VerifyOtp from './pages/auth/VerifyOtp.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Lessons from './pages/Lessons.jsx';
import Stage from './pages/Stage.jsx';
import Lesson from './pages/Lesson.jsx';
import Practice from './pages/Practice.jsx';
import LessonPlayer from './pages/LessonPlayer.jsx';
import ReviewSession from './pages/ReviewSession.jsx';
import Notebook from './pages/Notebook.jsx';
import Handbook from './pages/Handbook.jsx';
import NotFound from './pages/NotFound.jsx';

function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
}

function GuestOnly({ children }) {
    const { user } = useAuth();
    const location = useLocation();
    return user ? <Navigate to={location.state?.from || '/tong-quan'} replace /> : children;
}

export default function App() {
    return (
        <>
            <ScrollToTop />
            <Routes>
                <Route element={<PublicLayout />}>
                    <Route index element={<Landing />} />
                </Route>

                {/* Focus layouts – no site chrome while learning */}
                <Route path="hoc-thu" element={<LessonPlayer trial />} />
                <Route
                    path="hoc/:lessonId"
                    element={
                        <RequireAuth>
                            <LessonPlayer />
                        </RequireAuth>
                    }
                />
                <Route
                    path="on-luyen/phien"
                    element={
                        <RequireAuth>
                            <ReviewSession />
                        </RequireAuth>
                    }
                />

                <Route
                    element={
                        <GuestOnly>
                            <AuthLayout />
                        </GuestOnly>
                    }
                >
                    <Route path="dang-nhap" element={<Login />} />
                    <Route path="dang-ky" element={<Register />} />
                    <Route path="quen-mat-khau" element={<ForgotPassword />} />
                    <Route path="xac-thuc" element={<VerifyOtp />} />
                    <Route path="dat-lai-mat-khau" element={<ResetPassword />} />
                </Route>

                <Route
                    element={
                        <RequireAuth>
                            <AppLayout />
                        </RequireAuth>
                    }
                >
                    <Route path="tong-quan" element={<Dashboard />} />
                    <Route path="bai-hoc" element={<Lessons />} />
                    <Route path="bai-hoc/chang/:id" element={<Stage />} />
                    <Route path="bai-hoc/:lessonId" element={<Lesson />} />
                    <Route path="on-luyen" element={<Practice />} />
                    <Route path="so-tay" element={<Notebook />} />
                    <Route path="cam-nang" element={<Handbook />} />
                </Route>

                <Route path="*" element={<NotFound />} />
            </Routes>
        </>
    );
}
