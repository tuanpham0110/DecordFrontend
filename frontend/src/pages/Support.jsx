import { useEffect, useState } from 'react';
import { ErrorState, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import Conversation from '../components/Conversation.jsx';
import { support } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import useMeta from '../hooks/useMeta.js';

const TOPICS = ['Tôi không nghe được âm thanh trong bài học', 'Tôi muốn góp ý về nội dung bài học', 'Tôi gặp lỗi khi đăng nhập / tài khoản', 'Tôi muốn đề xuất tính năng mới'];

/** Learner ↔ admin conversation. New replies are picked up every 20 seconds while the page is open. */
export default function Support() {
    const meta = useMeta();
    const { data, error, loading, reload } = useAsync(() => support.thread(), []);
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        if (data) setMessages(data);
    }, [data]);

    useEffect(() => {
        const t = setInterval(() => {
            if (document.visibilityState === 'visible') support.thread().then(setMessages).catch(() => {});
        }, 20000);
        return () => clearInterval(t);
    }, []);

    async function send(body) {
        const m = await support.send(body);
        setMessages((list) => [...list, m]);
    }

    return (
        <div className="support">
            <header className="page-head">
                <div>
                    <h1>Hỗ trợ</h1>
                    <p>Nhắn trực tiếp cho quản trị viên MUONGLAB khi bạn cần trợ giúp hoặc muốn góp ý.</p>
                </div>
            </header>

            <div className="support__grid">
                <section className="panel support__chat" aria-label="Trò chuyện với quản trị viên">
                    <header className="support__head">
                        <span className="support__avatar">
                            <img src="/assets/logo-mark.webp" alt="" />
                        </span>
                        <div>
                            <strong>Quản trị viên MUONGLAB</strong>
                            <span>Thường trả lời trong vòng một ngày</span>
                        </div>
                    </header>
                    {error ? (
                        <ErrorState onRetry={reload}>{error.message}</ErrorState>
                    ) : loading && !data ? (
                        <div className="support__loading">
                            <Skeleton h={48} r={14} w="60%" />
                            <Skeleton h={48} r={14} w="45%" style={{ marginLeft: 'auto' }} />
                        </div>
                    ) : (
                        <Conversation
                            messages={messages}
                            mine={(m) => !m.fromAdmin}
                            onSend={send}
                            otherLabel="Quản trị viên"
                            placeholder="Nhập nội dung cần hỗ trợ…"
                            empty={
                                <>
                                    <img src="/assets/mascot-point.webp" alt="" />
                                    <p>Bạn chưa có tin nhắn nào. Hãy mô tả điều bạn cần – càng cụ thể càng dễ hỗ trợ.</p>
                                    <div className="support__topics">
                                        {TOPICS.map((t) => (
                                            <button key={t} type="button" onClick={() => send(t)}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            }
                        />
                    )}
                </section>

                <aside className="support__side">
                    <section className="panel support__card">
                        <h2>
                            <Icon name="mail" size={18} /> Liên hệ qua email
                        </h2>
                        <p>Nếu cần gửi tệp đính kèm hoặc không đăng nhập được, hãy viết email cho quản trị viên:</p>
                        {meta?.supportEmail && (
                            <a className="support__mail" href={`mailto:${meta.supportEmail}?subject=${encodeURIComponent('[MUONGLAB] Cần hỗ trợ')}`}>
                                {meta.supportEmail}
                            </a>
                        )}
                    </section>
                    <section className="panel support__card">
                        <h2>
                            <Icon name="bulb" size={18} /> Để được hỗ trợ nhanh
                        </h2>
                        <ul>
                            <li>Nói rõ bạn đang ở bài học hoặc trang nào.</li>
                            <li>Mô tả điều bạn mong đợi và điều thực tế xảy ra.</li>
                            <li>Câu hỏi về từ vựng, cách học: thử hỏi trợ lý AI “Ếch Mường” trước.</li>
                        </ul>
                    </section>
                </aside>
            </div>
        </div>
    );
}
