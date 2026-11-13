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

export function resumeLabel(resume) {
    if (resume.done >= resume.total) return `Đã làm ${resume.total}/${resume.total} câu · Chờ xem kết quả`;
    return `Đang dừng ở câu ${resume.done + 1}/${resume.total} · ${resume.part}`;
}
