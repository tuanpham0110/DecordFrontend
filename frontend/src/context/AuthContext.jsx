import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SESSION_KEY, CHAT_KEY, UNAUTHORIZED_EVENT, auth } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => auth.currentSession());
    // Distinguishes a deliberate sign-out (go home) from an expired/missing session (go to login).
    const [signedOut, setSignedOut] = useState(false);

    // the server rejected our token (expired / revoked) → back to the login page
    useEffect(() => {
        const onExpired = () => setUser(null);
        window.addEventListener(UNAUTHORIZED_EVENT, onExpired);
        return () => window.removeEventListener(UNAUTHORIZED_EVENT, onExpired);
    }, []);

    // A shared login changed in another tab. Reload to discard all learner state,
    // including pending exercises and the previous account's chat in this tab.
    useEffect(() => {
        const onStorage = (event) => {
            if (event.storageArea !== localStorage || (event.key !== null && event.key !== SESSION_KEY) || event.oldValue === event.newValue) return;
            try {
                sessionStorage.removeItem(SESSION_KEY);
                sessionStorage.removeItem(CHAT_KEY);
            } finally {
                window.location.reload();
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const adopt = useCallback((u) => {
        if (u) {
            setSignedOut(false);
            setUser(u);
        }
        return u;
    }, []);

    // a session stored earlier may predate a role change (e.g. just made admin)
    useEffect(() => {
        if (auth.currentSession()) auth.refresh().then(adopt).catch(() => {});
    }, [adopt]);

    const login = useCallback(async (payload) => adopt(await auth.login(payload)), [adopt]);
    const googleLogin = useCallback(async (credential) => adopt(await auth.google(credential)), [adopt]);
    const microsoftLogin = useCallback(async (idToken) => adopt(await auth.microsoft(idToken)), [adopt]);

    /** Returns the signed-in user, or null when an email OTP still has to be confirmed. */
    const register = useCallback(async (payload) => adopt((await auth.register(payload)).user), [adopt]);

    /** Returns { purpose, user } – `user` is set once a sign-up has been confirmed. */
    const verifyOtp = useCallback(
        async (payload) => {
            const r = await auth.verifyOtp(payload);
            adopt(r.user);
            return r;
        },
        [adopt]
    );

    const updateProfile = useCallback(async (payload) => adopt(await auth.updateProfile(payload)), [adopt]);
    const changePassword = useCallback(async (payload) => adopt(await auth.changePassword(payload)), [adopt]);

    const logout = useCallback(() => {
        auth.logout();
        setSignedOut(true);
        setUser(null);
    }, []);

    const deleteAccount = useCallback(async (payload) => {
        await auth.deleteAccount(payload);
        setSignedOut(true);
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({ user, signedOut, login, googleLogin, microsoftLogin, register, verifyOtp, updateProfile, changePassword, logout, deleteAccount }),
        [user, signedOut, login, googleLogin, microsoftLogin, register, verifyOtp, updateProfile, changePassword, logout, deleteAccount]
    );
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
