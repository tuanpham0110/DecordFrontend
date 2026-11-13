import { prisma } from '../lib/prisma.js';
import { accessTokenIsCurrent, verifyToken } from '../lib/jwt.js';
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
            select: { id: true, name: true, email: true, role: true, verified: true, passwordChangedAt: true, passwordHash: true },
        });
        if (!user || !user.verified) throw unauthorized();
        // changing / resetting the password signs out every session opened before it
        if (!accessTokenIsCurrent(payload, user)) throw unauthorized();
        const { passwordHash, ...safeUser } = user;
        req.user = safeUser;
        next();
    } catch (e) {
        next(e);
    }
}

/** Use after requireAuth. */
export function requireAdmin(req, _res, next) {
    next(req.user?.role === 'admin' ? undefined : forbidden('Khu vực này chỉ dành cho quản trị viên.', { code: 'admin-only' }));
}
