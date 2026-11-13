import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { badRequest, forbidden, tooMany, unauthorized } from '../../lib/errors.js';
import { signAccess, signReset, verifyToken } from '../../lib/jwt.js';
import { sendOtpMail } from '../../lib/mailer.js';
import { logger } from '../../lib/logger.js';

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });
const normEmail = (e) => e.trim().toLowerCase();

/* ───────────── OTP ───────────── */
const hashCode = (email, purpose, code) => crypto.createHmac('sha256', env.JWT_SECRET).update(`${email}|${purpose}|${code}`).digest('hex');

async function issueOtp(email, purpose) {
    const latest = await prisma.otpCode.findFirst({ where: { email, purpose }, orderBy: { createdAt: 'desc' } });
    if (latest && Date.now() - latest.createdAt.getTime() < env.OTP_RESEND_SECONDS * 1000) {
        const wait = Math.ceil((env.OTP_RESEND_SECONDS * 1000 - (Date.now() - latest.createdAt.getTime())) / 1000);
        throw tooMany(`Vui lòng đợi ${wait} giây trước khi gửi lại mã.`, { code: 'otp-cooldown' });
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await prisma.$transaction([
        // only the newest code is valid
        prisma.otpCode.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
        prisma.otpCode.create({
            data: { email, purpose, codeHash: hashCode(email, purpose, code), expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000) },
        }),
    ]);
    try {
        await sendOtpMail(email, code, purpose);
    } catch (e) {
        logger.error('Send OTP mail failed:', e.message);
        throw badRequest('Không gửi được email xác thực. Vui lòng thử lại sau.', { code: 'mail-failed' });
    }
}

async function consumeOtp(email, purpose, code) {
    const otp = await prisma.otpCode.findFirst({ where: { email, purpose, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.expiresAt < new Date()) throw badRequest('Mã xác thực đã hết hạn. Vui lòng gửi lại mã mới.', { field: 'code', code: 'otp-expired' });
    if (otp.attempts >= env.OTP_MAX_ATTEMPTS) throw tooMany('Bạn đã nhập sai quá nhiều lần. Vui lòng gửi lại mã mới.', { field: 'code', code: 'otp-locked' });
    const ok = crypto.timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hashCode(email, purpose, code)));
    if (!ok) {
        await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
        throw badRequest('Mã xác thực không đúng.', { field: 'code', code: 'otp-wrong' });
    }
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
}

/* ───────────── Public API ───────────── */
export const authService = {
    async register({ name, email, password }) {
        email = normEmail(email);
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing?.verified) throw badRequest('Email này đã được đăng ký.', { field: 'email', code: 'email-taken' });
        const passwordHash = await bcrypt.hash(password, 10);
        if (existing) await prisma.user.update({ where: { email }, data: { name: name.trim(), passwordHash } });
        else await prisma.user.create({ data: { name: name.trim(), email, passwordHash } });
        await issueOtp(email, 'verify').catch((e) => {
            // a fresh code was sent < cooldown ago – the learner can still use it
            if (e.code !== 'otp-cooldown') throw e;
        });
        return { email, purpose: 'verify' };
    },

    async login({ email, password, remember }) {
        email = normEmail(email);
        const user = await prisma.user.findUnique({ where: { email } });
        const ok = user && (await bcrypt.compare(password, user.passwordHash));
        if (!ok) throw unauthorized('Email hoặc mật khẩu không đúng. Vui lòng thử lại.', { code: 'bad-credentials' });
        if (!user.verified) {
            await issueOtp(email, 'verify').catch((e) => {
                if (e.code !== 'otp-cooldown') throw e;
            });
            throw forbidden('Tài khoản chưa được xác thực. Mã xác thực đã được gửi tới email của bạn.', { field: 'unverified', code: 'unverified' });
        }
        return { token: signAccess(user.id, remember), user: publicUser(user) };
    },

    /** Always answers the same way so the endpoint can't be used to probe which emails exist. */
    async forgotPassword({ email }) {
        email = normEmail(email);
        const user = await prisma.user.findUnique({ where: { email } });
        if (user?.verified) await issueOtp(email, 'reset');
        return { email, purpose: 'reset' };
    },

    async resendOtp({ email, purpose }) {
        email = normEmail(email);
        const user = await prisma.user.findUnique({ where: { email } });
        if (user && (purpose === 'reset' ? user.verified : !user.verified)) await issueOtp(email, purpose);
        return { ok: true };
    },

    async verifyOtp({ email, purpose, code }) {
        email = normEmail(email);
        await consumeOtp(email, purpose, code);
        if (purpose === 'verify') {
            await prisma.user.update({ where: { email }, data: { verified: true } });
            return { verified: true };
        }
        return { resetToken: signReset(email) };
    },

    async resetPassword({ resetToken, password }) {
        let payload;
        try {
            payload = verifyToken(resetToken, 'reset');
        } catch {
            throw badRequest('Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thực hiện lại.', { code: 'reset-expired' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.user.update({ where: { email: payload.sub }, data: { passwordHash } });
        return { ok: true };
    },

    me: (user) => publicUser(user),
};
