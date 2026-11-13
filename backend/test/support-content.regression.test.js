import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGuidance, SHADOW_GUIDANCE } from '../src/modules/content/guidance.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://unit:unit@127.0.0.1:1/unit_test';
process.env.JWT_SECRET = 'isolated-test-secret-at-least-32-characters';
const { createSupportService } = await import('../src/modules/support/support.service.js');

test('guidance uses configured pass threshold without changing language examples', () => {
    assert.equal(formatGuidance('Đạt từ 80% để hoàn thành chặng', 90), 'Đạt từ 90% để hoàn thành chặng');
    assert.equal(formatGuidance('Mỗi bài cần đạt từ 80% số câu nghe và ghép câu đúng ngay lần đầu để mở khoá bài tiếp theo.', 75), 'Mỗi bài cần đạt từ 75% số câu nghe và ghép câu đúng ngay lần đầu để mở khoá bài tiếp theo.');
    assert.equal(formatGuidance('ếm', 90), 'ếm');
});

test('legacy shadowing guidance is corrected without reseeding user database', () => {
    const legacy = 'Bản ghi âm chỉ được lưu tạm trên trình duyệt của bạn để nghe lại, không được tải lên máy chủ. Hiện MUONGLAB chưa có công nghệ chấm điểm phát âm tự động cho tiếng Mường.';
    assert.equal(formatGuidance(legacy, 80), SHADOW_GUIDANCE);
    assert.match(SHADOW_GUIDANCE, /ước lượng/);
});

for (const admin of [false, true]) test(`support ${admin ? 'admin' : 'learner'} can read beyond 300 messages and only marks loaded IDs`, async () => {
    const rows = Array.from({ length: 305 }, (_, i) => ({ id: String(i), userId: 'u', fromAdmin: !admin, body: String(i), createdAt: new Date(i), readAt: null }));
    let mark;
    const db = {
        user: { findUnique: async () => ({ id: 'u', createdAt: new Date(0) }) },
        supportMessage: {
            findMany: async (query) => {
                assert.equal(query.take, undefined);
                return rows;
            },
            updateMany: async (query) => { mark = query; },
        },
    };
    const service = createSupportService(db);
    const result = admin ? (await service.adminThread('u')).messages : await service.thread('u');
    assert.equal(result.length, 305);
    assert.equal(result.at(-1).body, '304');
    assert.equal(mark.where.id.in.length, 305);
    assert.equal(mark.where.userId, 'u');
    assert.equal(mark.where.fromAdmin, !admin);
});
