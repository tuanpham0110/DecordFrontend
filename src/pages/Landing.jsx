import { Button } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import WordChip from '../components/WordChip.jsx';
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

const PILLARS = [
    { icon: 'book', title: 'Bài học', text: '14 bài ngắn chia theo 3 chặng, đi từ làm quen đến dùng trong công việc.' },
    { icon: 'target', title: 'Ôn luyện', text: 'Thẻ ghi nhớ và câu hỏi nhanh giúp từ mới ở lại lâu hơn.' },
    { icon: 'notebook', title: 'Sổ tay', text: 'Tra cứu từ vựng Mường – Việt ngay khi cần, cả khi đang đi cơ sở.' },
    { icon: 'guide', title: 'Cẩm nang', text: 'Mẹo phát âm, xưng hô và mẫu câu cho các tình huống công vụ.' },
];

export default function Landing() {
    const { user } = useAuth();

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
                            Nền tảng học tập và tra cứu tiếng Mường dành cho đội ngũ công chức trẻ. Nghe, nói và dùng được ngay
                            trong công việc.
                        </p>
                        <div className="hero__cta">
                            <Button to="/hoc-thu" size="lg" className="btn--cta" iconRight="arrow-right">
                                Học thử 5 phút
                            </Button>
                            {!user && (
                                <Button to="/dang-nhap" variant="ghost" size="lg">
                                    Tôi đã có tài khoản
                                </Button>
                            )}
                        </div>
                        <p className="hero__hint">
                            <Icon name="tap" size={18} />
                            Thử ngay: chạm vào các từ đang bay trong tranh
                        </p>
                        <div className="hero__proof">
                            <div className="hero__faces" aria-hidden="true">
                                {['#f0ae62', '#93b25f', '#6f93cc', '#4ca52a'].map((c) => (
                                    <span key={c} style={{ background: c }}>
                                        <Icon name="user" size={14} strokeWidth={2.2} />
                                    </span>
                                ))}
                            </div>
                            <p>
                                <strong>5.000+ người học</strong> đã cùng MUONGLAB luyện tiếng Mường
                            </p>
                        </div>
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
                            {VOCABULARY.map((v) => (
                                <WordChip key={v.id} word={v.word} meaning={v.meaning} className="hero__chip" style={CHIP_LAYOUT[v.id]} />
                            ))}
                        </div>
                    </div>
                </div>
                <a href="#hanh-trinh" className="hero__scroll" aria-label="Cuộn xuống để xem thêm">
                    <Icon name="chevron-down" size={22} />
                </a>
            </section>

            {/* ───────── Journey ───────── */}
            <section className="lp-journey" id="hanh-trinh">
                <div className="container">
                    <div className="lp-head">
                        <span className="eyebrow">Lộ trình</span>
                        <h2>Ba chặng, mười bốn bài học</h2>
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
                </div>
                <div className="lp-journey__art" aria-hidden="true">
                    <img src="/assets/journey-landscape.webp" alt="" loading="lazy" />
                    <img className="lp-journey__path" src="/assets/journey-path.webp" alt="" loading="lazy" />
                </div>
            </section>

            {/* ───────── Pillars ───────── */}
            <section className="lp-pillars">
                <div className="container">
                    <div className="lp-head lp-head--left">
                        <span className="eyebrow">Học gì trên MUONGLAB</span>
                        <h2>Đủ để bắt đầu, gọn để duy trì</h2>
                    </div>
                    <div className="lp-pillars__grid">
                        {PILLARS.map((p) => (
                            <div key={p.title} className="lp-pillar">
                                <span className="icon-badge icon-badge--sm">
                                    <Icon name={p.icon} size={18} />
                                </span>
                                <h3>{p.title}</h3>
                                <p>{p.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ───────── CTA ───────── */}
            <section className="container">
                <div className="lp-cta">
                    <div>
                        <h2>Sẵn sàng nói câu tiếng Mường đầu tiên?</h2>
                        <p>Tạo tài khoản miễn phí để lưu tiến độ và mở khoá cả ba chặng.</p>
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
