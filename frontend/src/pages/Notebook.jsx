import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, EmptyState, ErrorState, Skeleton, TextField } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import SpeakButton from '../components/learn/SpeakButton.jsx';
import { notebook } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import { useToast } from '../context/ToastContext.jsx';

const norm = (s) => String(s ?? '').normalize('NFC').toLowerCase().trim();
/** strip Vietnamese tone marks so "con cui" finds "con cúi" */
const fold = (s) => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export default function Notebook() {
    const toast = useToast();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'all' ? 'all' : 'mine';
    const { data, error, loading, reload } = useAsync(() => notebook.catalog(), []);
    const [entries, setEntries] = useState([]);
    const [q, setQ] = useState(() => params.get('q') || '');
    const [type, setType] = useState('all');
    const [lesson, setLesson] = useState('all');
    const [favOnly, setFavOnly] = useState(false);
    const [busy, setBusy] = useState(null);

    useEffect(() => {
        if (data) setEntries(data);
    }, [data]);

    const lessons = useMemo(() => [...new Set(entries.map((e) => e.lessonId))].sort((a, b) => a - b), [entries]);
    const mine = entries.filter((e) => e.saved);

    const list = useMemo(() => {
        const query = fold(q);
        return (tab === 'mine' ? entries.filter((e) => e.saved) : entries).filter(
            (e) =>
                (type === 'all' || e.type === type) &&
                (lesson === 'all' || e.lessonId === Number(lesson)) &&
                (!favOnly || e.favorite) &&
                (!query || fold(e.text).includes(query) || fold(e.meaning).includes(query) || fold(e.topic).includes(query))
        );
    }, [entries, tab, type, lesson, favOnly, q]);

    async function toggleSave(e) {
        setBusy(e.id);
        try {
            if (e.saved) {
                await notebook.remove(e.id);
                toast(`Đã bỏ “${e.text}” khỏi sổ tay`);
            } else {
                await notebook.save({ type: e.type, ref: e.ref });
                toast(`Đã lưu “${e.text}” vào sổ tay`);
            }
            setEntries((list) => list.map((x) => (x.id === e.id ? { ...x, saved: !e.saved, favorite: e.saved ? false : x.favorite } : x)));
        } catch (err) {
            toast(err.message, { tone: 'error' });
        } finally {
            setBusy(null);
        }
    }

    async function toggleFav(e) {
        setBusy(e.id);
        try {
            if (!e.saved) await notebook.save({ type: e.type, ref: e.ref });
            const n = await notebook.toggleFavorite(e.id);
            setEntries((list) => list.map((x) => (x.id === e.id ? { ...x, saved: true, favorite: n.favorite } : x)));
        } catch (err) {
            toast(err.message, { tone: 'error' });
        } finally {
            setBusy(null);
        }
    }

    const setTab = (t) => setParams(t === 'all' ? { tab: 'all' } : {}, { replace: true });

    return (
        <div>
            <header className="page-head">
                <div>
                    <h1>Sổ tay</h1>
                    <p>Lưu từ và câu bạn muốn nhớ, nghe lại phát âm và ôn bằng thẻ ghi nhớ.</p>
                </div>
                {mine.length > 0 && (
                    <Button to="/on-luyen?tab=cards" variant="green" iconLeft="layers">
                        Ôn {mine.length} thẻ đã lưu
                    </Button>
                )}
            </header>

            <div className="segmented segmented--inline" role="tablist" aria-label="Chọn danh sách">
                <button role="tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>
                    Sổ tay của tôi {data && <span className="count">{mine.length}</span>}
                </button>
                <button role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>
                    Từ vựng chương trình {data && <span className="count">{entries.length}</span>}
                </button>
            </div>

            <div className="panel notebook">
                <div className="notebook__filters">
                    <TextField
                        className="field--search"
                        label="Tìm từ Mường, nghĩa tiếng Việt hoặc chủ đề"
                        icon="search"
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <div className="filter-row">
                        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại">
                            <option value="all">Tất cả loại</option>
                            <option value="word">Từ vựng</option>
                            <option value="sentence">Câu mẫu</option>
                        </select>
                        <select className="select" value={lesson} onChange={(e) => setLesson(e.target.value)} aria-label="Bài học">
                            <option value="all">Mọi bài học</option>
                            {lessons.map((l) => (
                                <option key={l} value={l}>
                                    Bài {l}
                                </option>
                            ))}
                        </select>
                        <button className={`chip ${favOnly ? 'is-on' : ''}`} aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)}>
                            <Icon name={favOnly ? 'heart-filled' : 'heart'} size={16} /> Yêu thích
                        </button>
                    </div>
                </div>

                {error ? (
                    <ErrorState onRetry={reload}>{error.message}</ErrorState>
                ) : loading ? (
                    <div className="notebook__loading">
                        {[0, 1, 2, 3].map((i) => (
                            <Skeleton key={i} h={64} r={12} />
                        ))}
                    </div>
                ) : list.length === 0 ? (
                    tab === 'mine' && mine.length === 0 ? (
                        <EmptyState
                            title="Sổ tay của bạn còn trống"
                            art="/assets/mascot-book.webp"
                            action={
                                <Button variant="green" onClick={() => setTab('all')}>
                                    Xem từ vựng chương trình
                                </Button>
                            }
                        >
                            Bấm “Lưu vào sổ tay” khi làm bài, hoặc lưu từ trong danh sách từ vựng chương trình.
                        </EmptyState>
                    ) : (
                        <EmptyState title="Không tìm thấy kết quả">Hãy thử từ khoá khác hoặc bỏ bớt bộ lọc.</EmptyState>
                    )
                ) : (
                    <ul className="entries">
                        {list.map((e) => (
                            <li key={e.id} className="entry">
                                <SpeakButton text={e.text} />
                                <div className="entry__main">
                                    <strong lang="mtq">{e.text}</strong>
                                    <span>{e.meaning}</span>
                                    {e.note && <small className="entry__note">{e.note}</small>}
                                </div>
                                <div className="entry__meta">
                                    <span className="tag tag--muted">{e.type === 'sentence' ? 'Câu mẫu' : e.topic}</span>
                                    <Link to={`/bai-hoc/${e.lessonId}`} className="entry__lesson">
                                        Bài {e.lessonId}
                                    </Link>
                                </div>
                                <div className="entry__actions">
                                    <button
                                        className={`icon-btn ${e.favorite ? 'is-fav' : ''}`}
                                        onClick={() => toggleFav(e)}
                                        disabled={busy === e.id}
                                        aria-pressed={e.favorite}
                                        aria-label={e.favorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
                                    >
                                        <Icon name={e.favorite ? 'heart-filled' : 'heart'} size={18} />
                                    </button>
                                    <button
                                        className={`icon-btn ${e.saved ? 'is-saved' : ''}`}
                                        onClick={() => toggleSave(e)}
                                        disabled={busy === e.id}
                                        aria-pressed={e.saved}
                                        aria-label={e.saved ? 'Bỏ khỏi sổ tay' : 'Lưu vào sổ tay'}
                                    >
                                        <Icon name={e.saved ? 'bookmark-filled' : 'bookmark'} size={18} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <p className="voice-note voice-note--page">
                <Icon name="info" size={14} />
                Phát âm hiện dùng giọng đọc máy tiếng Việt để tham khảo – bản thu giọng người Mường đang được bổ sung.
            </p>
        </div>
    );
}
