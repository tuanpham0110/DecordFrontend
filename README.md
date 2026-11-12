# MUONGLAB – Frontend

React 18 + Vite + React Router. Không dùng UI library; design system nằm trong `src/styles/tokens.css`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

Tài khoản dùng thử: `demo@muonglab.vn` / `muonglab123` · Mã OTP dùng thử: `123456`
(gợi ý này chỉ hiển thị ở chế độ dev).

## Luồng học

Trang chủ → Học thử (không cần tài khoản, `/hoc-thu`) → Đăng nhập/Đăng ký (quay lại đúng trang đang xem)
→ Tổng quan → Hành trình → Chặng → Bài → **Trình học** (`/hoc/:id`):
Giới thiệu → Bắc âm cầu (nghe & chọn) → Lắp khung câu (điền / sắp xếp) → Shadowing (ghi âm, nghe lại, tự đánh giá) → Kết quả.

Quy tắc (thực thi ở `src/services/server/engine.js`, không ở giao diện):

- Điểm bài = số câu **Bắc âm cầu + Lắp khung câu trả lời đúng ngay lần đầu** / tổng số câu đó.
  Shadowing không tính điểm, chỉ ghi nhận "đã thực hành" (theo thiết kế: "Luyện nói: Đã thực hành").
- Đạt **≥ 80%** (`PASS_THRESHOLD` trong `content.js`) mới mở khoá bài tiếp theo. Bài bị khoá bị từ chối ở lớp server (`403`).
- Bài chưa có nội dung (`published: false`) hiển thị "Đang biên soạn" và **không chặn** chuỗi mở khoá.
- Câu sai / Shadowing tự đánh giá "Cần luyện thêm" → danh sách ôn tập ngắt quãng (Leitner: ôn ngay → 1 → 3 → 7 ngày → thuộc).
- Tiến độ từng câu được lưu tự động; mở lại bài sẽ tiếp tục đúng câu đang dừng.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `src/data/content.js` | Chặng, bài, ngân hàng câu hỏi, từ vựng, câu mẫu, cẩm nang |
| `src/services/server/` | **Server giả lập**: chấm điểm, mở khoá, phiên học, ôn tập SRS, sổ tay, mục tiêu ngày – lưu theo từng tài khoản (localStorage) |
| `src/services/api.js` | Lớp API mà giao diện gọi (độ trễ, timeout, chuẩn hoá lỗi `{ message, status, code, field }`) |
| `src/services/trial.js` | Adapter học thử không lưu dữ liệu |
| `src/services/speech/assessment.js` | Điểm tích hợp đánh giá phát âm (hiện **chưa có** – xem dưới) |
| `src/hooks/` | `usePlayback` (phát audio / giọng đọc máy), `useRecorder` (micro, giải phóng MediaStream), `useAsync` |
| `src/components/learn/` | `AudioPlayer`, `Exercises` (nghe, điền, sắp xếp), `ShadowExercise`, `ExerciseStage`, `Flashcards`, `SpeakButton` |
| `src/pages/` | Landing, Auth, Tổng quan, Hành trình, Chặng, Bài, `LessonPlayer`, Ôn luyện, `ReviewSession`, Sổ tay, Cẩm nang |
| `src/styles/` | `tokens`, `components`, `layout`, `landing`, `landing-v2`, `pages`, `app`, `learn` |

## Kết nối backend

Chưa có backend. Mỗi hàm trong `src/services/server/engine.js` tương ứng 1 endpoint; khi có API thật,
thay thân hàm trong `api.js` bằng `fetch` – giữ nguyên chữ ký và dạng lỗi, không cần sửa trang.
Lưu ý: hiện "server" chạy trong trình duyệt nên việc khoá bài / ẩn đáp án chỉ mang tính kiến trúc;
bảo mật thật chỉ có khi chuyển logic này lên máy chủ.

## Nội dung & âm thanh – những điều cần biết

- Tiếng Mường trong `content.js` **chỉ** gồm nội dung có trong file thiết kế: ếm, mốch, hal, pa, pổn, con cúi,
  mặt tlăng và câu "Nhà ja chiếm từ con cúi chẵng?". Các từ minh / ấm / hướng / làng / rọng / cổ lại chỉ dùng làm
  phương án nhiễu vì chưa có nghĩa đã xác minh. Không thêm từ/câu khi chưa có nguồn kiểm chứng.
- Bài 1, 2, 4, 5 có nội dung; bài 3 và chặng 2–3 đang chờ đội ngũ nội dung biên soạn.
- **Chưa có bản thu giọng người Mường.** Khi một câu không có `audioUrl`, trình phát dùng giọng đọc máy tiếng Việt
  của trình duyệt và ghi rõ là "giọng đọc máy – tham khảo". Thêm `audioUrl` vào câu hỏi để dùng bản thu thật.
- **Chưa có công nghệ nhận diện / chấm phát âm tiếng Mường.** Shadowing dùng tự đánh giá; bản ghi chỉ ở trong trình duyệt,
  không tải lên máy chủ. Tích hợp dịch vụ thật tại `src/services/speech/assessment.js`.
