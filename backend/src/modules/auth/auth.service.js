import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { badRequest, forbidden, tooMany, unauthorized, unavailable } from '../../lib/errors.js';
import { signAccess, signReset, verifyToken } from '../../lib/jwt.js';
import { sendOtpMail } from '../../lib/mailer.js';
import { logger } from '../../lib/logger.js';
import { verifyGoogleIdToken } from '../../lib/google.js';
import { verifyMicrosoftIdToken } from '../../lib/microsoft.js';

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const normEmail = (e) => e.trim().toLowerCase();
const session = (user, remember = false) => ({ token: signAccess(user.id, remember), user: publicUser(user) });
const hashPassword = (password) => bcrypt.hash(password, 10);
/** "Now", rounded down to the second: JWT `iat` has second precision, so a token signed right after still counts as newer. */
const wholeSecond = () => new Date(Math.floor(Date.now() / 1000) * 1000);

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

/** Sends a code unless one was sent moments ago (the learner can still use that one). */
const issueOtpQuietly = (email, purpose) =>
    issueOtp(email, purpose).catch((e) => {
        if (e.code !== 'otp-cooldown') throw e;
    });

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
    /**
     * Creates the account. With email verification on, an OTP is sent and the learner signs in after
     * confirming it. Without it (production with no SMTP – nobody could receive a code) the account is
     * accepted as is and the session is returned right away.
     */
    async register({ name, email, password }) {
        email = normEmail(email);
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing?.verified) throw badRequest('Email này đã được đăng ký.', { field: 'email', code: 'email-taken' });
        const data = { name: name.trim(), passwordHash: await hashPassword(password), passwordSet: true, verified: !env.verificationRequired };
        // an account that never confirmed its email is not owned by anyone yet, so it can be registered again
        const user = existing ? await prisma.user.update({ where: { email }, data }) : await prisma.user.create({ data: { ...data, email } });
        if (!env.verificationRequired) return { email, purpose: 'verify', session: session(user, true) };
        await issueOtpQuietly(email, 'verify');
        return { email, purpose: 'verify' };
    },

    async login({ email, password, remember }) {
        email = normEmail(email);
        const user = await prisma.user.findUnique({ where: { email } });
        const ok = user && (await bcrypt.compare(password, user.passwordHash));
        if (!ok) throw unauthorized('Email hoặc mật khẩu không đúng. Vui lòng thử lại.', { code: 'bad-credentials' });
        if (!user.verified) {
            if (env.verificationRequired) {
                await issueOtpQuietly(email, 'verify');
                throw forbidden('Tài khoản chưa được xác thực. Mã xác thực đã được gửi tới email của bạn.', { field: 'unverified', code: 'unverified' });
            }
            await prisma.user.update({ where: { id: user.id }, data: { verified: true } });
        }
        return session(user, remember);
    },

    /** "Đăng nhập bằng Google": signs in, or creates the account on first use. Google has already verified the email. */
    async googleLogin({ credential }) {
        if (!env.googleEnabled) throw unavailable('Đăng nhập bằng Google chưa được bật trên máy chủ.', { code: 'google-disabled' });
        let g;
        try {
            g = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);
        } catch (e) {
            logger.warn('Google sign-in rejected:', e.message);
            throw unauthorized('Không xác minh được tài khoản Google. Vui lòng thử lại.', { code: 'google-invalid' });
        }
        const existing = (await prisma.user.findUnique({ where: { googleSub: g.sub } })) ?? (await prisma.user.findUnique({ where: { email: g.email } }));
        const user = existing
            ? await prisma.user.update({ where: { id: existing.id }, data: { googleSub: g.sub, verified: true } })
            : await prisma.user.create({
                  data: { name: g.name, email: g.email, googleSub: g.sub, verified: true, passwordSet: false, passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex')) },
              });
        return session(user, true);
    },

    /**
     * "Đăng nhập bằng Microsoft". Unlike Google, Microsoft does not guarantee that the email in the
     * token was verified, so an existing password account is never taken over through it: the
     * Microsoft identity is only linked to accounts it created itself.
     */
    async microsoftLogin({ idToken }) {
        if (!env.microsoftEnabled) throw unavailable('Đăng nhập bằng Microsoft chưa được bật trên máy chủ.', { code: 'microsoft-disabled' });
        let m;
        try {
            m = await verifyMicrosoftIdToken(idToken, env.MICROSOFT_CLIENT_ID);
        } catch (e) {
            logger.warn('Microsoft sign-in rejected:', e.message);
            throw unauthorized('Không xác minh được tài khoản Microsoft. Vui lòng thử lại.', { code: 'microsoft-invalid' });
        }
        let user = await prisma.user.findUnique({ where: { microsoftSub: m.sub } });
        if (!user) {
            if (await prisma.user.findUnique({ where: { email: m.email } })) {
                throw badRequest('Email này đã có tài khoản MUONGLAB. Hãy đăng nhập bằng mật khẩu (hoặc Google) của tài khoản đó.', { code: 'email-taken' });
            }
            user = await prisma.user.create({
                data: { name: m.name, email: m.email, microsoftSub: m.sub, verified: true, passwordSet: false, passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex')) },
            });
        }
        return session(user, true);
    },

    /** Always answers the same way so the endpoint can't be used to probe which emails exist. */
    async forgotPassword({ email }) {
        if (!env.mailEnabled && env.isProd) {
            throw unavailable('Máy chủ chưa bật gửi email nên chưa thể đặt lại mật khẩu. Vui lòng liên hệ quản trị viên.', { code: 'mail-disabled' });
        }
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

    /** verify → the account is confirmed and signed in; reset → a short-lived token for the new-password form. */
    async verifyOtp({ email, purpose, code }) {
        email = normEmail(email);
        await consumeOtp(email, purpose, code);
        if (purpose === 'verify') {
            const user = await prisma.user.update({ where: { email }, data: { verified: true } });
            return { verified: true, ...session(user, true) };
        }
        return { resetToken: signReset(email) };
    },

    async resetPassword({ resetToken, password }) {
        const expired = () => badRequest('Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thực hiện lại.', { code: 'reset-expired' });
        let payload;
        try {
            payload = verifyToken(resetToken, 'reset');
        } catch {
            throw expired();
        }
        const user = await prisma.user.findUnique({ where: { email: payload.sub } });
        // single use: a token issued before the last password change is dead
        if (!user || (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime())) throw expired();
        await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordSet: true, passwordChangedAt: wholeSecond() } });
        return { ok: true };
    },

    /* ───── Signed-in account ───── */
    async me(userId) {
        const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        return { ...publicUser(u), createdAt: u.createdAt.getTime(), hasPassword: u.passwordSet, google: !!u.googleSub, microsoft: !!u.microsoftSub, verified: u.verified, dailyGoal: u.dailyGoal };
    },

    async updateProfile(userId, { name }) {
        return publicUser(await prisma.user.update({ where: { id: userId }, data: { name: name.trim() } }));
    },

    /** Changes (or, for Google-only accounts, sets) the password. Other devices are signed out; this one gets a fresh token. */
    async changePassword(userId, { currentPassword, newPassword }) {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.passwordSet) {
            const ok = currentPassword && (await bcrypt.compare(currentPassword, user.passwordHash));
            if (!ok) throw badRequest('Mật khẩu hiện tại không đúng.', { field: 'currentPassword', code: 'bad-password' });
            if (currentPassword === newPassword) throw badRequest('Mật khẩu mới cần khác mật khẩu hiện tại.', { field: 'newPassword', code: 'same-password' });
        }
        const updated = await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword), passwordSet: true, passwordChangedAt: wholeSecond() } });
        return session(updated, true);
    },

    /** Permanently deletes the account and everything the learner stored (cascades in the schema). */
    async deleteAccount(userId, { password, confirmEmail }) {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.passwordSet) {
            const ok = password && (await bcrypt.compare(password, user.passwordHash));
            if (!ok) throw badRequest('Mật khẩu không đúng.', { field: 'password', code: 'bad-password' });
        } else if (normEmail(confirmEmail ?? '') !== user.email) {
            throw badRequest('Email xác nhận không khớp.', { field: 'confirmEmail', code: 'bad-confirm' });
        }
        await prisma.$transaction([prisma.otpCode.deleteMany({ where: { email: user.email } }), prisma.user.delete({ where: { id: userId } })]);
        return { ok: true };
    },
};
