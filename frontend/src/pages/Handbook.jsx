import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, EmptyState, ErrorState, Skeleton, TextField } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import SpeakButton from '../components/learn/SpeakButton.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

function Block({ b, vocabulary, sentences }) {
    if (b.p) return <p>{b.p}</p>;
    if (b.h) return <h3>{b.h}</h3>;
    if (b.list)
        return (
            <ul>
                {b.list.map((x) => (
                    <li key={x}>{x}</li>
                ))}
            </ul>
        );
    if (b.vocab) {
        const words = b.vocab === '*' ? vocabulary : vocabulary.filter((v) => v.topic === b.vocab);
        return (
            <table className="vocab">
                <thead>
                    <tr>
                        <th scope="col">Tiếng Mường</th>
                        <th scope="col">Nghĩa</th>
                        <th scope="col">Chủ đề</th>
                    </tr>
                </thead>
                <tbody>
                    {words.map((v) => (
                        <tr key={v.id}>
                            <td className="vocab__word" data-label="Tiếng Mường">
                                <SpeakButton text={v.word} /> {v.word}
                            </td>
                            <td data-label="Nghĩa">{v.meaning}</td>
                            <td data-label="Chủ đề">
                                <span className="tag tag--muted">{v.topic}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
    if (b.sentences)
        return (
            <ul className="sentence-list">
                {sentences.map((s) => (
                    <li key={s.id}>
                        <SpeakButton text={s.text} />
                        <span>
                            <strong lang="mtq">{s.text}</strong>
                            <small>{s.meaning}</small>
                        </span>
                    </li>
                ))}
            </ul>
        );
    return null;
}

export default function Handbook() {
    const { data, error, loading, reload } = useAsync(() => learning.handbook(), []);
    const [params, setParams] = useSearchParams();
    const [cat, setCat] = useState('Tất cả');
    const [q, setQ] = useState('');
    const openId = params.get('bai');

    const articles = data?.articles ?? [];
    const cats = useMemo(() => ['Tất cả', ...new Set(articles.map((a) => a.category))], [articles]);
    const list = articles.filter(
        (a) => (cat === 'Tất cả' || a.category === cat) && (!q || fold(a.title + ' ' + a.excerpt).includes(fold(q)))
    );
    const open = articles.find((a) => a.id === openId);

    if (open) {
        return (
            <article className="article-page">
                <button className="back-link" onClick={() => setParams({})}>
                    <Icon name="arrow-left" size={16} /> Cẩm nang
                </button>
                <header>
                    <span className="eyebrow">{open.category}</span>
                    <h1>{open.title}</h1>
                    <p className="article-page__lead">{open.excerpt}</p>
                    <span className="muted small">
                        <Icon name="clock" size={14} /> {open.minutes} phút đọc
                    </span>
                </header>
                <div className="prose">
                    {open.draft ? (
                        <div className="draft-note">
                            <Icon name="clock" size={20} />
                            <p>
                                Nội dung bài viết này đang được đội ngũ chuyên môn biên soạn và xác minh. Chúng tôi chỉ đăng khi nội dung tiếng Mường đã được kiểm chứng.
                            </p>
                        </div>
                    ) : (
                        open.body.map((b, i) => <Block key={i} b={b} vocabulary={data.vocabulary} sentences={data.sentences} />)
                    )}
                </div>
                <footer className="article-page__foot">
                    <Button variant="light" iconLeft="arrow-left" onClick={() => setParams({})}>
                        Tất cả bài viết
                    </Button>
                    <Button to="/bai-hoc" variant="green" iconRight="arrow-right">
                        Vào học
                    </Button>
                </footer>
            </article>
        );
    }

    return (
        <div>
            <header className="page-head">
                <div>
                    <h1>Cẩm nang</h1>
                    <p>Phương pháp học, hướng dẫn phát âm, từ vựng và câu mẫu đã có trong chương trình.</p>
                </div>
                <TextField className="field--search page-head__search" label="Tìm bài viết" icon="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
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
                <EmptyState title="Chưa có bài viết">Không có bài viết phù hợp. Hãy thử chủ đề hoặc từ khoá khác.</EmptyState>
            ) : (
                <ul className="articles">
                    {list.map((a, i) => (
                        <li key={a.id}>
                            <button className="article" onClick={() => setParams({ bai: a.id })}>
                                <span className="article__idx">{String(i + 1).padStart(2, '0')}</span>
                                <span className="article__main">
                                    <span className="article__cat">
                                        {a.category}
                                        {a.draft && <span className="tag tag--muted tag--xs">Đang biên soạn</span>}
                                    </span>
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
        </div>
    );
}
