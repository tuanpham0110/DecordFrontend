# MUONGLAB – Frontend

React 18 + Vite + React Router. Không dùng UI library; design system nằm trong `src/styles/tokens.css`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

Tài khoản dùng thử: `demo@muonglab.vn` / `muonglab123` · Mã OTP dùng thử: `123456`
(gợi ý này chỉ hiển thị ở chế độ dev).

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `src/styles/` | `tokens.css` (màu, chữ, spacing, radius, shadow), `components.css`, `layout.css`, `landing.css`, `pages.css` |
| `src/components/` | `Icon` (bộ icon nét thống nhất), `ui.jsx` (Button, TextField, Checkbox, Progress, Ring, Empty/Error/Skeleton, Logo), `Modal`, `WordChip` |
| `src/layouts/` | `PublicLayout` (header công khai), `AppLayout` (sidebar + topbar), `AuthLayout` |
| `src/pages/` | Landing, Học thử, Đăng nhập / Đăng ký / Quên mật khẩu / OTP / Đặt lại mật khẩu, Tổng quan, Bài học, Chặng, Bài, Ôn luyện, Sổ tay, Cẩm nang |
| `src/services/api.js` | **Lớp API giả lập** – mọi dữ liệu UI đều đi qua đây |
| `src/data/content.js` | Nội dung khởi tạo cho API giả lập |
| `public/assets/` | Ảnh trích xuất từ file Figma (mascot, phong cảnh, logo) |

## Kết nối backend

Chưa có backend. Khi có API thật, chỉ cần thay phần thân các hàm trong `src/services/api.js`
(`auth.*`, `learning.*`) – giữ nguyên chữ ký hàm và dạng lỗi `{ message, field? }`. Không cần sửa trang nào.

Từ vựng tiếng Mường trong `content.js` chỉ gồm 5 từ có trong thiết kế (ếm, mốch, hal, pa, pổn).
Tên bài học, mô tả cẩm nang là nội dung giữ chỗ cần đội ngũ nội dung xác nhận.
