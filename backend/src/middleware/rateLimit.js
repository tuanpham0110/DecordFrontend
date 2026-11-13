import rateLimit from 'express-rate-limit';

const message = (text) => ({ message: text, code: 'rate-limited' });

/** Login / register / OTP – slows down brute force. */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: message('Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.'),
});

/** General API ceiling per IP. */
export const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: message('Quá nhiều yêu cầu. Vui lòng chậm lại một chút.'),
});

/** AI chat – per signed-in user. */
export const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 12,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? req.ip,
    message: message('Bạn hỏi hơi nhanh. Đợi vài giây rồi hỏi tiếp nhé.'),
});
