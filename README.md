# MUONGLAB

Nền tảng học tiếng Mường cho công chức trẻ.

```
Project1/
├── frontend/          React 18 + Vite + React Router (giao diện)
├── backend/           Node.js + Express + Prisma + PostgreSQL (API)
├── api/index.js       điểm vào serverless trên Vercel (dùng lại Express app của backend)
├── scripts/           script build cho Vercel
├── vercel.json        cấu hình deploy (frontend tĩnh + /api/* → backend)
├── docker-compose.yml PostgreSQL cho môi trường dev
└── package.json       script tiện dụng chạy cả hai phần
```

## Chạy lần đầu

Yêu cầu: Node.js ≥ 20, Docker Desktop (để chạy PostgreSQL).

```bash
npm run setup                          # cài thư viện cho backend + frontend
cp backend/.env.example backend/.env   # rồi đặt JWT_SECRET (xem hướng dẫn trong file)
npm run db:up                          # bật PostgreSQL (cổng 5434)
npm run db:migrate                     # tạo bảng (áp các migration có sẵn)
npm run db:seed                        # nạp nội dung bài học + tài khoản demo
```

## Chạy hằng ngày (2 cửa sổ terminal)

```bash
npm run db:up      # nếu PostgreSQL chưa chạy
npm run dev:api    # backend  → http://localhost:4000/api
npm run dev:web    # frontend → http://localhost:5173  (tự chuyển /api sang backend)
```

Tài khoản demo: `demo@muonglab.vn` / `muonglab123`.
Chưa cấu hình Gmail SMTP thì mã OTP đăng ký / quên mật khẩu được **in ra cửa sổ chạy backend**.

## Kiểm thử

```bash
npm test           # test end-to-end API (cần PostgreSQL đang chạy)
npm run build      # build frontend
```

## Cấu hình tính năng tuỳ chọn (`backend/.env`)

| Tính năng | Biến | Ghi chú |
| --- | --- | --- |
| Gửi email OTP thật | `SMTP_USER`, `SMTP_PASS` | Gmail → bật xác minh 2 bước → tạo *Mật khẩu ứng dụng*. Chưa cấu hình: dev in mã OTP ra console; production bỏ qua bước OTP khi đăng ký và tắt "Quên mật khẩu" |
| Trợ lý AI "Ếch Mường" | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS` | Key miễn phí tại aistudio.google.com/apikey. Key chỉ nằm ở backend. Model chính quá tải / bị ngừng thì tự chuyển sang các model dự phòng |
| Đăng nhập bằng Google | `GOOGLE_CLIENT_ID` | OAuth Client ID loại *Web application* (Google Cloud Console → Credentials), thêm tên miền frontend vào *Authorized JavaScript origins*. Để trống thì nút Google không hiện |
| So sánh % giọng với người bản địa | `SPEECH_API_URL`, `SPEECH_API_KEY` | Hợp đồng API: xem `backend/src/modules/speech/speech.routes.js` |

## Deploy (Vercel + Neon)

Bản production chạy tại **https://muonglab.vercel.app**: frontend là file tĩnh, backend chạy dạng serverless function
(`api/index.js`), cơ sở dữ liệu PostgreSQL trên Neon (Singapore).

- Mỗi lần `git push` lên `main`, Vercel chạy `scripts/vercel-build.sh`: tạo Prisma Client → áp migration → nạp lại nội dung
  bài học (không đụng dữ liệu người học) → build frontend.
- Biến môi trường đặt ở Vercel → Settings → Environment Variables (Production): `DATABASE_URL` (chuỗi *pooled* của Neon,
  thêm `&pgbouncer=true`), `DIRECT_URL` (chuỗi trực tiếp, dùng cho migration), `JWT_SECRET`, `NODE_ENV=production`,
  `TRUST_PROXY=true`, `CORS_ORIGIN`, `GEMINI_API_KEY`, và các biến tuỳ chọn ở bảng trên. Đổi biến xong phải **Redeploy**.
- Frontend và API cùng tên miền nên không cần `VITE_API_URL`.

Chi tiết: [backend/README.md](backend/README.md) · [frontend/README.md](frontend/README.md)
