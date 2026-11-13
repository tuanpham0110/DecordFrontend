import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const DAY = 86400000;
const startOfDay = (t) => new Date(t).setHours(0, 0, 0, 0);

function dayLabel(ts) {
    const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
    if (diff === 0) return 'Hôm nay';
    if (diff === 1) return 'Hôm qua';
    return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
const timeOf = (ts) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * Message thread + composer shared by the learner's support page and the admin inbox.
 * `mine(m)` tells which side of the conversation the viewer is on.
 */
export default function Conversation({ messages, mine, onSend, placeholder = 'Nhập tin nhắn…', empty, otherLabel }) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const listRef = useRef(null);

    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages.length]);

    async function submit(e) {
        e?.preventDefault();
        const body = text.trim();
        if (!body || sending) return;
        setSending(true);
        setError('');
        try {
            await onSend(body);
            setText('');
        } catch (err) {
            setError(err.message || 'Không gửi được tin nhắn. Vui lòng thử lại.');
        } finally {
            setSending(false);
        }
    }

    let lastDay = null;
    return (
        <div className="convo">
            <div className="convo__list" ref={listRef} aria-live="polite">
                {messages.length === 0 && <div className="convo__empty">{empty}</div>}
                {messages.map((m) => {
                    const day = startOfDay(m.at);
                    const showDay = day !== lastDay;
                    lastDay = day;
                    const own = mine(m);
                    return (
                        <div key={m.id} className="convo__item">
                            {showDay && <p className="convo__day">{dayLabel(m.at)}</p>}
                            <div className={`convo__msg ${own ? 'is-mine' : ''}`}>
                                <div className="convo__bubble">{m.body}</div>
                                <small>
                                    {!own && otherLabel ? `${otherLabel} · ` : ''}
                                    {timeOf(m.at)}
                                    {own && m.read ? ' · Đã xem' : ''}
                                </small>
                            </div>
                        </div>
                    );
                })}
            </div>
            {error && (
                <p className="convo__error" role="alert">
                    <Icon name="alert" size={14} /> {error}
                </p>
            )}
            <form className="convo__form" onSubmit={submit}>
                <textarea
                    rows={2}
                    value={text}
                    maxLength={2000}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
                    }}
                />
                <button type="submit" className="convo__send" disabled={!text.trim() || sending} aria-label="Gửi tin nhắn">
                    <Icon name="arrow-right" size={18} />
                </button>
            </form>
        </div>
    );
}
