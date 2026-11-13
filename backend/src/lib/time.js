import { env } from '../config/env.js';

export const DAY = 86_400_000;

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: env.APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 'YYYY-MM-DD' in the app time zone (learners are in Vietnam). */
export function dayKey(d = new Date()) {
    return fmt.format(d);
}

/** Day of week (0 = Sunday) for a 'YYYY-MM-DD' key. */
export function weekdayOf(key) {
    return new Date(`${key}T00:00:00Z`).getUTCDay();
}

/** Date → epoch ms (the client works with numbers). */
export const ms = (d) => (d ? new Date(d).getTime() : null);
