import { Router } from 'express';
import { z } from 'zod';
import { ah, parse } from '../../lib/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { authService } from './auth.service.js';

const email = z.string({ error: 'Vui lòng nhập email.' }).trim().email('Email chưa đúng định dạng.');
const password = z
    .string({ error: 'Vui lòng nhập mật khẩu.' })
    .min(8, 'Mật khẩu cần tối thiểu 8 ký tự.')
    .max(128, 'Mật khẩu quá dài.')
    .regex(/[A-Za-z]/, 'Mật khẩu cần có chữ cái.')
    .regex(/\d/, 'Mật khẩu cần có chữ số.');
const name = z.string({ error: 'Vui lòng nhập họ và tên.' }).trim().min(2, 'Họ và tên quá ngắn.').max(80, 'Họ và tên quá dài.');
const purpose = z.enum(['verify', 'reset']);
const verificationToken = z.string().min(1).max(4096).optional();

const schemas = {
    register: z.object({ name, email, password }),
    login: z.object({ email, password: z.string().min(1, 'Vui lòng nhập mật khẩu.'), remember: z.boolean().optional().default(false) }),
    google: z.object({ credential: z.string().min(20).max(4096) }),
    microsoft: z.object({ idToken: z.string().min(20).max(8192) }),
    forgot: z.object({ email }),
    resend: z.object({ email, purpose, verificationToken }),
    verify: z.object({ email, purpose, verificationToken, code: z.string().regex(/^\d{6}$/, 'Vui lòng nhập đủ 6 chữ số.') }),
    reset: z.object({ resetToken: z.string().min(1), password }),
    profile: z.object({ name }),
    changePassword: z.object({ currentPassword: z.string().max(128).optional(), newPassword: password }),
    deleteAccount: z.object({ password: z.string().max(128).optional(), confirmEmail: z.string().max(200).optional() }),
};

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, ah(async (req, res) => res.status(201).json(await authService.register(parse(schemas.register, req.body)))));
authRoutes.post('/login', authLimiter, ah(async (req, res) => res.json(await authService.login(parse(schemas.login, req.body)))));
authRoutes.post('/google', authLimiter, ah(async (req, res) => res.json(await authService.googleLogin(parse(schemas.google, req.body)))));
authRoutes.post('/microsoft', authLimiter, ah(async (req, res) => res.json(await authService.microsoftLogin(parse(schemas.microsoft, req.body)))));
authRoutes.post('/password/forgot', authLimiter, ah(async (req, res) => res.json(await authService.forgotPassword(parse(schemas.forgot, req.body)))));
authRoutes.post('/password/reset', authLimiter, ah(async (req, res) => res.json(await authService.resetPassword(parse(schemas.reset, req.body)))));
authRoutes.post('/otp/resend', authLimiter, ah(async (req, res) => res.json(await authService.resendOtp(parse(schemas.resend, req.body)))));
authRoutes.post('/otp/verify', authLimiter, ah(async (req, res) => res.json(await authService.verifyOtp(parse(schemas.verify, req.body)))));

/* ───── Signed-in account ───── */
authRoutes.get('/me', requireAuth, ah(async (req, res) => res.json(await authService.me(req.user.id))));
authRoutes.patch('/me', requireAuth, ah(async (req, res) => res.json(await authService.updateProfile(req.user.id, parse(schemas.profile, req.body)))));
authRoutes.post(
    '/password/change',
    requireAuth,
    authLimiter,
    ah(async (req, res) => res.json(await authService.changePassword(req.user.id, parse(schemas.changePassword, req.body))))
);
authRoutes.delete('/me', requireAuth, authLimiter, ah(async (req, res) => res.json(await authService.deleteAccount(req.user.id, parse(schemas.deleteAccount, req.body ?? {})))));
