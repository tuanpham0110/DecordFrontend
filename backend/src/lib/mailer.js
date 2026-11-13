import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const transport = env.mailEnabled
    ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null;

const SUBJECT = {
    verify: 'Mã xác thực tài khoản MUONGLAB',
    reset: 'Mã đặt lại mật khẩu MUONGLAB',
};

function html(code, purpose) {
    const action = purpose === 'reset' ? 'đặt lại mật khẩu' : 'xác thực tài khoản';
    return `<!doctype html><html><body style="margin:0;background:#faf6ef;font-family:Segoe UI,Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-weight:700;letter-spacing:.06em;color:#1b6648">MUONGLAB</td></tr>
<tr><td style="padding-top:16px;color:#18241d;font-size:16px">Mã để ${action} của bạn là:</td></tr>
<tr><td style="padding:20px 0;font-size:34px;font-weight:700;letter-spacing:10px;color:#c24a0e">${code}</td></tr>
<tr><td style="color:#6b746d;font-size:14px">Mã có hiệu lực trong ${env.OTP_TTL_MINUTES} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Sends an OTP email. Without SMTP config (dev) the code is printed to the server console instead. */
export async function sendOtpMail(to, code, purpose) {
    if (!transport) {
        logger.warn(`[mail disabled] OTP (${purpose}) for ${to}: ${code}`);
        return;
    }
    await transport.sendMail({
        from: env.MAIL_FROM || `MUONGLAB <${env.SMTP_USER}>`,
        to,
        subject: SUBJECT[purpose] ?? 'Mã xác thực MUONGLAB',
        text: `Mã của bạn là ${code}. Mã có hiệu lực trong ${env.OTP_TTL_MINUTES} phút.`,
        html: html(code, purpose),
    });
}

export async function verifyMailer() {
    if (!transport) return false;
    await transport.verify();
    return true;
}
