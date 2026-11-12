/**
    * Seed content used by the mock API (src/services/api.js).
    *
    * Everything the UI renders comes through the service layer, so this file is
    * the only place to replace once a real backend is available.
    *
    * Mường vocabulary below is taken verbatim from the Figma design – do not add
    * words here without a verified source.
    */

export const STAGES = [
    {
        id: 1,
        code: '01',
        tone: 'leaf',
        title: 'Phá băng & Nhập cuộc',
        summary: 'Làm quen âm, số đếm và những câu chào hỏi đầu tiên.',
        lessons: [
            { id: 1, title: 'Làm quen với tiếng Mường', minutes: 5 },
            { id: 2, title: 'Số đếm từ một đến bốn', minutes: 5 },
            { id: 3, title: 'Giới thiệu bản thân', minutes: 6 },
            { id: 4, title: 'Giao tiếp chào hỏi cơ bản', minutes: 6 },
            { id: 5, title: 'Ôn tập chặng 1', minutes: 8 },
        ],
    },
    {
        id: 2,
        code: '02',
        tone: 'clay',
        title: 'Kết nối & Mở rộng',
        summary: 'Ghép câu, hỏi đáp và mở rộng vốn từ trong sinh hoạt hằng ngày.',
        lessons: [
            { id: 6, title: 'Lắp khung câu', minutes: 6 },
            { id: 7, title: 'Hỏi và chỉ đường', minutes: 6 },
            { id: 8, title: 'Gia đình và cách xưng hô', minutes: 7 },
            { id: 9, title: 'Thời gian trong ngày', minutes: 6 },
            { id: 10, title: 'Ôn tập chặng 2', minutes: 8 },
        ],
    },
    {
        id: 3,
        code: '03',
        tone: 'river',
        title: 'Thực hành & Ứng dụng',
        summary: 'Đưa tiếng Mường vào tình huống công việc thực tế tại cơ sở.',
        lessons: [
            { id: 11, title: 'Tiếp dân tại bộ phận một cửa', minutes: 8 },
            { id: 12, title: 'Trao đổi trong buổi họp thôn', minutes: 8 },
            { id: 13, title: 'Phổ biến thông tin đến bà con', minutes: 8 },
            { id: 14, title: 'Tổng kết hành trình', minutes: 10 },
        ],
    },
];

export const VOCABULARY = [
    { id: 'em', word: 'ếm', meaning: 'tôi', topic: 'Đại từ' },
    { id: 'moch', word: 'mốch', meaning: 'một', topic: 'Số đếm' },
    { id: 'hal', word: 'hal', meaning: 'hai', topic: 'Số đếm' },
    { id: 'pa', word: 'pa', meaning: 'ba', topic: 'Số đếm' },
    { id: 'pon', word: 'pổn', meaning: 'bốn', topic: 'Số đếm' },
];

export const HANDBOOK = [
    {
        id: 'xung-ho',
        category: 'Giao tiếp',
        title: 'Xưng hô khi làm việc với bà con',
        excerpt: 'Gợi ý cách mở lời, xưng hô phù hợp với từng lứa tuổi khi tiếp dân và đi cơ sở.',
        minutes: 4,
    },
    {
        id: 'phat-am',
        category: 'Phát âm',
        title: 'Những âm dễ nhầm với tiếng Việt',
        excerpt: 'Lưu ý về thanh điệu và phụ âm đầu để nói rõ, nghe đúng ngay từ đầu.',
        minutes: 5,
    },
    {
        id: 'hoc-hieu-qua',
        category: 'Phương pháp',
        title: 'Học 5 phút mỗi ngày thế nào cho hiệu quả',
        excerpt: 'Lặp lại ngắt quãng, nói thành tiếng và dùng ngay trong công việc.',
        minutes: 3,
    },
    {
        id: 'mau-cau-cong-vu',
        category: 'Công vụ',
        title: 'Mẫu câu thường dùng tại bộ phận một cửa',
        excerpt: 'Tổng hợp các tình huống tiếp nhận hồ sơ, hướng dẫn thủ tục thường gặp.',
        minutes: 6,
    },
    {
        id: 'van-hoa',
        category: 'Văn hoá',
        title: 'Tôn trọng phong tục khi đến thăm bản',
        excerpt: 'Những điều nên biết để giao tiếp tự nhiên, tạo thiện cảm với cộng đồng.',
        minutes: 4,
    },
];

/** Default learner state for the demo account. */
export const DEMO_PROGRESS = {
    completedLessonIds: [1, 2, 3, 4, 5, 6, 7],
    currentLessonId: 8,
    streakDays: 7,
    averageScore: 85,
    activity: [
        { id: 'a1', type: 'done', text: 'Hoàn thành Bài 7: Hỏi và chỉ đường', at: 'Hôm nay, 10:24' },
        { id: 'a2', type: 'start', text: 'Bắt đầu Bài 8: Gia đình và cách xưng hô', at: 'Hôm nay, 10:31' },
        { id: 'a3', type: 'badge', text: 'Nhận huy hiệu: Kiên trì', at: 'Hôm qua, 22:15' },
        { id: 'a4', type: 'done', text: 'Hoàn thành Bài 6: Lắp khung câu', at: 'Hôm qua, 21:10' },
    ],
    badges: [
        { id: 'khoi-dau', title: 'Khởi đầu', desc: 'Hoàn thành chặng 1', earned: true, icon: 'flag' },
        { id: 'kien-tri', title: 'Kiên trì', desc: 'Học 7 ngày liên tiếp', earned: true, icon: 'flame' },
        { id: 'thu-thach', title: 'Thử thách', desc: 'Hoàn thành 10 bài ôn luyện', earned: false, icon: 'trophy' },
    ],
};
