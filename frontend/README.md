# MUONGLAB – Frontend

React 18 + Vite + React Router. Không dùng UI library; design system nằm trong `src/styles/tokens.css`.

```bash
npm install
npm run dev      # http://localhost:5173 – cần backend chạy ở :4000 (xem ../README.md)
npm run build
```

Mọi dữ liệu lấy từ backend qua `src/services/api.js` (đáp án bài tập không còn nằm ở trình duyệt).
Khi dev, Vite chuyển tiếp `/api` sang `http://localhost:4000` (`vite.config.js`). Khi deploy khác domain, đặt
`VITE_API_URL` (xem `.env.example`).

## Luồng học

Trang chủ → Học thử (`/hoc-thu`, không cần tài khoản) → Đăng nhập/Đăng ký (OTP qua email)
→ Tổng quan (có thanh tìm kiếm Ctrl+K) → Hành trình → Chặng → Bài → **Trình học** (`/hoc/:id`):
Giới thiệu → Bắc âm cầu → Lắp khung câu → Shadowing (ghi âm, nghe lại, so sánh % với người bản địa khi backend bật) → Kết quả
(và màn hình chuyển chặng khi xong 100% một chặng). Trợ lý AI "Ếch Mường" ở góc phải màn hình sau khi đăng nhập.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `src/services/api.js` | HTTP client: token, lỗi chuẩn hoá `{ message, status, code, field }`, mọi endpoint |
| `src/services/trial.js` | Adapter học thử (chấm ở server, không lưu) |
| `src/services/ai/tutor.js` | Gọi `/api/ai/chat`, đọc stream |
| `src/services/speech/assessment.js` | Gửi bản ghi tới `/api/speech/assess` |
| `src/hooks/` | `useAsync`, `useMeta` (tính năng server đang bật), `usePlayback`, `useRecorder` |
| `src/components/` | `ChatBox`, `GlobalSearch`, `learn/*` (bài tập), `ui.jsx` |
| `src/pages/` | Landing, Auth, Tổng quan, Hành trình, Chặng, Bài, `LessonPlayer`, Ôn luyện, Sổ tay, Cẩm nang |
| `src/styles/` | `tokens`, `components`, `layout`, `landing*`, `pages`, `app`, `learn`, `auth`, `features` |

## Âm thanh & nội dung

- **Chưa có bản thu giọng người Mường.** Câu không có `audioUrl` dùng giọng đọc máy tiếng Việt của trình duyệt và ghi rõ
  "giọng đọc máy – tham khảo".
- Nội dung tiếng Mường được quản lý ở `backend/prisma/data/content.js` – không thêm từ/câu khi chưa có nguồn kiểm chứng.
