/** Error with an HTTP status. Shape sent to clients: { message, code?, field? } */
export class HttpError extends Error {
    constructor(status, message, { code, field } = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.field = field;
    }
}

export const badRequest = (msg, opts) => new HttpError(400, msg, opts);
export const unauthorized = (msg = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', opts) => new HttpError(401, msg, opts);
export const forbidden = (msg, opts) => new HttpError(403, msg, opts);
export const notFound = (msg = 'Không tìm thấy.', opts) => new HttpError(404, msg, opts);
export const conflict = (msg, opts) => new HttpError(409, msg, opts);
export const tooMany = (msg, opts) => new HttpError(429, msg, opts);
export const unavailable = (msg, opts) => new HttpError(503, msg, opts);
