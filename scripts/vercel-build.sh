#!/usr/bin/env bash
# Build trên Vercel: Prisma client → (production) migrate + nạp nội dung → frontend.
set -euo pipefail

cd backend
npx prisma generate

if [ "${VERCEL_ENV:-}" = "production" ]; then
    # Migration cần kết nối trực tiếp (không qua pooler) của Neon.
    export DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}"
    npx prisma migrate deploy
    npx prisma db seed
fi

cd ../frontend
npm run build
