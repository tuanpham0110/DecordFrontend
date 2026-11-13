import { createHash, createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { conflict } from '../../lib/errors.js';

const revision = (card) => createHash('sha256').update(JSON.stringify({
    box: card.box,
    right: card.right,
    wrong: card.wrong,
    lastAt: new Date(card.lastAt).getTime(),
    due: card.due ? new Date(card.due).getTime() : null,
    mastered: card.mastered,
})).digest('hex');

const itemVersion = (item) => createHmac('sha256', env.JWT_SECRET).update(JSON.stringify(item)).digest('hex');

export function reviewToken(userId, card, item) {
    return jwt.sign({ typ: 'review', sub: userId, itemId: card.itemId, revision: revision(card), content: itemVersion(item) }, env.JWT_SECRET, {
        issuer: 'muonglab-review', expiresIn: '1d', algorithm: 'HS256',
    });
}

export function assertReviewToken(token, userId, card, item) {
    const stale = () => conflict('Câu ôn tập đã được xử lý hoặc phiên ôn đã hết hạn. Hãy mở lại phiên ôn tập.', { code: 'review-stale' });
    let payload;
    try {
        payload = jwt.verify(token || '', env.JWT_SECRET, { issuer: 'muonglab-review', algorithms: ['HS256'] });
    } catch {
        throw stale();
    }
    if (payload.typ !== 'review' || payload.sub !== userId || payload.itemId !== card.itemId || payload.revision !== revision(card) || payload.content !== itemVersion(item)) throw stale();
}
