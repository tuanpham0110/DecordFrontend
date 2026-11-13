import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { askTutor } from '../services/ai/tutor.js';
import { CHAT_KEY as STORE_KEY } from '../services/api.js';
import useMeta from '../hooks/useMeta.js';

export const OPEN_CHAT_EVENT = 'muonglab:open-chat';

/** Opens the AI chat from anywhere (search, buttons…). */
export function openChat(prompt) {
    window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { prompt } }));
}

const SUGGESTIONS = ['“ếm” nghĩa là gì?', 'Đếm từ 1 đến 4 bằng tiếng Mường', 'Làm sao để mở khoá chặng 2?', 'Mẹo luyện Shadowing hiệu quả'];

const WELCOME = {
    role: 'model',
    text: 'Chào bạn! Mình là **Ếch Mường** – trợ lý học tập của MUONGLAB. Bạn có thể hỏi mình về từ vựng, cách phát âm, cách học hoặc cách dùng các tính năng nhé.',
};

function loadChat() {
    try {
        const raw = sessionStorage.getItem(STORE_KEY);
        const list = raw ? JSON.parse(raw) : null;
        return Array.isArray(list) && list.length ? list : [WELCOME];
    } catch {
        return [WELCOME];
    }
}
function saveChat(list) {
    try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-40)));
    } catch {
        /* ignore */
    }
}

/* Minimal, safe markdown: **bold**, *italic*, `code`, bullet / numbered lists. No HTML injection. */
function inline(text) {
    const out = [];
    const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
    let last = 0;
    let m;
    let k = 0;
    while ((m = re.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index));
        const t = m[0];
        if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
        else if (t.startsWith('`')) out.push(<code key={k++}>{t.slice(1, -1)}</code>);
        else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
        last = m.index + t.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}
function Markdown({ text }) {
    const blocks = [];
    let list = null;
    text.split('\n').forEach((raw) => {
        const line = raw.trimEnd();
        const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
        if (bullet) {
            if (!list) {
                list = { ordered: /^\s*\d/.test(line), items: [] };
                blocks.push(list);
            }
            list.items.push(bullet[1]);
            return;
        }
        list = null;
        if (line.trim()) blocks.push(line.replace(/^#+\s*/, ''));
    });
    return blocks.map((b, i) =>
        typeof b === 'string' ? (
            <p key={i}>{inline(b)}</p>
        ) : (
            <Fragment key={i}>
                {b.ordered ? (
                    <ol>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>
                ) : (
                    <ul>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>
                )}
            </Fragment>
        )
    );
}

export default function ChatBox() {
    const meta = useMeta();
    const aiConfigured = !!meta?.ai;
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState(loadChat);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null); // { message, retry?: string }
    const abortRef = useRef(null);
    const listRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => saveChat(messages), [messages]);

    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, open, busy]);

    const send = useCallback(
        async (raw, { retry = false } = {}) => {
            const text = (raw ?? '').trim();
            if (!text || abortRef.current) return;
            setError(null);
            if (!retry) setInput('');
            // a retry re-asks the question that is already the last message
            const history = retry ? messages : [...messages, { role: 'user', text }];
            setMessages([...history, { role: 'model', text: '', pending: true }]);
            setBusy(true);
            const ctrl = new AbortController();
            abortRef.current = ctrl;
            try {
                await askTutor(
                    history.filter((m) => m.text !== WELCOME.text),
                    {
                        signal: ctrl.signal,
                        onToken: (full) => {
                            if (abortRef.current === ctrl && !ctrl.signal.aborted) setMessages([...history, { role: 'model', text: full, pending: true }]);
                        },
                    }
                );
                if (abortRef.current !== ctrl) return;
                setMessages((list) => list.map((m, i) => (i === list.length - 1 ? { role: 'model', text: m.text } : m)));
            } catch (e) {
                if (abortRef.current !== ctrl) return;
                if (e.name === 'AbortError') {
                    setMessages((list) => {
                        const lastMsg = list[list.length - 1];
                        return lastMsg?.text ? list.map((m, i) => (i === list.length - 1 ? { role: 'model', text: m.text, incomplete: true } : m)) : list.slice(0, -1);
                    });
                } else {
                    setMessages(history);
                    // the question stays in the thread; quota / config problems are not worth retrying
                    const retryable = !['ai-quota', 'ai-disabled', 'ai-key', 'ai-model'].includes(e.code) && e.status !== 401;
                    setError({ message: e.message, retry: retryable ? text : null });
                }
            } finally {
                if (abortRef.current === ctrl) {
                    setBusy(false);
                    abortRef.current = null;
                }
            }
        },
        [busy, messages]
    );

    useEffect(() => {
        const onOpen = (e) => {
            setOpen(true);
            const prompt = e.detail?.prompt;
            if (prompt) setInput(prompt);
            setTimeout(() => inputRef.current?.focus(), 60);
        };
        window.addEventListener(OPEN_CHAT_EVENT, onOpen);
        return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
    }, []);

    useEffect(() => {
        if (!open) return;
        const esc = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('keydown', esc);
        setTimeout(() => inputRef.current?.focus(), 60);
        return () => document.removeEventListener('keydown', esc);
    }, [open]);

    useEffect(() => () => {
        const ctrl = abortRef.current;
        abortRef.current = null;
        ctrl?.abort();
    }, []);

    function reset() {
        const ctrl = abortRef.current;
        abortRef.current = null;
        ctrl?.abort();
        setBusy(false);
        setMessages([WELCOME]);
        setError(null);
    }

    const onlyWelcome = messages.length === 1;

    return (
        <>
            <button
                type="button"
                className={`chat-fab ${open ? 'is-open' : ''}`}
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="ai-chat"
                aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
            >
                {open ? <Icon name="x" size={24} /> : <img src="/assets/mascot-point.webp" alt="" />}
                {!open && <span className="chat-fab__tag">Hỏi AI</span>}
            </button>

            {open && (
                <section id="ai-chat" className="chat" role="dialog" aria-label="Trợ lý AI Ếch Mường">
                    <header className="chat__head">
                        <img src="/assets/mascot-cheer.webp" alt="" className="chat__avatar" />
                        <div className="chat__who">
                            <strong>Ếch Mường</strong>
                            <span>
                                <i className={`chat__dot ${aiConfigured ? '' : 'is-off'}`} /> {aiConfigured ? 'Trợ lý AI · Sẵn sàng' : meta ? 'Chưa được bật' : 'Đang kết nối…'}
                            </span>
                        </div>
                        <button type="button" className="chat__icon" onClick={reset} title="Cuộc trò chuyện mới" aria-label="Cuộc trò chuyện mới">
                            <Icon name="refresh" size={18} />
                        </button>
                        <button type="button" className="chat__icon" onClick={() => setOpen(false)} aria-label="Đóng">
                            <Icon name="x" size={18} />
                        </button>
                    </header>

                    <div className="chat__list" ref={listRef} aria-live="polite">
                        {messages.map((m, i) => (
                            <div key={i} className={`msg msg--${m.role}`}>
                                {m.role === 'model' && <img src="/assets/logo-mark.webp" alt="" className="msg__avatar" />}
                                <div className="msg__bubble">
                                    {m.pending && !m.text ? (
                                        <span className="typing" aria-label="Đang trả lời">
                                            <i />
                                            <i />
                                            <i />
                                        </span>
                                    ) : m.role === 'model' ? (
                                        <Markdown text={m.text} />
                                    ) : (
                                        <p>{m.text}</p>
                                    )}
                                </div>
                            </div>
                        ))}

                        {meta && !aiConfigured && (
                            <div className="chat__setup">
                                <Icon name="info" size={18} />
                                <p>
                                    Trợ lý AI chưa được bật trên máy chủ.
                                    {import.meta.env.DEV && (
                                        <>
                                            {' '}
                                            Thêm <code>GEMINI_API_KEY</code> vào <code>backend/.env</code> rồi khởi động lại backend.
                                        </>
                                    )}
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="chat__error" role="alert">
                                <Icon name="alert" size={16} />
                                <span>{error.message}</span>
                                {error.retry && (
                                    <button type="button" className="chat__retry" onClick={() => send(error.retry, { retry: true })}>
                                        <Icon name="refresh" size={14} /> Thử lại
                                    </button>
                                )}
                            </div>
                        )}

                        {onlyWelcome && aiConfigured && (
                            <div className="chat__suggest">
                                {SUGGESTIONS.map((s) => (
                                    <button key={s} type="button" onClick={() => send(s)}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <form
                        className="chat__form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            send(input);
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            rows={1}
                            value={input}
                            maxLength={1000}
                            disabled={!aiConfigured}
                            placeholder={aiConfigured ? 'Hỏi về từ vựng, cách học…' : 'Chưa kết nối trợ lý AI'}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                    e.preventDefault();
                                    send(input);
                                }
                            }}
                            aria-label="Nhập câu hỏi"
                        />
                        {busy ? (
                            <button type="button" className="chat__send is-stop" onClick={() => abortRef.current?.abort()} aria-label="Dừng trả lời">
                                <Icon name="stop" size={18} />
                            </button>
                        ) : (
                            <button type="submit" className="chat__send" disabled={!input.trim() || !aiConfigured} aria-label="Gửi">
                                <Icon name="arrow-right" size={18} />
                            </button>
                        )}
                    </form>
                    <p className="chat__note">AI có thể sai. Từ tiếng Mường chưa kiểm chứng sẽ được ghi chú rõ.</p>
                </section>
            )}
        </>
    );
}
