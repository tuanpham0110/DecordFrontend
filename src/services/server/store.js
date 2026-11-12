/**
 * Per-account persistence for the mock server.
 * Everything a learner produces (progress, attempts, review queue, notebook,
 * daily activity) lives under one key per email so accounts never mix.
 */
const PREFIX = 'muonglab.data.';
const VERSION = 1;

export function emptyData() {
    return {
        v: VERSION,
        sessions: {}, // lessonId -> in-progress session
        lessons: {}, // lessonId -> { best, passed, attempts, lastAt }
        attempts: [], // finished lesson attempts, newest first
        review: {}, // itemId -> SRS card
        notebook: {}, // entryId -> saved word / sentence
        daily: {}, // 'YYYY-MM-DD' -> { answered, correct }
        partStats: { listen: { correct: 0, total: 0 }, build: { correct: 0, total: 0 }, shadow: { practiced: 0, total: 0 } },
        goal: 10,
    };
}

function key(email) {
    return PREFIX + email.toLowerCase();
}

export function load(email) {
    try {
        const raw = localStorage.getItem(key(email));
        if (!raw) return emptyData();
        const parsed = JSON.parse(raw);
        // forward-compatible: fill any field added after the data was written
        return { ...emptyData(), ...parsed };
    } catch {
        return emptyData();
    }
}

export function save(email, data) {
    try {
        localStorage.setItem(key(email), JSON.stringify(data));
    } catch {
        throw Object.assign(new Error('Không lưu được tiến độ. Bộ nhớ trình duyệt có thể đã đầy.'), { status: 507 });
    }
}

/** Load → mutate → save in one step. Returns whatever `fn` returns. */
export function update(email, fn) {
    const data = load(email);
    const result = fn(data);
    save(email, data);
    return result;
}

export function dayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
