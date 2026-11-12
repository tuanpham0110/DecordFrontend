import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

export default function Modal({ open, onClose, title, children, footer }) {
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const prev = document.activeElement;
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        ref.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
            prev?.focus?.();
        };
    }, [open, onClose]);

    if (!open) return null;
    return createPortal(
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={ref}>
                <header className="modal__head">
                    <h2 id="modal-title">{title}</h2>
                    <button className="icon-btn" onClick={onClose} aria-label="Đóng">
                        <Icon name="x" size={20} />
                    </button>
                </header>
                <div className="modal__body">{children}</div>
                {footer && <footer className="modal__foot">{footer}</footer>}
            </div>
        </div>,
        document.body
    );
}
