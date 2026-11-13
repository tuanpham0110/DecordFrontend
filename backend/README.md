# MUONGLAB API

Node.js 20+ · Express 4 · Prisma 6 · PostgreSQL 16 · JWT · Zod · Nodemailer.

## Cấu trúc

```
backend/
├── prisma/
│   ├── schema.prisma        bảng dữ liệu
│   ├── migrations/          lịch sử thay đổi CSDL
│   ├── seed.js              nạp nội dung + tài khoản demo (npm run db:seed)
│   └── data/content.js      nội dung khoá học (nguồn để seed)
├── src/
│   ├── server.js            khởi động, tắt an toàn
│   ├── app.js               express app: bảo mật, CORS, route, xử lý lỗi
│   ├── config/env.js        đọc + kiểm tra biến môi trường
│   ├── lib/                 prisma, jwt, mailer, google (xác minh ID token), logger, thời gian, http helper
│   ├── middleware/          xác thực, giới hạn tần suất, lỗi
│   └── modules/
│       ├── auth/            đăng ký, đăng nhập (email / Google), OTP, đặt lại mật khẩu, quản lý tài khoản
│       ├── content/         nội dung công khai + bài học thử (cache 60s)
│       ├── learning/        rules.js (luật thuần) · state.js · service · routes
│       ├── review/          ôn tập ngắt quãng (Leitner)
│       ├── notebook/        sổ tay
│       ├── ai/              proxy Gemini (stream SSE, tự chuyển model dự phòng, hạn mức/ngày trong DB)
│       └── speech/          proxy dịch vụ chấm phát âm
└── test/api.e2e.test.js     test end-to-end
```

## Lệnh

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | chạy API, tự khởi động lại khi sửa code |
| `npm start` | chạy production |
| `npm run db:up` | bật PostgreSQL bằng Docker |
| `npm run db:migrate` | tạo migration mới sau khi sửa `schema.prisma` |
| `npm run db:deploy` | áp migration (production) |
| `npm run db:seed` | nạp lại nội dung (giữ nguyên tiến độ người học) |
| `npm run db:studio` | xem / sửa dữ liệu trên giao diện web |
| `npm test` | test end-to-end (tạo rồi xoá user tạm) |

## Luật học (thực thi ở server)

- Điểm bài = câu **Bắc âm cầu + Lắp khung câu đúng ngay lần đầu** / tổng số câu đó. Shadowing chỉ ghi nhận "đã thực hành".
- Đạt **≥ `PASS_THRESHOLD`%** (mặc định 80) mới mở bài tiếp theo.
- **Khoá chặng:** chặng sau mở khi chặng trước xong **100%** bài đã xuất bản. Chặng chưa có nội dung không bao giờ "xong",
  nên các chặng sau vẫn khoá. Vi phạm → `403 { code: "stage-locked" }`.
- Đáp án / giải thích **không bao giờ** gửi xuống trước khi người học trả lời.
- Câu sai, câu chưa làm, Shadowing "Cần luyện thêm" → thẻ ôn tập (ôn ngay → 1 → 3 → 7 ngày → thuộc).

## API

Mọi lỗi trả về `{ message, code?, field? }`. Route `/api/me/*`, `/api/ai/*`, `/api/speech/*` cần `Authorization: Bearer <token>`.

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/api/health` | trạng thái API + CSDL |
| GET | `/api/meta` | tính năng nào đang bật `{ ai, aiModel, speech, mail, emailVerification, passwordReset, googleClientId }` |
| POST | `/api/auth/register` | `{ name, email, password }` → gửi OTP. Khi không cần xác thực email (production chưa có SMTP) trả luôn `session: { token, user }` |
| POST | `/api/auth/login` | `{ email, password, remember }` → `{ token, user }` |
| POST | `/api/auth/google` | `{ credential }` (ID token của Google Identity Services) → `{ token, user }`; tạo tài khoản ở lần đầu |
| POST | `/api/auth/otp/verify` | `{ email, purpose: verify\|reset, code }` → verify: `{ token, user }` (đăng nhập luôn) · reset: `{ resetToken }` |
| POST | `/api/auth/otp/resend` | `{ email, purpose }` |
| POST | `/api/auth/password/forgot` | `{ email }` |
| POST | `/api/auth/password/reset` | `{ resetToken, password }` |
| GET | `/api/auth/me` | hồ sơ `{ id, name, email, createdAt, hasPassword, google, verified, dailyGoal }` |
| PATCH | `/api/auth/me` | đổi tên `{ name }` |
| POST | `/api/auth/password/change` | `{ currentPassword, newPassword }` → `{ token, user }` mới; các phiên cũ bị đăng xuất |
| DELETE | `/api/auth/me` | `{ password }` (hoặc `{ confirmEmail }` với tài khoản chỉ dùng Google) → xoá tài khoản + toàn bộ dữ liệu |
| GET | `/api/content/summary` · `/vocabulary` · `/handbook` | dữ liệu công khai |
| GET / POST | `/api/content/trial` · `/trial/answers` | bài học thử (không lưu) |
| GET | `/api/me/overview` | tổng quan, chặng, thống kê, huy hiệu |
| GET | `/api/me/stages/:id` · `/api/me/lessons/:id` | chi tiết chặng / bài |
| POST | `/api/me/lessons/:id/session` | mở / tiếp tục bài |
| PATCH | `/api/me/lessons/:id/session/step` | lưu vị trí `{ step }` |
| POST | `/api/me/lessons/:id/session/answers` | `{ itemId, response }` → chấm |
| POST | `/api/me/lessons/:id/session/shadow` | `{ itemId, rating }` |
| POST | `/api/me/lessons/:id/session/finish` | kết quả, mở khoá, `stageTransition` |
| DELETE | `/api/me/lessons/:id/session` | học lại từ đầu |
| PUT | `/api/me/goal` | `{ goal: 5\|10\|20\|30 }` |
| GET | `/api/me/history` | lịch sử làm bài |
| GET | `/api/me/review` · `/review/queue?scope=due\|all&items=a,b` | ôn tập |
| POST | `/api/me/review/answers` | `{ itemId, response }` |
| GET / POST | `/api/me/notebook` · `/notebook/catalog` | sổ tay |
| DELETE | `/api/me/notebook/:entryId` | bỏ lưu |
| POST | `/api/me/notebook/:entryId/favorite` · `/review` | yêu thích / lật thẻ |
| POST | `/api/ai/chat` | `{ messages: [{ role, text }] }` → stream SSE của Gemini (header `X-AI-Model` cho biết model đã trả lời). Lỗi: `ai-busy` (mọi model quá tải), `ai-quota`, `ai-key`, `ai-model` |
| POST | `/api/speech/assess` | multipart `audio`, `itemId` → `{ score, transcript?, words?, comment?, engine: 'ai'\|'native' }` |
| POST | `/api/auth/microsoft` | `{ idToken }` (MSAL) → `{ token, user }`; không gộp vào tài khoản mật khẩu có sẵn cùng email |
| GET / POST | `/api/me/support` · `/support/unread` | hội thoại của người học với quản trị viên |
| GET | `/api/admin/overview` · `/admin/users?q=&page=` | (admin) số liệu, danh sách người dùng |
| PATCH / DELETE | `/api/admin/users/:id` | (admin) `{ role }` · xoá tài khoản (không áp dụng với chính mình / admin khác) |
| GET / POST | `/api/admin/support` · `/admin/support/:userId` | (admin) hộp thư hỗ trợ, trả lời |

## Bảo mật đã có

Mật khẩu băm bcrypt · OTP 6 số băm HMAC, hết hạn 10 phút, tối đa 5 lần sai, chờ 60s mới gửi lại ·
"Quên mật khẩu" không tiết lộ email có tồn tại hay không · JWT ký bằng `JWT_SECRET` · Helmet · CORS giới hạn origin ·
giới hạn tần suất (đăng nhập, API, AI) · Zod kiểm tra mọi input · key Gemini chỉ ở server · bản ghi âm không ghi ra đĩa ·
đổi / đặt lại mật khẩu thu hồi mọi token cũ (`User.passwordChangedAt`) và token đặt lại mật khẩu chỉ dùng được một lần ·
ID token Google được kiểm tra chữ ký (JWKS), `aud`, `iss`, hạn dùng và `email_verified`.

## Đưa lên production

Bản đang chạy dùng **Vercel (serverless) + Neon** – xem mục *Deploy* ở [README gốc](../README.md). Tự host trên máy chủ riêng:

1. Tạo PostgreSQL (VD: Neon, Supabase, Railway hoặc VPS), đặt `DATABASE_URL`.
2. `NODE_ENV=production`, `JWT_SECRET` mới, `CORS_ORIGIN=https://tên-miền-frontend`, `TRUST_PROXY=true` nếu sau Nginx.
3. `npm ci && npm run db:deploy && npm run db:seed && npm start` (hoặc dùng pm2 / Docker).
4. Frontend: đặt `VITE_API_URL=https://tên-miền-api/api` khi build.

Hạn chế hiện tại: giới hạn tần suất (rate limit) đếm trong bộ nhớ từng instance nên trên serverless chỉ mang tính tương đối
(hạn mức AI/ngày thì lưu trong DB nên chính xác); đăng xuất chỉ xoá token ở trình duyệt (token bị thu hồi khi đổi mật khẩu);
production chưa cấu hình SMTP thì email chưa được xác thực khi đăng ký.
