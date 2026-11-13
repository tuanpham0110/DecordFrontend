import { Link } from 'react-router-dom';
import { Button } from '../components/ui.jsx';
import { CONTACT_EMAIL } from '../data/contact.js';

const UPDATED = '14/11/2026';

function LegalPage({ title, lead, children }) {
    return (
        <main className="container legal" id="main">
            <article className="article-page">
                <header>
                    <p className="muted small">Cập nhật lần cuối: {UPDATED}</p>
                    <h1>{title}</h1>
                    <p className="article-page__lead">{lead}</p>
                </header>
                <div className="prose">{children}</div>
                <footer className="article-page__foot">
                    <Button to="/" variant="light" iconLeft="arrow-left">
                        Về trang chủ
                    </Button>
                    <Button to="/dang-ky" variant="green" iconRight="arrow-right">
                        Tạo tài khoản
                    </Button>
                </footer>
            </article>
        </main>
    );
}

export function Terms() {
    return (
        <LegalPage title="Điều khoản sử dụng" lead="Những quy định khi bạn dùng MUONGLAB – nền tảng học và tra cứu tiếng Mường dành cho đội ngũ công chức trẻ.">
            <h3>1. Dịch vụ</h3>
            <p>
                MUONGLAB cung cấp các bài học ngắn, công cụ ôn luyện, sổ tay từ vựng, cẩm nang và trợ lý AI để hỗ trợ việc học tiếng Mường. Dịch vụ được cung cấp
                miễn phí cho mục đích học tập và có thể thay đổi, bổ sung nội dung theo thời gian.
            </p>

            <h3>2. Tài khoản</h3>
            <ul>
                <li>Bạn cần cung cấp họ tên và email chính xác khi đăng ký, và tự giữ bí mật mật khẩu của mình.</li>
                <li>Mỗi tài khoản dùng cho một người học. Tiến độ, kết quả và sổ tay gắn với tài khoản đó.</li>
                <li>Bạn có thể đổi tên, đổi mật khẩu hoặc xoá tài khoản bất cứ lúc nào trong mục Tài khoản.</li>
            </ul>

            <h3>3. Nội dung học</h3>
            <ul>
                <li>Từ vựng và câu mẫu tiếng Mường trong chương trình do đội ngũ chuyên môn biên soạn và kiểm chứng trước khi đăng.</li>
                <li>Tiếng Mường có nhiều phương ngữ; cách nói ở từng vùng có thể khác với nội dung trong bài.</li>
                <li>Giọng đọc máy (khi chưa có bản thu của người bản địa) chỉ mang tính tham khảo.</li>
            </ul>

            <h3>4. Trợ lý AI</h3>
            <p>
                Trợ lý “Ếch Mường” dùng mô hình ngôn ngữ của bên thứ ba và có thể trả lời chưa chính xác. Với từ hoặc câu tiếng Mường không nằm trong dữ liệu đã kiểm
                chứng, hãy coi câu trả lời là gợi ý và hỏi lại người bản địa. Không nhập thông tin cá nhân nhạy cảm hoặc tài liệu công vụ vào khung trò chuyện.
            </p>

            <h3>5. Sử dụng hợp lý</h3>
            <ul>
                <li>Không dùng công cụ tự động để gửi yêu cầu hàng loạt, dò mật khẩu hoặc làm gián đoạn dịch vụ.</li>
                <li>Không sao chép nội dung bài học để phân phối lại cho mục đích thương mại khi chưa được đồng ý.</li>
            </ul>

            <h3>6. Giới hạn trách nhiệm</h3>
            <p>
                MUONGLAB là công cụ hỗ trợ học tập. Chúng tôi cố gắng giữ dịch vụ ổn định và nội dung chính xác nhưng không cam kết dịch vụ luôn sẵn sàng hoặc không có
                sai sót. Kết quả luyện tập trên MUONGLAB không thay thế cho việc đánh giá năng lực ngôn ngữ chính thức.
            </p>

            <h3>7. Thay đổi điều khoản</h3>
            <p>
                Khi điều khoản thay đổi, bản mới sẽ được đăng tại trang này kèm ngày cập nhật. Việc tiếp tục sử dụng dịch vụ đồng nghĩa với việc bạn chấp nhận bản
                điều khoản mới. Xem thêm <Link to="/bao-mat" className="link">Chính sách bảo mật</Link>.
            </p>

            <h3>8. Liên hệ</h3>
            <p>
                Mọi thắc mắc về dịch vụ, xin gửi về{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="link">
                    {CONTACT_EMAIL}
                </a>{' '}
                hoặc nhắn cho quản trị viên trong mục Hỗ trợ sau khi đăng nhập.
            </p>
        </LegalPage>
    );
}

export function Privacy() {
    return (
        <LegalPage title="Chính sách bảo mật" lead="MUONGLAB chỉ thu thập những dữ liệu cần để lưu tiến độ học của bạn, và bạn có thể xoá chúng bất cứ lúc nào.">
            <h3>1. Dữ liệu chúng tôi lưu</h3>
            <ul>
                <li>
                    <strong>Tài khoản:</strong> họ tên, email và mật khẩu (chỉ lưu ở dạng đã băm, không ai đọc được mật khẩu gốc).
                </li>
                <li>
                    <strong>Việc học:</strong> bài đã làm, điểm số, câu trả lời trong bài đang học dở, danh sách câu cần ôn, sổ tay, mục tiêu và số câu luyện mỗi ngày.
                </li>
                <li>
                    <strong>Trợ lý AI:</strong> số lượt hỏi mỗi ngày (để giới hạn lượt dùng). Nội dung trò chuyện không được lưu trên máy chủ MUONGLAB; nó chỉ nằm
                    trong trình duyệt của bạn cho tới khi bạn đóng tab hoặc đăng xuất.
                </li>
            </ul>

            <h3>2. Ghi âm khi luyện nói</h3>
            <p>
                Bản ghi âm ở phần Shadowing được giữ trong trình duyệt để bạn nghe lại và tự so sánh. Bản ghi chỉ được gửi lên máy chủ khi bạn chủ động bấm nút chấm
                phát âm; khi đó nó được chuyển tới mô hình Google Gemini để chép lại những gì nghe được, và không được lưu lại sau khi chấm.
            </p>

            <h3>3. Bên thứ ba</h3>
            <ul>
                <li>Câu hỏi bạn gửi cho trợ lý AI được chuyển tới dịch vụ mô hình ngôn ngữ Google Gemini để tạo câu trả lời.</li>
                <li>Nếu bạn đăng nhập bằng Google, chúng tôi nhận từ Google họ tên và email đã xác minh của bạn – không nhận mật khẩu Google.</li>
                <li>Email xác thực và đặt lại mật khẩu được gửi qua dịch vụ thư điện tử của hệ thống.</li>
                <li>Chúng tôi không bán và không chia sẻ dữ liệu của bạn cho mục đích quảng cáo.</li>
            </ul>

            <h3>4. Lưu trên thiết bị của bạn</h3>
            <p>
                MUONGLAB không dùng cookie theo dõi. Trình duyệt chỉ lưu phiên đăng nhập, tốc độ phát âm thanh bạn chọn và cuộc trò chuyện AI hiện tại (bộ nhớ cục bộ
                của trình duyệt).
            </p>

            <h3>5. Quyền của bạn</h3>
            <ul>
                <li>Xem và sửa họ tên, đổi mật khẩu trong mục Tài khoản.</li>
                <li>Xoá tài khoản: toàn bộ hồ sơ, tiến độ, danh sách ôn tập và sổ tay bị xoá vĩnh viễn ngay lập tức.</li>
            </ul>

            <h3>6. Bảo vệ dữ liệu</h3>
            <p>
                Kết nối tới MUONGLAB được mã hoá (HTTPS). Mã xác thực gửi qua email có hiệu lực trong thời gian ngắn và bị khoá sau nhiều lần nhập sai. Khi bạn đổi
                hoặc đặt lại mật khẩu, mọi phiên đăng nhập cũ đều bị đăng xuất.
            </p>

            <h3>7. Liên hệ</h3>
            <p>
                Nếu có câu hỏi về dữ liệu cá nhân, hãy viết cho quản trị viên MUONGLAB qua{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="link">
                    {CONTACT_EMAIL}
                </a>
                , hoặc nhắn trong mục Hỗ trợ sau khi đăng nhập. Xem thêm <Link to="/dieu-khoan" className="link">Điều khoản sử dụng</Link>.
            </p>
        </LegalPage>
    );
}
