import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ISSUER = 'muonglab';

export function signAccess(userId, remember) {
    return jwt.sign({ sub: userId, typ: 'access' }, env.JWT_SECRET, {
        issuer: ISSUER,
        expiresIn: remember ? env.JWT_REMEMBER_EXPIRES : env.JWT_EXPIRES,
    });
}

/** Short-lived token proving the learner passed the password-reset OTP. */
export function signReset(email) {
    return jwt.sign({ sub: email, typ: 'reset' }, env.JWT_SECRET, { issuer: ISSUER, expiresIn: '15m' });
}

/** Throws if the token is invalid, expired or of another type. */
export function verifyToken(token, typ) {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER });
    if (payload.typ !== typ) throw new Error('Wrong token type');
    return payload;
}
