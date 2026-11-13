import { SHADOW_GUIDANCE } from '../../src/modules/content/guidance.js';

/**
 * Course content used by the mock server (src/services/server/).
 *
 * The UI never imports exercise answers from here directly – it goes through
 * src/services/api.js, which strips answers before sending items to the page.
 *
 * ⚠ Mường text in this file is limited to what appears in the approved design
 *   ("Giao diện web.pdf" + Figma export). Do not add Mường words, sentences or
 *   translations without a verified source. Lessons without verified content are
 *   marked `published: false` and shown to learners as "Đang biên soạn".
 *
 * Audio: no native-speaker recordings exist yet. Each item may carry `audioUrl`;
 * when it is missing the player falls back to the browser's Vietnamese
 * text-to-speech voice and labels it clearly as a machine voice.
 */

/** Learners must score at least this percentage to unlock the next lesson. */
export const PASS_THRESHOLD = 80;

export const PARTS = {
    listen: { key: 'listen', title: 'Bắc âm cầu', subtitle: 'Nghe và chọn đáp án đúng', icon: 'headphones' },
    build: { key: 'build', title: 'Lắp khung câu', subtitle: 'Chọn và sắp xếp từ thành câu', icon: 'puzzle' },
    shadow: { key: 'shadow', title: 'Shadowing', subtitle: 'Nghe và nhại lại câu mẫu', icon: 'mic' },
};

/* ───────────── Verified vocabulary & sentences ───────────── */
export const VOCABULARY = [
    { id: 'em', word: 'ếm', meaning: 'tôi', topic: 'Đại từ', lessonId: 1, note: 'Đại từ nhân xưng ngôi thứ nhất.' },
    { id: 'mat-tlang', word: 'mặt tlăng', meaning: 'mặt trăng', topic: 'Thiên nhiên', lessonId: 1 },
    { id: 'moch', word: 'mốch', meaning: 'một', topic: 'Số đếm', lessonId: 2 },
    { id: 'hal', word: 'hal', meaning: 'hai', topic: 'Số đếm', lessonId: 2 },
    { id: 'pa', word: 'pa', meaning: 'ba', topic: 'Số đếm', lessonId: 2 },
    { id: 'pon', word: 'pổn', meaning: 'bốn', topic: 'Số đếm', lessonId: 2 },
    { id: 'con-cui', word: 'con cúi', meaning: 'con lợn', topic: 'Vật nuôi', lessonId: 4 },
];

export const SENTENCES = [
    {
        id: 's-con-cui',
        text: 'Nhà ja chiếm từ con cúi chẵng?',
        meaning: 'Nhà mày có con lợn không?',
        topic: 'Hỏi han',
        lessonId: 4,
    },
];

/* ───────────── Exercise bank ─────────────
 * kinds:
 *   listen-pick     hear `audioText`, pick the word heard
 *   listen-meaning  hear `audioText`, pick its Vietnamese meaning
 *   fill            complete `before ___ after` from `options`
 *   order           arrange `tokens` into `answer`
 *   shadow          listen to `text` and repeat it (self-assessed)
 */
const NASAL_M = 'Âm /m/ là âm mũi, phát ra bằng cách khép môi và cho luồng hơi đi qua mũi.';

export const ITEMS = {
    /* Lesson 1 */
    'l1-ep-em': {
        part: 'listen',
        kind: 'listen-pick',
        audioText: 'ếm',
        prompt: 'Nghe âm thanh và chọn từ bạn nghe được',
        options: ['ếm', 'ấm', 'minh', 'làng'],
        answer: 'ếm',
        explain: `Từ đúng là “ếm” – nghĩa là “tôi”. Khép môi và để luồng hơi đi qua mũi, tương đồng với âm /m/ trong tiếng Việt.`,
        save: { type: 'word', ref: 'em' },
    },
    'l1-ep-minh': {
        part: 'listen',
        kind: 'listen-pick',
        audioText: 'minh',
        prompt: 'Nghe âm thanh và chọn đáp án đúng',
        options: ['minh', 'ấm', 'hướng', 'làng'],
        answer: 'minh',
        explain: `${NASAL_M} Trong từ “minh”, bạn sẽ nghe rõ âm /m/ ở đầu.`,
    },
    'l1-mean-em': {
        part: 'listen',
        kind: 'listen-meaning',
        audioText: 'ếm',
        prompt: 'Từ bạn vừa nghe có nghĩa là gì?',
        options: ['tôi', 'một', 'con lợn', 'mặt trăng'],
        answer: 'tôi',
        explain: '“ếm” là đại từ nhân xưng, nghĩa là “tôi”.',
        save: { type: 'word', ref: 'em' },
    },
    'l1-fill-tlang': {
        part: 'build',
        kind: 'fill',
        prompt: 'Chọn từ phù hợp để hoàn thành cụm từ',
        before: 'Mặt',
        after: '',
        options: ['tlăng', 'cúi', 'rọng', 'pa'],
        answer: 'tlăng',
        audioText: 'mặt tlăng',
        translation: '“Mặt tlăng” có nghĩa là “Mặt trăng”.',
        save: { type: 'word', ref: 'mat-tlang' },
    },
    'l1-fill-em': {
        part: 'build',
        kind: 'fill',
        prompt: 'Chọn từ tiếng Mường phù hợp với nghĩa “tôi”',
        before: '',
        after: '= tôi',
        options: ['ếm', 'ấm', 'hal', 'minh'],
        answer: 'ếm',
        audioText: 'ếm',
        translation: '“ếm” nghĩa là “tôi” (đại từ nhân xưng).',
        save: { type: 'word', ref: 'em' },
    },
    'l1-sh-em': {
        part: 'shadow',
        kind: 'shadow',
        text: 'ếm',
        meaning: 'tôi',
        tips: ['Khép môi ở cuối từ, để hơi đi qua mũi.', 'Nghe mẫu 2–3 lần rồi mới nói.'],
        save: { type: 'word', ref: 'em' },
    },
    'l1-sh-tlang': {
        part: 'shadow',
        kind: 'shadow',
        text: 'Mặt tlăng',
        meaning: 'Mặt trăng',
        tips: ['Nói theo đúng ngữ điệu, nhịp điệu và trọng âm của câu.', 'Cố gắng phát âm rõ ràng, dứt khoát.'],
        save: { type: 'word', ref: 'mat-tlang' },
    },

    /* Lesson 2 */
    'l2-ep-pa': {
        part: 'listen',
        kind: 'listen-pick',
        audioText: 'pa',
        prompt: 'Nghe và chọn số đếm bạn vừa nghe',
        options: ['mốch', 'hal', 'pa', 'pổn'],
        answer: 'pa',
        explain: '“pa” nghĩa là “ba”.',
        save: { type: 'word', ref: 'pa' },
    },
    'l2-mean-pon': {
        part: 'listen',
        kind: 'listen-meaning',
        audioText: 'pổn',
        prompt: 'Số bạn vừa nghe có nghĩa là gì?',
        options: ['một', 'hai', 'ba', 'bốn'],
        answer: 'bốn',
        explain: '“pổn” nghĩa là “bốn”.',
        save: { type: 'word', ref: 'pon' },
    },
    'l2-ep-hal': {
        part: 'listen',
        kind: 'listen-pick',
        audioText: 'hal',
        prompt: 'Nghe và chọn số đếm bạn vừa nghe',
        options: ['pổn', 'hal', 'mốch', 'pa'],
        answer: 'hal',
        explain: '“hal” nghĩa là “hai”.',
        save: { type: 'word', ref: 'hal' },
    },
    'l2-mean-moch': {
        part: 'listen',
        kind: 'listen-meaning',
        audioText: 'mốch',
        prompt: 'Số bạn vừa nghe có nghĩa là gì?',
        options: ['bốn', 'ba', 'một', 'hai'],
        answer: 'một',
        explain: '“mốch” nghĩa là “một”.',
        save: { type: 'word', ref: 'moch' },
    },
    'l2-order-count': {
        part: 'build',
        kind: 'order',
        prompt: 'Sắp xếp các số theo thứ tự từ một đến bốn',
        tokens: ['pổn', 'mốch', 'pa', 'hal'],
        answer: ['mốch', 'hal', 'pa', 'pổn'],
        audioText: 'mốch, hal, pa, pổn',
        translation: 'mốch – hal – pa – pổn = một – hai – ba – bốn.',
    },
    'l2-fill-pa': {
        part: 'build',
        kind: 'fill',
        prompt: 'Chọn số còn thiếu trong dãy đếm',
        before: 'mốch, hal,',
        after: ', pổn',
        options: ['pa', 'ếm', 'hal', 'mốch'],
        answer: 'pa',
        audioText: 'mốch, hal, pa, pổn',
        translation: 'Dãy đếm: mốch (một), hal (hai), pa (ba), pổn (bốn).',
        save: { type: 'word', ref: 'pa' },
    },
    'l2-sh-count': {
        part: 'shadow',
        kind: 'shadow',
        text: 'mốch, hal, pa, pổn',
        meaning: 'một, hai, ba, bốn',
        tips: ['Ngắt nhịp đều giữa các số.', 'Đọc chậm trước, sau đó tăng dần tốc độ.'],
    },
    'l2-sh-hal': {
        part: 'shadow',
        kind: 'shadow',
        text: 'hal',
        meaning: 'hai',
        tips: ['Chú ý âm cuối /l/.', 'Nghe mẫu rồi nhại lại ngay.'],
        save: { type: 'word', ref: 'hal' },
    },

    /* Lesson 4 – mirrors the exercise screens in the design */
    'l4-ep-concui': {
        part: 'listen',
        kind: 'listen-pick',
        audioText: 'con cúi',
        prompt: 'Nghe âm thanh và chọn đáp án đúng',
        options: ['Con cúi', 'Rọng', 'Cổ lại', 'Mặt tlăng'],
        answer: 'Con cúi',
        explain: '“Con cúi” nghĩa là “con lợn”.',
        save: { type: 'word', ref: 'con-cui' },
    },
    'l4-mean-sentence': {
        part: 'listen',
        kind: 'listen-meaning',
        audioText: 'Nhà ja chiếm từ con cúi chẵng?',
        prompt: 'Câu bạn vừa nghe có nghĩa là gì?',
        options: ['Nhà mày có con lợn không?', 'Nhà mày có mặt trăng không?', 'Tôi có bốn con lợn.', 'Con lợn ở đâu?'],
        answer: 'Nhà mày có con lợn không?',
        explain: '“Nhà ja chiếm từ con cúi chẵng?” nghĩa là “Nhà mày có con lợn không?”.',
        save: { type: 'sentence', ref: 's-con-cui' },
    },
    'l4-fill-concui': {
        part: 'build',
        kind: 'fill',
        prompt: 'Chọn từ phù hợp để hoàn thành câu',
        before: 'Nhà ja chiếm từ',
        after: 'chẵng?',
        options: ['Con cúi', 'Rọng', 'Cổ lại', 'Mặt tlăng'],
        answer: 'Con cúi',
        audioText: 'Nhà ja chiếm từ con cúi chẵng?',
        translation: 'Con cúi: “Con lợn”. Nghĩa: Nhà mày có con lợn không?',
        save: { type: 'sentence', ref: 's-con-cui' },
    },
    'l4-order-sentence': {
        part: 'build',
        kind: 'order',
        prompt: 'Sắp xếp các từ thành câu hỏi: “Nhà mày có con lợn không?”',
        tokens: ['con cúi', 'ja', 'chẵng?', 'Nhà', 'từ', 'chiếm'],
        answer: ['Nhà', 'ja', 'chiếm', 'từ', 'con cúi', 'chẵng?'],
        audioText: 'Nhà ja chiếm từ con cúi chẵng?',
        translation: 'Nhà ja chiếm từ con cúi chẵng? = Nhà mày có con lợn không?',
        save: { type: 'sentence', ref: 's-con-cui' },
    },
    'l4-sh-tlang': {
        part: 'shadow',
        kind: 'shadow',
        text: 'Mặt tlăng',
        meaning: 'Mặt trăng',
        tips: ['Nói theo đúng ngữ điệu, nhịp điệu và trọng âm của câu.', 'Cố gắng phát âm rõ ràng, dứt khoát.'],
        save: { type: 'word', ref: 'mat-tlang' },
    },
    'l4-sh-sentence': {
        part: 'shadow',
        kind: 'shadow',
        text: 'Nhà ja chiếm từ con cúi chẵng?',
        meaning: 'Nhà mày có con lợn không?',
        tips: ['Lên giọng ở cuối câu hỏi.', 'Tách câu thành hai nhịp: “Nhà ja chiếm từ” – “con cúi chẵng?”.'],
        save: { type: 'sentence', ref: 's-con-cui' },
    },
};

/* ───────────── Journey ─────────────
 * `parts` lists item ids per exercise part. A lesson is playable only when
 * `published` is true – the rest are visible as "Đang biên soạn".
 */
export const STAGES = [
    {
        id: 1,
        code: '01',
        tone: 'leaf',
        title: 'Phá băng & Nhập cuộc',
        summary: 'Làm quen âm, số đếm và những câu hỏi han đầu tiên.',
        lessons: [
            {
                id: 1,
                title: 'Làm quen với tiếng Mường',
                minutes: 5,
                published: true,
                goals: ['Nhận biết âm mũi /m/', 'Biết từ “ếm” (tôi)', 'Nói được “Mặt tlăng”'],
                parts: {
                    listen: ['l1-ep-em', 'l1-ep-minh', 'l1-mean-em'],
                    build: ['l1-fill-tlang', 'l1-fill-em'],
                    shadow: ['l1-sh-em', 'l1-sh-tlang'],
                },
            },
            {
                id: 2,
                title: 'Số đếm từ một đến bốn',
                minutes: 5,
                published: true,
                goals: ['Nghe và nhận ra mốch, hal, pa, pổn', 'Sắp xếp dãy số đúng thứ tự', 'Đếm thành tiếng từ 1 đến 4'],
                parts: {
                    listen: ['l2-ep-pa', 'l2-mean-pon', 'l2-ep-hal', 'l2-mean-moch'],
                    build: ['l2-order-count', 'l2-fill-pa'],
                    shadow: ['l2-sh-count', 'l2-sh-hal'],
                },
            },
            { id: 3, title: 'Giới thiệu bản thân', minutes: 6, published: false },
            {
                id: 4,
                title: 'Giao tiếp chào hỏi cơ bản',
                minutes: 6,
                published: true,
                goals: ['Hiểu câu hỏi “Nhà ja chiếm từ con cúi chẵng?”', 'Lắp khung câu hỏi có/không', 'Nhại lại câu hỏi đúng ngữ điệu'],
                parts: {
                    listen: ['l4-ep-concui', 'l4-mean-sentence'],
                    build: ['l4-fill-concui', 'l4-order-sentence'],
                    shadow: ['l4-sh-tlang', 'l4-sh-sentence'],
                },
            },
            {
                id: 5,
                title: 'Ôn tập chặng 1',
                minutes: 8,
                published: true,
                goals: ['Củng cố toàn bộ từ và câu của chặng 1', 'Đạt từ 80% để hoàn thành chặng'],
                parts: {
                    listen: ['l1-ep-em', 'l2-ep-pa', 'l4-mean-sentence'],
                    build: ['l2-order-count', 'l4-fill-concui'],
                    shadow: ['l2-sh-count', 'l4-sh-sentence'],
                },
            },
        ],
    },
    {
        id: 2,
        code: '02',
        tone: 'clay',
        title: 'Kết nối & Mở rộng',
        summary: 'Ghép câu, hỏi đáp và mở rộng vốn từ trong sinh hoạt hằng ngày.',
        lessons: [
            { id: 6, title: 'Lắp khung câu hỏi đáp', minutes: 6, published: false },
            { id: 7, title: 'Hỏi và chỉ đường', minutes: 6, published: false },
            { id: 8, title: 'Gia đình và cách xưng hô', minutes: 7, published: false },
            { id: 9, title: 'Thời gian trong ngày', minutes: 6, published: false },
            { id: 10, title: 'Ôn tập chặng 2', minutes: 8, published: false },
        ],
    },
    {
        id: 3,
        code: '03',
        tone: 'river',
        title: 'Thực hành & Ứng dụng',
        summary: 'Đưa tiếng Mường vào tình huống công việc thực tế tại cơ sở.',
        lessons: [
            { id: 11, title: 'Tiếp dân tại bộ phận một cửa', minutes: 8, published: false },
            { id: 12, title: 'Trao đổi trong buổi họp thôn', minutes: 8, published: false },
            { id: 13, title: 'Phổ biến thông tin đến bà con', minutes: 8, published: false },
            { id: 14, title: 'Tổng kết hành trình', minutes: 10, published: false },
        ],
    },
];

/* ───────────── Handbook ─────────────
 * `body` is an array of blocks: { p } paragraph, { list } bullet list,
 * { h } sub-heading, { vocab: topic|'*' } live vocabulary table,
 * { sentences: true } live sentence list.
 * Articles with `draft: true` are shown with an "Đang biên soạn" badge.
 */
export const HANDBOOK = [
    {
        id: 'bat-dau',
        category: 'Phương pháp',
        title: 'Học 5 phút mỗi ngày thế nào cho hiệu quả',
        excerpt: 'Lặp lại ngắt quãng, nói thành tiếng và dùng ngay trong công việc.',
        minutes: 3,
        body: [
            { p: 'Mỗi bài học trên MUONGLAB đi qua ba bước, từ nghe đến nói. Hãy học trọn một bài mỗi lần thay vì làm dở nhiều bài.' },
            { h: 'Ba bước của một bài học' },
            {
                list: [
                    'Bắc âm cầu – nghe và chọn đáp án đúng để tai quen với âm thanh.',
                    'Lắp khung câu – ghép từ thành câu để hiểu trật tự câu.',
                    'Shadowing – nghe câu mẫu, ghi âm giọng mình và so sánh.',
                ],
            },
            { h: 'Giữ nhịp học đều' },
            {
                list: [
                    'Đặt mục tiêu nhỏ: 5–10 câu mỗi ngày là đủ để duy trì chuỗi ngày học.',
                    'Mở mục Ôn luyện khi có câu đến hạn ôn – hệ thống tự nhắc lại câu bạn từng làm sai.',
                    'Lưu từ hay câu khó vào Sổ tay để lật thẻ ôn khi rảnh.',
                ],
            },
            { p: 'Mỗi bài cần đạt từ 80% số câu nghe và ghép câu đúng ngay lần đầu để mở khoá bài tiếp theo.' },
        ],
    },
    {
        id: 'shadowing',
        category: 'Phương pháp',
        title: 'Luyện nói bằng kỹ thuật Shadowing',
        excerpt: 'Nghe mẫu, nhại lại ngay và tự so sánh với giọng của mình.',
        minutes: 4,
        body: [
            { p: 'Shadowing là cách luyện nói bằng việc nhại lại câu mẫu gần như ngay lập tức, bắt chước cả âm, nhịp và ngữ điệu.' },
            {
                list: [
                    'Nghe câu mẫu 2–3 lần, có thể giảm tốc độ xuống 0.75×.',
                    'Bấm ghi âm và nói lại câu, giữ nhịp giống mẫu nhất có thể.',
                    'Nghe lại bản ghi của bạn ngay sau câu mẫu và tự đánh giá.',
                    'Câu nào bạn đánh giá “Cần luyện thêm” sẽ được đưa vào danh sách ôn tập.',
                ],
            },
            {
                p: SHADOW_GUIDANCE,
            },
        ],
    },
    {
        id: 'phat-am',
        category: 'Phát âm',
        title: 'Âm mũi /m/ và những từ đầu tiên',
        excerpt: 'Cách khép môi, để hơi đi qua mũi khi nói “ếm”, “minh”.',
        minutes: 2,
        body: [
            { p: 'Âm /m/ là âm mũi, phát ra bằng cách khép môi và cho luồng hơi đi qua mũi – tương đồng với âm /m/ trong tiếng Việt.' },
            { list: ['Trong từ “minh”, bạn sẽ nghe rõ âm /m/ ở đầu.', 'Trong từ “ếm” (tôi), môi khép lại ở cuối từ.', 'Bấm nút loa nghe mẫu 2–3 lần rồi lặp lại.'] },
            { p: 'Hướng dẫn chi tiết về thanh điệu và các phụ âm khác đang được đội ngũ chuyên môn biên soạn.' },
        ],
    },
    {
        id: 'tu-vung',
        category: 'Từ vựng',
        title: 'Từ vựng đã có trong chương trình',
        excerpt: 'Danh sách từ Mường – Việt đã được xác nhận, kèm phát âm tham khảo.',
        minutes: 2,
        body: [{ p: 'Các từ dưới đây xuất hiện trong bài học. Bấm biểu tượng loa để nghe giọng đọc tham khảo.' }, { vocab: '*' }],
    },
    {
        id: 'mau-cau',
        category: 'Câu mẫu',
        title: 'Câu mẫu đã học',
        excerpt: 'Những câu hoàn chỉnh trong chương trình, kèm nghĩa tiếng Việt.',
        minutes: 2,
        body: [{ sentences: true }],
    },
    {
        id: 'xung-ho',
        category: 'Giao tiếp',
        title: 'Xưng hô khi làm việc với bà con',
        excerpt: 'Gợi ý cách mở lời, xưng hô phù hợp với từng lứa tuổi khi tiếp dân và đi cơ sở.',
        minutes: 4,
        draft: true,
    },
    {
        id: 'mau-cau-cong-vu',
        category: 'Câu mẫu',
        title: 'Mẫu câu thường dùng tại bộ phận một cửa',
        excerpt: 'Tổng hợp các tình huống tiếp nhận hồ sơ, hướng dẫn thủ tục thường gặp.',
        minutes: 6,
        draft: true,
    },
    {
        id: 'van-hoa',
        category: 'Văn hoá',
        title: 'Tôn trọng phong tục khi đến thăm bản',
        excerpt: 'Những điều nên biết để giao tiếp tự nhiên, tạo thiện cảm với cộng đồng.',
        minutes: 4,
        draft: true,
    },
];
