/** Feedback follows the latest response; scoring still uses the first response on the server. */
export function answerFeedback(answer) {
    if (!answer) return undefined;
    return {
        correct: answer.retryCorrect ?? answer.correct,
        answer: answer.answer,
        explain: answer.explain,
        translation: answer.translation,
    };
}

export function shuffle(list, rand = Math.random) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Typed-answer comparison for the word drills – the same rule as the server's grading:
 * Unicode-normalised, case and spacing ignored, tone marks kept. Commas and final ?!.… are ignored.
 */
export function normalizeAnswer(s) {
    return String(s ?? '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[\s,;]+/g, ' ')
        .trim()
        .replace(/[?!.…]+$/u, '')
        .trim();
}

/** Entries the learner struggles with first (most-missed first), then the rest at random. */
export function pickRound(entries, size, rand = Math.random) {
    const weak = shuffle(entries.filter((e) => e.weak > 0), rand).sort((a, b) => b.weak - a.weak);
    const rest = shuffle(entries.filter((e) => !(e.weak > 0)), rand);
    return [...weak, ...rest].slice(0, size);
}

export function resumeLabel(resume) {
    if (resume.done >= resume.total) return `Đã làm ${resume.total}/${resume.total} câu · Chờ xem kết quả`;
    return `Đang dừng ở câu ${resume.done + 1}/${resume.total} · ${resume.part}`;
}
