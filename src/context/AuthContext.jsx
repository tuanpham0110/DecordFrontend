import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => auth.currentSession());
    // Distinguishes a deliberate sign-out (go home) from an expired/missing session (go to login).
    const [signedOut, setSignedOut] = useState(false);

    const login = useCallback(async (payload) => {
        const session = await auth.login(payload);
        setSignedOut(false);
        setUser(session);
        return session;
    }, []);

    const logout = useCallback(() => {
        auth.logout();
        setSignedOut(true);
        setUser(null);
    }, []);

    const value = useMemo(() => ({ user, signedOut, login, logout }), [user, signedOut, login, logout]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}

/** Redirects guests to the login page, remembering where they wanted to go. */
export function RequireAuth({ children }) {
    const { user, signedOut } = useAuth();
    const location = useLocation();
    if (!user && signedOut) return <Navigate to="/" replace />;
    if (!user) return <Navigate to="/dang-nhap" replace state={{ from: location.pathname + location.search }} />;
    return children;
}
