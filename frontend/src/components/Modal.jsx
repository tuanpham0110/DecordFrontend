import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

export default function Modal({ open, onClose, title, children, footer }) {
    const ref = useRef(null);
    // callers usually pass an inline `onClose`; keeping it in a ref stops the effect below from
    // re-running (and stealing focus from an input inside the dialog) on every parent render
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        if (!open) return;
        const prev = document.activeElement;
        const onKey = (e) => e.key === 'Escape' && closeRef.current();
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        // leave focus where an autoFocus field already put it
        if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
            prev?.focus?.();
        };
    }, [open]);

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
