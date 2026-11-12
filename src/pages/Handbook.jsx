import { useMemo, useState } from 'react';
import { Button, EmptyState, ErrorState, Skeleton } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';

export default function Handbook() {
    const { data, error, loading, reload } = useAsync(() => learning.handbook(), []);
    const [cat, setCat] = useState('Tất cả');
    const [open, setOpen] = useState(null);

    const cats = useMemo(() => ['Tất cả', ...new Set((data ?? []).map((a) => a.category))], [data]);
    const list = (data ?? []).filter((a) => cat === 'Tất cả' || a.category === cat);

    return (
        <div>
            <header className="page-head">
                <div>
                    <h1>Cẩm nang</h1>
                    <p>Mẹo phát âm, cách xưng hô và mẫu câu cho công việc tại cơ sở.</p>
                </div>
            </header>

            <div className="chips" role="tablist" aria-label="Lọc theo chủ đề">
                {cats.map((c) => (
                    <button key={c} role="tab" aria-selected={cat === c} className="chip" onClick={() => setCat(c)}>
                        {c}
                    </button>
                ))}
            </div>

            {error ? (
                <ErrorState onRetry={reload} />
            ) : loading ? (
                <div className="articles">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} h={96} r={0} style={{ margin: '1px 0' }} />
                    ))}
                </div>
            ) : list.length === 0 ? (
                <EmptyState title="Chưa có bài viết">Chủ đề này đang được cập nhật thêm nội dung.</EmptyState>
            ) : (
                <ul className="articles">
                    {list.map((a, i) => (
                        <li key={a.id}>
                            <button className="article" onClick={() => setOpen(a)}>
                                <span className="article__idx">{String(i + 1).padStart(2, '0')}</span>
                                <span className="article__main">
                                    <span className="article__cat">{a.category}</span>
                                    <strong>{a.title}</strong>
                                    <span className="article__excerpt">{a.excerpt}</span>
                                </span>
                                <span className="article__time">{a.minutes} phút đọc</span>
                                <Icon name="arrow-right" size={18} className="article__go" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <Modal
                open={!!open}
                onClose={() => setOpen(null)}
                title={open?.title}
                footer={
                    <Button variant="green" onClick={() => setOpen(null)}>
                        Đã hiểu
                    </Button>
                }
            >
                <span className="tag tag--leaf">{open?.category}</span>
                <p className="modal__lead">{open?.excerpt}</p>
                <p className="muted">Nội dung đầy đủ của bài viết đang được đội ngũ biên soạn cập nhật.</p>
            </Modal>
        </div>
    );
}
