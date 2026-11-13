import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
    const [items, setItems] = useState([]);
    const seq = useRef(0);

    const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);

    const toast = useCallback(
        (message, { tone = 'success', duration = 3600 } = {}) => {
            const id = ++seq.current;
            setItems((list) => [...list.slice(-2), { id, message, tone }]);
            setTimeout(() => dismiss(id), duration);
        },
        [dismiss]
    );

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toasts" aria-live="polite">
                {items.map((t) => (
                    <div key={t.id} className={`toast toast--${t.tone}`} role="status">
                        <Icon className="toast__icon" name={t.tone === 'error' ? 'alert' : t.tone === 'lock' ? 'lock' : t.tone === 'info' ? 'info' : 'check-circle'} size={18} />
                        <span>{t.message}</span>
                        <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Đóng thông báo">
                            <Icon name="x" size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
