/**
 * Verifies a Google Identity Services ID token ("Đăng nhập bằng Google") without extra
 * dependencies: Google's public keys (JWKS) are fetched and cached, the signature,
 * audience, issuer and expiry are checked with jsonwebtoken.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

let cache = { keys: new Map(), expiresAt: 0 };

async function fetchKeys() {
    const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Google JWKS ${res.status}`);
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] ?? 3600);
    const { keys } = await res.json();
    return { keys, maxAge };
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
 * @param {string} idToken   the `credential` returned by Google Identity Services
 * @param {string} clientId  our OAuth client id (expected audience)
 * @param {{ loadKeys?: () => Promise<{ keys: object[], maxAge: number }> }} [opts]  injectable for tests
 * @returns {Promise<{ sub: string, email: string, name: string }>}
 * @throws when the token is not a valid, unexpired Google token for this app with a verified email
 */
export async function verifyGoogleIdToken(idToken, clientId, { loadKeys = fetchKeys } = {}) {
    const decoded = jwt.decode(idToken, { complete: true });
    const kid = decoded?.header?.kid;
    if (!kid || decoded.header.alg !== 'RS256') throw new Error('Malformed Google token');
    const key = await publicKeyFor(kid, loadKeys);
    if (!key) throw new Error('Unknown Google signing key');
    const p = jwt.verify(idToken, key, { algorithms: ['RS256'], audience: clientId, issuer: ISSUERS });
    if (!p.sub || !p.email || p.email_verified !== true) throw new Error('Google account has no verified email');
    return { sub: String(p.sub), email: String(p.email).toLowerCase(), name: String(p.name || p.given_name || p.email.split('@')[0]).slice(0, 80) };
}

/** Test helper. */
export function resetGoogleKeyCache() {
    cache = { keys: new Map(), expiresAt: 0 };
}
