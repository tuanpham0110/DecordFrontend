/** Preserve complete recent turns; never truncate a word/sentence to fit the API schema. */
export function tutorHistory(messages) {
    const list = messages.filter((m) => ['user', 'model'].includes(m.role) && typeof m.text === 'string' && m.text.trim())
        .map((m) => ({ ...m, text: m.text.trim() }));
    const question = list.at(-1);
    if (question?.role !== 'user' || question.text.length > 2000) throw new Error('Câu hỏi cần có từ 1 đến 2000 ký tự.');
    const history = [{ role: 'user', text: question.text }];
    for (let i = list.length - 2; i >= 1 && history.length + 2 <= 30; i -= 2) {
        const reply = list[i];
        const prompt = list[i - 1];
        if (reply.role !== 'model' || prompt.role !== 'user' || reply.incomplete || reply.pending || reply.text.length > 2000 || prompt.text.length > 2000) break;
        history.unshift({ role: 'user', text: prompt.text }, { role: 'model', text: reply.text });
    }
    return history;
}
