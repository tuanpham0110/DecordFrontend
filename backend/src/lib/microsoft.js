/**
 * Verifies a Microsoft identity platform ID token ("Đăng nhập bằng Microsoft", MSAL popup).
 * Works for work/school and personal accounts (authority "common"): the signing keys are
 * shared, the issuer carries the tenant id of the account that signed in.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const JWKS_URL = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';

let cache = { keys: new Map(), expiresAt: 0 };

async function fetchKeys() {
    const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Microsoft JWKS ${res.status}`);
    const { keys } = await res.json();
    return { keys, maxAge: 3600 };
}

async function publicKeyFor(kid, loadKeys) {
    if (!cache.keys.has(kid) || Date.now() > cache.expiresAt) {
        const { keys, maxAge } = await loadKeys();
        cache = {
            keys: new Map(keys.map((k) => [k.kid, crypto.createPublicKey({ key: k, format: 'jwk' })])),
            expiresAt: Date.now() + maxAge * 1000,
        };
    }
    return cache.keys.get(kid) ?? null;
}

/**
 * @param {string} idToken   the `idToken` returned by MSAL
 * @param {string} clientId  our Application (client) ID – the expected audience
 * @returns {Promise<{ sub: string, email: string, name: string }>}  `sub` is "<tenant>:<object id>"
 */
export async function verifyMicrosoftIdToken(idToken, clientId, { loadKeys = fetchKeys } = {}) {
    const decoded = jwt.decode(idToken, { complete: true });
    const kid = decoded?.header?.kid;
    if (!kid || decoded.header.alg !== 'RS256') throw new Error('Malformed Microsoft token');
    const key = await publicKeyFor(kid, loadKeys);
    if (!key) throw new Error('Unknown Microsoft signing key');
    const p = jwt.verify(idToken, key, { algorithms: ['RS256'], audience: clientId });
    // the issuer must be the tenant named in the token itself (multi-tenant apps cannot pin one issuer)
    if (!p.tid || p.iss !== `https://login.microsoftonline.com/${p.tid}/v2.0`) throw new Error('Unexpected Microsoft issuer');
    const email = String(p.email || p.preferred_username || '').toLowerCase();
    const id = p.oid || p.sub;
    if (!id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Microsoft account has no email');
    return { sub: `${p.tid}:${id}`, email, name: String(p.name || email.split('@')[0]).slice(0, 80) };
}

/** Test helper. */
export function resetMicrosoftKeyCache() {
    cache = { keys: new Map(), expiresAt: 0 };
}
