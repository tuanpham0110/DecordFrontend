import { useState } from 'react';
import { Button } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import WordChip from '../components/WordChip.jsx';
import AudioPlayer from '../components/learn/AudioPlayer.jsx';
import { STAGES, VOCABULARY } from '../data/content.js';
import { useAuth } from '../context/AuthContext.jsx';

// Chip positions over the illustration, following the Figma composition.
const CHIP_LAYOUT = {
    em: { top: '8%', left: '-4%', '--delay': '0s' },
    moch: { top: '12%', right: '-2%', '--delay': '-1.2s' },
    hal: { top: '50%', left: '-8%', '--delay': '-2.4s' },
    pa: { top: '44%', right: '-6%', '--delay': '-0.6s' },
    pon: { bottom: '8%', right: '2%', '--delay': '-1.8s' },
};
const HERO_WORDS = VOCABULARY.filter((v) => CHIP_LAYOUT[v.id]);

const FEATURES = [
    { icon: 'book', title: 'Học bài bản', text: 'Từ cơ bản đến nâng cao' },
    { icon: 'target', title: 'Ôn luyện hiệu quả', text: 'Ôn đúng câu bạn từng sai' },
    { icon: 'search', title: 'Tra cứu nhanh', text: 'Từ vựng, câu mẫu, cẩm nang' },
    { icon: 'user', title: 'Ứng dụng thực tế', text: 'Hỗ trợ giao tiếp công việc' },
];

/* Preview steps use only verified content from the course. */
const PREVIEW = [
    {
        tag: 'Phát âm',
        title: 'Nghe âm mũi /m/ và từ đầu tiên',
        word: 'ếm',
        meaning: 'tôi (đại từ nhân xưng)',
        tip: 'Khép môi và để luồng hơi đi qua mũi, tương đồng với âm /m/ trong tiếng Việt. Bấm nút loa nghe 2–3 lần rồi lặp lại.',
    },
    {
        tag: 'Số đếm',
        title: 'Đếm từ một đến bốn',
        word: 'mốch, hal, pa, pổn',
        meaning: 'một, hai, ba, bốn',
        tip: 'Ngắt nhịp đều giữa các số. Đọc chậm trước, sau đó tăng dần tốc độ.',
    },
    {
        tag: 'Câu hỏi',
        title: 'Câu hỏi đầu tiên',
        word: 'Nhà ja chiếm từ con cúi chẵng?',
        meaning: 'Nhà mày có con lợn không?',
        tip: 'Lên giọng ở cuối câu hỏi. Tách câu thành hai nhịp để dễ nói theo.',
    },
];

const METHOD = [
    {
        n: '01',
        title: 'Bắc âm cầu',
        text: 'Nghe âm thanh và chọn đáp án đúng. Phản hồi ngay, kèm giải thích cách phát âm.',
        demo: (
            <div className="mdemo mdemo--listen" aria-hidden="true">
                <span className="mdemo__play">
                    <Icon name="play" size={14} />
                </span>
                <span className="mdemo__wave">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--h': 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7)) }} />)}</span>
                <span className="mdemo__opt is-ok">A · minh</span>
                <span className="mdemo__opt">B · ấm</span>
            </div>
        ),
    },
    {
        n: '02',
        title: 'Lắp khung câu',
        text: 'Chọn và sắp xếp từ thành câu hoàn chỉnh. Xem dịch nghĩa sau khi kiểm tra.',
        demo: (
            <div className="mdemo mdemo--build" aria-hidden="true">
                <span className="mdemo__line">
                    Nhà ja chiếm từ <b>con cúi</b> chẵng?
                </span>
                <span className="mdemo__chips">
                    <i className="is-used">Con cúi</i>
                    <i>Rọng</i>
                    <i>Cổ lại</i>
                </span>
            </div>
        ),
    },
    {
        n: '03',
        title: 'Shadowing',
        text: 'Nghe câu mẫu, ghi âm giọng mình, nghe lại và so sánh để chỉnh dần.',
        demo: (
            <div className="mdemo mdemo--shadow" aria-hidden="true">
                <span className="mdemo__mic">
                    <Icon name="mic" size={20} />
                </span>
                <span className="mdemo__compare">
                    <i>Mẫu</i>
                    <i>Bạn</i>
                </span>
            </div>
        ),
    },
];

function QuickStart({ user }) {
    const [i, setI] = useState(0);
    const step = PREVIEW[i];
    const last = i === PREVIEW.length - 1;
    return (
        <section className="quick" id="hoc-thu">
            <div className="container">
                <div className="quick__box">
                    <div className="quick__copy">
                        <span className="quick__pill">
                            <Icon name="clock" size={14} /> Khởi động nhanh
                        </span>
                        <h2>5 phút để bắt đầu giao tiếp bằng tiếng Mường</h2>
                        <p>Mỗi phút một việc nhỏ. Nghe, nhắc lại và hiểu nghĩa ngay – không cần tài khoản để thử.</p>
                        <ol className="quick__steps">
                            {PREVIEW.map((p, n) => (
                                <li key={p.title}>
                                    <button className={n === i ? 'is-on' : ''} onClick={() => setI(n)} aria-current={n === i ? 'step' : undefined}>
                                        <span className="quick__num">{n + 1}</span>
                                        {p.title}
                                        <small>1 phút</small>
                                    </button>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="quick__card">
                        <div className="quick__tags">
                            <span className="tag tag--sand">
                                Phút {i + 1}/{PREVIEW.length}
                            </span>
                            <span className="quick__tag">{step.tag}</span>
                        </div>
                        <h3>{step.title}</h3>
                        <div className="quick__word">
                            <strong lang="mtq">{step.word}</strong>
                            <span>= {step.meaning}</span>
                            <AudioPlayer text={step.word} label={`Nghe “${step.word}”`} />
                        </div>
                        <p className="quick__tip">
                            <Icon name="bulb" size={16} /> {step.tip}
                        </p>
                        <div className="quick__bar" aria-hidden="true">
                            <span style={{ width: `${((i + 1) / PREVIEW.length) * 100}%` }} />
                        </div>
                        <div className="quick__actions">
                            {last ? (
                                <Button to="/hoc-thu" iconRight="arrow-right">
                                    Làm bài học thử
                                </Button>
                            ) : (
                                <Button onClick={() => setI(i + 1)} iconRight="arrow-right">
                                    Phút tiếp theo
                                </Button>
                            )}
                        </div>
                        <p className="quick__note">
                            <Icon name="info" size={13} /> Âm thanh dùng giọng đọc máy để tham khảo. {user ? '' : 'Đăng ký để lưu tiến độ.'}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function Landing() {
    const { user } = useAuth();
    const totalLessons = STAGES.reduce((n, s) => n + s.lessons.length, 0);

    return (
        <main>
            {/* ───────── Hero ───────── */}
            <section className="hero">
                <div className="hero__glow" aria-hidden="true" />
                <div className="container hero__grid">
                    <div className="hero__copy">
                        <span className="hero__pill">
                            <span className="hero__dot" />
                            Mỗi ngày 5 phút, giao tiếp được ngay
                        </span>
                        <h1 className="hero__title">
                            Học tập ngôn ngữ
                            <br />
                            Kết nối cộng đồng
                        </h1>
                        <p className="hero__lead">
                            Nền tảng học tập và tra cứu tiếng Mường dành cho đội ngũ công chức trẻ. Nghe, nói và dùng được ngay trong công việc.
                        </p>
                        <div className="hero__cta">
                            <Button to="/hoc-thu" size="lg" className="btn--cta" iconRight="arrow-right">
                                Học thử 5 phút
                            </Button>
                            <Button to={user ? '/tong-quan' : '/bai-hoc'} variant="ghost" size="lg">
                                {user ? 'Vào trang học' : 'Khám phá hành trình'}
                            </Button>
                        </div>
                        <p className="hero__hint">
                            <Icon name="tap" size={18} />
                            Thử ngay: chạm vào các từ đang bay trong tranh
                        </p>
                        <dl className="hero__facts">
                            <div>
                                <dt>{STAGES.length}</dt>
                                <dd>chặng học</dd>
                            </div>
                            <div>
                                <dt>{totalLessons}</dt>
                                <dd>bài ngắn</dd>
                            </div>
                            <div>
                                <dt>3</dt>
                                <dd>dạng luyện tập</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="hero__art">
                        <div className="hero__stage">
                            <img className="hero__scene" src="/assets/hero-scene.webp" alt="" width="1400" height="1400" />
                            <img
                                className="hero__mascot"
                                src="/assets/mascot-book.webp"
                                alt="Linh vật ếch MUONGLAB đội khăn trắng, ôm cuốn sách"
                                width="900"
                                height="1371"
                            />
                            {HERO_WORDS.map((v) => (
                                <WordChip key={v.id} word={v.word} meaning={v.meaning} className="hero__chip" style={CHIP_LAYOUT[v.id]} />
                            ))}
                        </div>
                    </div>
                </div>
                <a href="#tinh-nang" className="hero__scroll" aria-label="Cuộn xuống để xem thêm">
                    <Icon name="chevron-down" size={22} />
                </a>
            </section>

            {/* ───────── Feature strip ───────── */}
            <section className="container" id="tinh-nang">
                <ul className="features">
                    {FEATURES.map((f) => (
                        <li key={f.title}>
                            <span className="features__icon">
                                <Icon name={f.icon} size={18} />
                            </span>
                            <span>
                                <strong>{f.title}</strong>
                                <small>{f.text}</small>
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            <QuickStart user={user} />

            {/* ───────── Method ───────── */}
            <section className="method">
                <div className="container">
                    <div className="lp-head lp-head--left">
                        <span className="eyebrow">Phương pháp</span>
                        <h2>Mỗi bài học, ba bước từ nghe đến nói</h2>
                        <p>Ba dạng bài lặp lại ở mọi bài với chủ đề và độ khó tăng dần. Đạt từ 80% là mở khoá bài tiếp theo.</p>
                    </div>
                    <ol className="method__grid">
                        {METHOD.map((m) => (
                            <li key={m.n} className="method__card">
                                {m.demo}
                                <span className="method__n">{m.n}</span>
                                <h3>{m.title}</h3>
                                <p>{m.text}</p>
                            </li>
                        ))}
                    </ol>
                    <ul className="method__extras">
                        <li>
                            <Icon name="refresh" size={18} /> Câu làm sai tự vào danh sách ôn tập ngắt quãng
                        </li>
                        <li>
                            <Icon name="bookmark" size={18} /> Lưu từ, câu vào sổ tay và ôn bằng thẻ ghi nhớ
                        </li>
                        <li>
                            <Icon name="flame" size={18} /> Mục tiêu mỗi ngày và chuỗi ngày học liên tiếp
                        </li>
                    </ul>
                </div>
            </section>

            {/* ───────── Journey ───────── */}
            <section className="lp-journey" id="hanh-trinh">
                <div className="container">
                    <div className="lp-head">
                        <span className="eyebrow">Lộ trình</span>
                        <h2>
                            {STAGES.length} chặng, {totalLessons} bài học
                        </h2>
                        <p>Mỗi bài chỉ khoảng năm phút. Học xong chặng nào, dùng được ngay chặng đó.</p>
                    </div>
                    <ol className="lp-stages">
                        {STAGES.map((s) => (
                            <li key={s.id} className={`lp-stage lp-stage--${s.tone}`}>
                                <span className="lp-stage__num">{s.code}</span>
                                <div>
                                    <h3>{s.title}</h3>
                                    <p>{s.summary}</p>
                                    <span className="lp-stage__meta">{s.lessons.length} bài học</span>
                                </div>
                            </li>
                        ))}
                    </ol>
                    <div className="lp-journey__cta">
                        <Button to="/bai-hoc" variant="green" iconRight="arrow-right">
                            Khám phá hành trình
                        </Button>
                    </div>
                </div>
                <div className="lp-journey__art" aria-hidden="true">
                    <img src="/assets/journey-landscape.webp" alt="" loading="lazy" />
                    <img className="lp-journey__path" src="/assets/journey-path.webp" alt="" loading="lazy" />
                </div>
            </section>

            {/* ───────── CTA ───────── */}
            <section className="container">
                <div className="lp-cta">
                    <div>
                        <h2>Sẵn sàng nói câu tiếng Mường đầu tiên?</h2>
                        <p>Tạo tài khoản miễn phí để lưu tiến độ, ôn lại câu sai và mở khoá cả ba chặng.</p>
                        <div className="lp-cta__actions">
                            <Button to={user ? '/tong-quan' : '/dang-ky'} size="lg" iconRight="arrow-right">
                                {user ? 'Tiếp tục học' : 'Đăng ký miễn phí'}
                            </Button>
                            <Button to="/hoc-thu" variant="light" size="lg">
                                Học thử trước
                            </Button>
                        </div>
                    </div>
                    <img src="/assets/mascot-cheer.webp" alt="" className="lp-cta__mascot" loading="lazy" />
                </div>
            </section>
        </main>
    );
}
