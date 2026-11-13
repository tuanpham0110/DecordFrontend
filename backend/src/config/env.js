/**
 * Typed, validated configuration. The server refuses to start with a broken config.
 */
import { z } from 'zod';

const bool = (def) =>
    z
        .string()
        .optional()
        .transform((v) => (v == null || v === '' ? def : v === 'true'));

const schema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    APP_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
    TRUST_PROXY: bool(false),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES: z.string().default('1d'),
    JWT_REMEMBER_EXPIRES: z.string().default('30d'),

    PASS_THRESHOLD: z.coerce.number().int().min(0).max(100).default(80),

    OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_RESEND_SECONDS: z.coerce.number().int().nonnegative().default(60),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_SECURE: bool(true),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),

    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    AI_DAILY_LIMIT: z.coerce.number().int().positive().default(100),

    SPEECH_API_URL: z.string().optional(),
    SPEECH_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error('✗ Invalid environment configuration (check backend/.env):');
    for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    process.exit(1);
}

export const env = {
    ...parsed.data,
    isProd: parsed.data.NODE_ENV === 'production',
    mailEnabled: Boolean(parsed.data.SMTP_HOST && parsed.data.SMTP_USER && parsed.data.SMTP_PASS),
    aiEnabled: Boolean(parsed.data.GEMINI_API_KEY),
    speechEnabled: Boolean(parsed.data.SPEECH_API_URL),
};
