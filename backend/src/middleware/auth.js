import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../lib/jwt.js';
import { forbidden, unauthorized } from '../lib/errors.js';

/** Requires "Authorization: Bearer <token>". Sets req.user = { id, name, email, role }. */
export async function requireAuth(req, _res, next) {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) throw unauthorized();
        let payload;
        try {
            payload = verifyToken(token, 'access');
        } catch {
            throw unauthorized();
        }
        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, name: true, email: true, role: true, verified: true, passwordChangedAt: true },
        });
        if (!user || !user.verified) throw unauthorized();
        // changing / resetting the password signs out every session opened before it
        if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) throw unauthorized();
        req.user = user;
        next();
    } catch (e) {
        next(e);
    }
}

/** Use after requireAuth. */
export function requireAdmin(req, _res, next) {
    next(req.user?.role === 'admin' ? undefined : forbidden('Khu vực này chỉ dành cho quản trị viên.', { code: 'admin-only' }));
}
