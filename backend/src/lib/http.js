import { badRequest } from './errors.js';

/** Wraps an async route handler so rejections reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Parses `source` with a zod schema, turning the first issue into a 400 with `field`. */
export function parse(schema, source) {
    const r = schema.safeParse(source);
    if (r.success) return r.data;
    const issue = r.error.issues[0];
    throw badRequest(issue.message, { field: issue.path.join('.') || undefined, code: 'validation' });
}
