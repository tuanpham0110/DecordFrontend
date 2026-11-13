import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export function notFoundRoute(req, res) {
    res.status(404).json({ message: `Không có endpoint ${req.method} ${req.originalUrl}`, code: 'route-not-found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
    if (err instanceof HttpError) {
        return res.status(err.status).json({ message: err.message, code: err.code, field: err.field, verificationToken: err.verificationToken });
    }
    if (err?.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Dữ liệu gửi lên không phải JSON hợp lệ.', code: 'bad-json' });
    }
    if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Dữ liệu gửi lên quá lớn.', code: 'too-large' });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return res.status(409).json({ message: 'Dữ liệu đã tồn tại.', code: 'duplicate' });
    }
    if (err instanceof Prisma.PrismaClientInitializationError) {
        logger.error('Database unreachable:', err.message);
        return res.status(503).json({ message: 'Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.', code: 'db-down' });
    }
    logger.error(`${req.method} ${req.originalUrl}`, err);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ.', code: 'internal', ...(env.isProd ? {} : { detail: String(err?.message ?? err) }) });
}
