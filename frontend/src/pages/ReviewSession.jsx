import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, EmptyState, ErrorState, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import ExerciseStage from '../components/learn/ExerciseStage.jsx';
import { notebook, review } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatDue } from '../utils/format.js';

/** Focused review session over due (or explicitly chosen) SRS cards. */
export default function ReviewSession() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const toast = useToast();
    const ids = (params.get('items') || '').split(',').filter(Boolean);
    const { data, error, loading, reload } = useAsync(() => review.queue(ids.length ? { itemIds: ids } : { scope: 'due' }), [params.get('items')]);
    const [i, setI] = useState(0);
    const [log, setLog] = useState([]);

    useEffect(() => {
        setI(0);
        setLog([]);
    }, [data]);

    const shell = (children) => (
        <div className="player-page">
            <div className="player-shell player-shell--single">
                <main className="player-main" id="main">
                    {children}
                </main>
            </div>
        </div>
    );

    if (error) return shell(<ErrorState onRetry={reload}>{error.message}</ErrorState>);
    if (loading) return shell(<Skeleton h={420} r={24} />);
    if (!data.length) {
        return shell(
            <EmptyState
                title="Không có câu nào đến hạn ôn"
                art="/assets/mascot-cheer.webp"
                action={
                    <Button to="/on-luyen" variant="green">
                        Về Ôn luyện
                    </Button>
                }
            >
                Bạn đã ôn hết các câu đến hạn. Quay lại sau nhé!
            </EmptyState>
        );
    }

    const done = i >= data.length;
    const card = data[i];

    return shell(
        <>
            <div className="player-top">
                <button className="icon-btn player-top__close" onClick={() => navigate('/on-luyen')} aria-label="Thoát phiên ôn">
                    <Icon name="x" size={20} />
                </button>
                <span className="qpill">{done ? 'Hoàn thành' : `Ôn ${i + 1}/${data.length}`}</span>
                <div className="qbar qbar--show" aria-hidden="true">
                    <span style={{ width: `${(Math.min(i, data.length) / data.length) * 100}%` }} />
                </div>
            </div>

            {done ? (
                <div className="result result--compact">
                    <img src="/assets/mascot-cheer.webp" alt="" className="result__mascot" />
                    <h1>Xong phiên ôn tập!</h1>
                    <p>
                        Đúng <strong>{log.filter((l) => l.correct).length}</strong>/{log.length} câu
                        {log.some((l) => l.mastered) && ` · ${log.filter((l) => l.mastered).length} câu đã thuộc`}.
                    </p>
                    <ul className="review-log">
                        {log.map((l) => (
                            <li key={l.itemId}>
                                <Icon name={l.correct ? 'check-circle' : 'x-circle'} size={18} className={l.correct ? 'ok' : 'bad'} />
                                <span>{l.label}</span>
                                <small>{l.mastered ? 'Đã thuộc' : formatDue(l.due)}</small>
                            </li>
                        ))}
                    </ul>
                    <div className="result__actions">
                        <Button to="/on-luyen" variant="light">
                            Về Ôn luyện
                        </Button>
                        <Button to="/tong-quan" variant="leaf" iconRight="arrow-right">
                            Về Tổng quan
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <p className="review-origin">
                        <Icon name="refresh" size={14} /> Câu từ Bài {card.lessonId} · bạn đã sai {card.wrong} lần
                    </p>
                    <ExerciseStage
                        key={card.itemId}
                        item={card.item}
                        allowRetry={false}
                        allowSkip={false}
                        onAnswer={async (resp) => {
                            const r = await review.answer(card.itemId, resp);
                            setLog((x) => [...x, { itemId: card.itemId, label: card.label, ...r }]);
                            return r;
                        }}
                        onRate={async (rating) => {
                            const r = await review.answer(card.itemId, rating);
                            setLog((x) => [...x, { itemId: card.itemId, label: card.label, ...r }]);
                        }}
                        onSave={async (entry) => {
                            await notebook.save(entry);
                            toast('Đã lưu vào sổ tay');
                        }}
                        onNext={() => setI((x) => x + 1)}
                        nextLabel={i + 1 === data.length ? 'Kết thúc' : 'Câu tiếp'}
                    />
                </>
            )}
        </>
    );
}
