import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const ISSUER = 'muonglab';

/** Opaque credential version: changing the password invalidates tokens even in the same millisecond. */
export function credentialVersion(user) {
    return crypto.createHmac('sha256', env.JWT_SECRET)
        .update(JSON.stringify([user.id, user.passwordHash, user.passwordChangedAt?.getTime() ?? null]))
        .digest('hex');
}

export function accessTokenIsCurrent(payload, user) {
    if (typeof payload.ver === 'string') return payload.ver === credentialVersion(user);
    // Previously issued tokens remain usable until the next credential change.
    return !user.passwordChangedAt || payload.iat * 1000 > user.passwordChangedAt.getTime();
}

export function signAccess(user, remember) {
    return jwt.sign({ sub: user.id, typ: 'access', ver: credentialVersion(user) }, env.JWT_SECRET, {
        issuer: ISSUER,
        expiresIn: remember ? env.JWT_REMEMBER_EXPIRES : env.JWT_EXPIRES,
    });
}

/** Short-lived token proving the learner passed the password-reset OTP. */
export function signReset(user) {
    return jwt.sign({ sub: user.email, uid: user.id, typ: 'reset', ver: credentialVersion(user) }, env.JWT_SECRET, { issuer: ISSUER, expiresIn: '15m' });
}

/** Binds email confirmation to the credentials chosen in this browser's registration/login flow. */
export function signVerification(user) {
    return jwt.sign({ sub: user.email, uid: user.id, typ: 'verify', ver: credentialVersion(user) }, env.JWT_SECRET, { issuer: ISSUER, expiresIn: '1h' });
}

/** Throws if the token is invalid, expired or of another type. */
export function verifyToken(token, typ) {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER });
    if (payload.typ !== typ) throw new Error('Wrong token type');
    return payload;
}
