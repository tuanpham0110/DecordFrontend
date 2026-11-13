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
│   ├── lib/                 prisma, jwt, mailer, logger, thời gian, http helper
│   ├── middleware/          xác thực, giới hạn tần suất, lỗi
│   └── modules/
│       ├── auth/            đăng ký, đăng nhập, OTP, đặt lại mật khẩu
│       ├── content/         nội dung công khai + bài học thử (cache 60s)
│       ├── learning/        rules.js (luật thuần) · state.js · service · routes
│       ├── review/          ôn tập ngắt quãng (Leitner)
│       ├── notebook/        sổ tay
│       ├── ai/              proxy Gemini (stream SSE)
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
| GET | `/api/meta` | tính năng nào đang bật `{ ai, aiModel, speech, mail }` |
| POST | `/api/auth/register` | `{ name, email, password }` → gửi OTP |
| POST | `/api/auth/login` | `{ email, password, remember }` → `{ token, user }` |
| POST | `/api/auth/otp/verify` | `{ email, purpose: verify\|reset, code }` |
| POST | `/api/auth/otp/resend` | `{ email, purpose }` |
| POST | `/api/auth/password/forgot` | `{ email }` |
| POST | `/api/auth/password/reset` | `{ resetToken, password }` |
| GET | `/api/auth/me` | người dùng hiện tại |
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
| POST | `/api/ai/chat` | `{ messages: [{ role, text }] }` → stream SSE của Gemini |
| POST | `/api/speech/assess` | multipart `audio`, `itemId` → `{ score, transcript?, words? }` |

## Bảo mật đã có

Mật khẩu băm bcrypt · OTP 6 số băm HMAC, hết hạn 10 phút, tối đa 5 lần sai, chờ 60s mới gửi lại ·
"Quên mật khẩu" không tiết lộ email có tồn tại hay không · JWT ký bằng `JWT_SECRET` · Helmet · CORS giới hạn origin ·
giới hạn tần suất (đăng nhập, API, AI) · Zod kiểm tra mọi input · key Gemini chỉ ở server · bản ghi âm không ghi ra đĩa.

## Đưa lên production

1. Tạo PostgreSQL (VD: Supabase, Neon, Railway hoặc VPS), đặt `DATABASE_URL`.
2. `NODE_ENV=production`, `JWT_SECRET` mới, `CORS_ORIGIN=https://tên-miền-frontend`, `TRUST_PROXY=true` nếu sau Nginx.
3. `npm ci && npm run db:deploy && npm run db:seed && npm start` (hoặc dùng pm2 / Docker).
4. Frontend: đặt `VITE_API_URL=https://tên-miền-api/api` khi build.

Hạn chế hiện tại: giới hạn lượt AI/ngày lưu trong RAM (mất khi khởi động lại; nhiều server thì nên chuyển sang Redis);
token đăng nhập chưa có cơ chế thu hồi (đăng xuất chỉ xoá token ở trình duyệt).
