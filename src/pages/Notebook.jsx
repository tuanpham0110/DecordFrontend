import { useEffect, useState } from 'react';
import { EmptyState, ErrorState, Skeleton, TextField } from '../components/ui.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';

function useDebounced(value, ms = 250) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

export default function Notebook() {
    const [q, setQ] = useState('');
    const query = useDebounced(q);
    const { data, error, loading, reload } = useAsync(() => learning.searchVocabulary(query), [query]);

    return (
        <div>
            <header className="page-head">
                <div>
                    <h1>Sổ tay</h1>
                    <p>Tra cứu nhanh từ vựng Mường – Việt đã có trong chương trình.</p>
                </div>
            </header>

            <div className="panel notebook">
                <div className="notebook__search">
                    <TextField
                        className="field--search"
                        label="Tìm từ Mường hoặc nghĩa tiếng Việt"
                        icon="search"
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    {!loading && data && (
                        <span className="notebook__count">
                            {data.length} từ{query && ' phù hợp'}
                        </span>
                    )}
                </div>

                {error ? (
                    <ErrorState onRetry={reload} />
                ) : loading && !data ? (
                    <div className="notebook__loading">
                        {[0, 1, 2, 3].map((i) => (
                            <Skeleton key={i} h={44} />
                        ))}
                    </div>
                ) : data.length === 0 ? (
                    <EmptyState title="Chưa có từ này trong sổ tay">
                        Không tìm thấy kết quả cho “{query}”. Hãy thử từ khác, hoặc kiểm tra lại dấu thanh.
                    </EmptyState>
                ) : (
                    <table className={`vocab ${loading ? 'is-stale' : ''}`}>
                        <thead>
                            <tr>
                                <th scope="col">Tiếng Mường</th>
                                <th scope="col">Nghĩa tiếng Việt</th>
                                <th scope="col">Chủ đề</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((v) => (
                                <tr key={v.id}>
                                    <td className="vocab__word" data-label="Tiếng Mường">
                                        {v.word}
                                    </td>
                                    <td data-label="Nghĩa">{v.meaning}</td>
                                    <td data-label="Chủ đề">
                                        <span className="tag tag--muted">{v.topic}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
