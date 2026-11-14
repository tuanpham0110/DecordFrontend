/**
 * Learning context for the AI tutor ("Hỏi Ếch Mường về câu này").
 *
 * The browser only sends ids ({ lessonId, itemId }); every word given to the model comes from our own
 * content and the learner's own records, never from client-supplied text. The answer of an exercise
 * is included only once the learner has answered it (in a lesson session, in review, or in a finished
 * attempt of that lesson) – otherwise the model is told to give hints without the answer.
 */
import { prisma } from '../../lib/prisma.js';
import { lessonItemIds } from '../learning/rules.js';
import { CONTENT_VERSION } from '../learning/session.js';

const KIND = {
    'listen-pick': 'Nghe và chọn từ nghe được',
    'listen-meaning': 'Nghe và chọn nghĩa tiếng Việt',
    fill: 'Điền từ còn thiếu',
    order: 'Sắp xếp từ thành câu',
    shadow: 'Nghe và nói lại (Shadowing)',
};

const q = (t) => `“${String(t)}”`;
const show = (v) => (Array.isArray(v) ? v.join(' ') : String(v ?? ''));

function lessonsWith(C, itemId) {
    return C.STAGES.flatMap((s) => s.lessons).filter((l) => lessonItemIds(l).includes(itemId));
}

/** What the exercise shows before answering – nothing that gives the answer away. */
function describeQuestion(item) {
    const lines = [`- Dạng bài: ${KIND[item.kind] ?? item.kind}`];
    if (item.prompt) lines.push(`- Đề bài: ${item.prompt}`);
    if (item.kind === 'fill') lines.push(`- Câu cần điền: ${[item.before, '___', item.after].filter(Boolean).join(' ')}`);
    if (Array.isArray(item.options)) lines.push(`- Các lựa chọn: ${item.options.map(q).join(', ')}`);
    if (item.kind === 'order' && Array.isArray(item.tokens)) lines.push(`- Các từ cần sắp xếp: ${item.tokens.map(q).join(', ')}`);
    if (item.kind === 'shadow') lines.push(`- Câu mẫu: ${q(item.text)} = ${q(item.meaning)}`);
    return lines;
}

function describeSolution(item, learner) {
    const lines = [];
    if (item.kind !== 'shadow') {
        if (item.audioText) lines.push(`- Âm thanh phát ra: ${q(item.audioText)}`);
        lines.push(`- Đáp án đúng: ${q(show(item.answer))}`);
    }
    if (item.explain) lines.push(`- Giải thích trong bài: ${item.explain}`);
    if (item.translation) lines.push(`- Dịch nghĩa trong bài: ${item.translation}`);
    if (learner?.firstResponse != null) {
        lines.push(`- Người học trả lời lần đầu: ${q(show(learner.firstResponse))} (${learner.correct ? 'đúng' : 'sai'})`);
        if (learner.attempts > 1 && learner.response != null) lines.push(`- Lần trả lời gần nhất: ${q(show(learner.response))}`);
    }
    if (learner?.rating) lines.push(`- Người học tự đánh giá phần nói: ${{ good: 'giống mẫu', ok: 'gần giống', again: 'cần luyện thêm', skip: 'bỏ qua' }[learner.rating]}`);
    return lines;
}

/**
 * @returns {Promise<string|null>} a context block for the system prompt, or null when nothing applies
 */
export async function tutorContext(C, userId, { lessonId, itemId } = {}, db = prisma) {
    const item = itemId ? C.ITEMS[itemId] : null;
    const candidates = item ? lessonsWith(C, itemId) : [];
    const lesson = (lessonId && C.STAGES.flatMap((s) => s.lessons).find((l) => l.id === lessonId && (!item || candidates.includes(l)))) || candidates[0] || null;
    if (!lesson && !item) return null;

    const lines = ['NGỮ CẢNH HỌC TẬP HIỆN TẠI (do hệ thống cung cấp, không phải người học viết):'];
    if (lesson) {
        lines.push(`- Bài ${lesson.id}: ${lesson.title}`);
        if (lesson.goals?.length) lines.push(`- Mục tiêu bài: ${lesson.goals.join('; ')}`);
        const words = C.VOCABULARY.filter((v) => v.lessonId === lesson.id).map((v) => `${q(v.word)} = ${q(v.meaning)}`);
        const sentences = C.SENTENCES.filter((s) => s.lessonId === lesson.id).map((s) => `${q(s.text)} = ${q(s.meaning)}`);
        if (words.length || sentences.length) lines.push(`- Từ/câu đã kiểm chứng của bài: ${[...words, ...sentences].join('; ')}`);
        lines.push('Ưu tiên trả lời trong phạm vi bài này.');
    }
    if (!item) return lines.join('\n');

    const [session, card, progress] = await Promise.all([
        lesson ? db.lessonSession.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } } }) : null,
        db.reviewCard.findUnique({ where: { userId_itemId: { userId, itemId } } }),
        lesson ? db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } } }) : null,
    ]);
    const answers = session?.answers && typeof session.answers === 'object' ? session.answers : {};
    const learner = itemId !== CONTENT_VERSION ? answers[itemId] ?? (session?.shadow?.[itemId] ? { rating: session.shadow[itemId].rating } : null) : null;
    const answered = item.kind === 'shadow' || !!learner || !!card || (progress?.attempts ?? 0) > 0;

    lines.push('', 'Người học đang hỏi về câu bài tập sau:', ...describeQuestion(item));
    if (answered) {
        lines.push(...describeSolution(item, learner));
        lines.push(
            'Hãy giải thích vì sao đáp án đúng là đúng (và vì sao câu trả lời của người học sai, nếu sai) dựa trên dữ liệu ở trên. Gợi ý một cách ghi nhớ ngắn.'
        );
    } else {
        lines.push(
            'Người học CHƯA trả lời câu này. TUYỆT ĐỐI không nói ra đáp án hay loại trừ đến mức lộ đáp án. Chỉ gợi ý từng bước (ví dụ: chú ý âm đầu, nhớ lại từ đã học trong bài) và khuyến khích người học tự chọn.'
        );
    }
    return lines.join('\n');
}
