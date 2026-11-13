import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { learning } from '../services/api.js';
import useAsync from '../hooks/useAsync.js';
import { openChat } from './ChatBox.jsx';

/** Accent-insensitive folding so "on luyen" finds "Ôn luyện". */
export const fold = (s) =>
    String(s ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();

const FEATURES = [
    { title: 'Tổng quan', sub: 'Tiến độ, mục tiêu ngày, huy hiệu', to: '/tong-quan', icon: 'home', keys: 'trang chu dashboard' },
    { title: 'Hành trình học', sub: 'Lộ trình 3 chặng và các bài học', to: '/bai-hoc', icon: 'book', keys: 'lo trinh bai hoc chang' },
    { title: 'Ôn luyện – Câu cần ôn', sub: 'Ôn câu từng làm sai theo lịch', to: '/on-luyen', icon: 'target', keys: 'on tap review srs' },
    { title: 'Bắt đầu phiên ôn tập', sub: 'Ôn ngay các câu đến hạn', to: '/on-luyen/phien', icon: 'refresh', keys: 'on ngay phien' },
    { title: 'Thẻ ghi nhớ', sub: 'Lật thẻ từ vựng', to: '/on-luyen?tab=cards', icon: 'layers', keys: 'flashcard the' },
    { title: 'Kiểm tra nhanh', sub: 'Trắc nghiệm từ vựng', to: '/on-luyen?tab=quiz', icon: 'check-circle', keys: 'quiz trac nghiem' },
    { title: 'Sổ tay của tôi', sub: 'Từ và câu đã lưu', to: '/so-tay', icon: 'notebook', keys: 'so tay luu yeu thich' },
    { title: 'Kho từ vựng & câu mẫu', sub: 'Toàn bộ từ, câu trong chương trình', to: '/so-tay?tab=all', icon: 'bookmark', keys: 'tu vung cau mau tra cuu' },
    { title: 'Cẩm nang', sub: 'Phương pháp học, phát âm, văn hoá', to: '/cam-nang', icon: 'guide', keys: 'huong dan cam nang' },
    { title: 'Lịch sử học', sub: 'Điểm số từng lần làm bài', to: '/lich-su', icon: 'calendar', keys: 'lich su ket qua diem hoat dong' },
    { title: 'Tài khoản', sub: 'Hồ sơ, mục tiêu ngày, đổi mật khẩu', to: '/tai-khoan', icon: 'user', keys: 'tai khoan ho so mat khau cai dat dang xuat' },
    { title: 'Trợ lý AI Ếch Mường', sub: 'Hỏi đáp về từ vựng, cách học', action: 'chat', icon: 'sparkle', keys: 'ai chatbot hoi dap tro ly' },
    { title: 'Học thử 5 phút', sub: 'Bài học thử không lưu tiến độ', to: '/hoc-thu', icon: 'play', keys: 'hoc thu demo' },
];

const GROUPS = [
    { key: 'feature', label: 'Chức năng' },
    { key: 'lesson', label: 'Bài học & chặng' },
    { key: 'word', label: 'Từ vựng & câu mẫu' },
    { key: 'article', label: 'Cẩm nang' },
];

const STATUS_LABEL = { done: 'Đã hoàn thành', current: 'Đang học', locked: 'Đang khoá', soon: 'Đang biên soạn' };

function buildIndex(stages, { vocabulary: VOCABULARY = [], sentences: SENTENCES = [], articles: HANDBOOK = [] } = {}) {
    const out = FEATURES.map((f) => ({ ...f, group: 'feature', hay: fold(`${f.title} ${f.sub} ${f.keys}`) }));
    for (const s of stages ?? []) {
        out.push({
            group: 'lesson',
            icon: s.unlocked ? 'flag' : 'lock',
            title: `Chặng ${s.id}: ${s.title}`,
            sub: s.unlocked ? `${s.completed}/${s.total} bài hoàn thành` : 'Đang khoá',
            to: `/bai-hoc/chang/${s.id}`,
            locked: !s.unlocked,
            hay: fold(`chang ${s.id} ${s.title} ${s.summary}`),
        });
        for (const l of s.lessons) {
            out.push({
                group: 'lesson',
                icon: l.status === 'locked' ? 'lock' : l.status === 'done' ? 'check-circle' : l.status === 'soon' ? 'clock' : 'book',
                title: `Bài ${l.id}: ${l.title}`,
                sub: `Chặng ${s.id} · ${STATUS_LABEL[l.status]}`,
                to: `/bai-hoc/${l.id}`,
                locked: l.status === 'locked' || !s.unlocked,
                hay: fold(`bai ${l.id} ${l.title} chang ${s.id}`),
            });
        }
    }
    for (const v of VOCABULARY) {
        out.push({ group: 'word', icon: 'volume', title: v.word, sub: `${v.meaning} · ${v.topic}`, to: `/so-tay?tab=all&q=${encodeURIComponent(v.word)}`, hay: fold(`${v.word} ${v.meaning} ${v.topic}`), lang: 'mtq' });
    }
    for (const t of SENTENCES) {
        out.push({ group: 'word', icon: 'volume', title: t.text, sub: t.meaning, to: `/so-tay?tab=all&q=${encodeURIComponent(t.text)}`, hay: fold(`${t.text} ${t.meaning} ${t.topic}`), lang: 'mtq' });
    }
    for (const a of HANDBOOK) {
        out.push({ group: 'article', icon: 'guide', title: a.title, sub: `${a.category}${a.draft ? ' · Đang biên soạn' : ''}`, to: `/cam-nang?bai=${a.id}`, hay: fold(`${a.title} ${a.excerpt} ${a.category}`) });
    }
    return out;
}

function search(index, q) {
    const query = fold(q);
    if (!query) return [];
    const terms = query.split(/\s+/);
    return index
        .map((e) => {
            if (!terms.every((t) => e.hay.includes(t))) return null;
            const ft = fold(e.title);
            const score = (ft.startsWith(query) ? 3 : 0) + (ft.includes(query) ? 2 : 0) + (e.group === 'feature' ? 1 : 0);
            return { ...e, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);
}

function Highlight({ text, q }) {
    const query = fold(q);
    if (!query) return text;
    const ft = fold(text);
    const i = ft.indexOf(query);
    if (i < 0 || ft.length !== text.length) return text;
    return (
        <>
            {text.slice(0, i)}
            <mark>{text.slice(i, i + query.length)}</mark>
            {text.slice(i + query.length)}
        </>
    );
}

/** Search every feature, stage, lesson, word and article of the app. Ctrl/⌘ + K to focus. */
export default function GlobalSearch({ stages }) {
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const inputRef = useRef(null);
    const boxRef = useRef(null);
    const listId = useId();

    const { data: refs } = useAsync(() => learning.handbook(), []);
    const index = useMemo(() => buildIndex(stages, refs ?? undefined), [stages, refs]);
    const results = useMemo(() => search(index, q), [index, q]);
    const grouped = useMemo(
        () => GROUPS.map((g) => ({ ...g, items: results.filter((r) => r.group === g.key).slice(0, g.key === 'lesson' ? 6 : 5) })).filter((g) => g.items.length),
        [results]
    );
    const flat = grouped.flatMap((g) => g.items);

    useEffect(() => setActive(0), [q]);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                setOpen(true);
            }
        };
        const onDown = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown);
        };
    }, []);

    function choose(item) {
        if (!item) return;
        setOpen(false);
        setQ('');
        inputRef.current?.blur();
        if (item.action === 'chat') openChat();
        else navigate(item.to);
    }

    function onKeyDown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(flat.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flat[active]) choose(flat[active]);
            else if (q.trim()) openChat(q.trim());
        } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
        }
    }

    const show = open && q.trim().length > 0;
    let n = -1;

    return (
        <div className={`gsearch ${show ? 'is-open' : ''}`} ref={boxRef}>
            <div className="gsearch__field">
                <Icon name="search" size={20} />
                <input
                    ref={inputRef}
                    type="search"
                    value={q}
                    placeholder="Tìm bài học, từ vựng, chức năng…"
                    onChange={(e) => {
                        setQ(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    role="combobox"
                    aria-expanded={show}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={show && flat[active] ? `${listId}-${active}` : undefined}
                    aria-label="Tìm kiếm trong MUONGLAB"
                />
                <kbd className="gsearch__kbd">Ctrl K</kbd>
            </div>

            {show && (
                <div className="gsearch__pop" id={listId} role="listbox">
                    {grouped.length === 0 ? (
                        <div className="gsearch__empty">
                            <p>
                                Không tìm thấy kết quả cho “<b>{q}</b>”.
                            </p>
                            <button type="button" className="gsearch__ask" onClick={() => {
                                    const text = q.trim();
                                    setOpen(false);
                                    setQ('');
                                    openChat(text);
                                }}
                            >
                                <Icon name="sparkle" size={16} /> Hỏi trợ lý AI về “{q.trim()}”
                            </button>
                        </div>
                    ) : (
                        grouped.map((g) => (
                            <div key={g.key} className="gsearch__group" role="group" aria-label={g.label}>
                                <span className="gsearch__label">{g.label}</span>
                                {g.items.map((it) => {
                                    n += 1;
                                    const idx = n;
                                    return (
                                        <button
                                            key={`${it.group}-${it.title}`}
                                            id={`${listId}-${idx}`}
                                            type="button"
                                            role="option"
                                            aria-selected={idx === active}
                                            className={`gsearch__item ${idx === active ? 'is-active' : ''} ${it.locked ? 'is-locked' : ''}`}
                                            onMouseEnter={() => setActive(idx)}
                                            onClick={() => choose(it)}
                                        >
                                            <span className="gsearch__icon">
                                                <Icon name={it.icon} size={16} />
                                            </span>
                                            <span className="gsearch__main">
                                                <strong lang={it.lang}>
                                                    <Highlight text={it.title} q={q} />
                                                </strong>
                                                <small>{it.sub}</small>
                                            </span>
                                            {it.locked ? <Icon name="lock-small" size={14} /> : <Icon name="arrow-right" size={14} />}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
