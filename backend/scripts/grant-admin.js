/**
 * Gives (or removes) the admin role.
 *   npm run admin:grant -- someone@example.com            → admin
 *   npm run admin:grant -- someone@example.com --revoke   → back to a normal learner
 *   npm run admin:grant -- someone@example.com --create "Họ Tên"
 *        creates the account when it does not exist yet, with a random password that is
 *        printed once – sign in and change it in "Tài khoản".
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const email = args.find((a) => a.includes('@'))?.trim().toLowerCase();
const revoke = args.includes('--revoke');
const createAt = args.indexOf('--create');
if (!email) {
    console.error('Cách dùng: npm run admin:grant -- <email> [--revoke] [--create "Họ Tên"]');
    process.exit(1);
}

const prisma = new PrismaClient();
try {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user && createAt >= 0) {
        const password = crypto.randomBytes(9).toString('base64url') + '7a';
        user = await prisma.user.create({
            data: { email, name: args[createAt + 1] && !args[createAt + 1].startsWith('--') ? args[createAt + 1] : 'Quản trị viên', passwordHash: await bcrypt.hash(password, 10), verified: true, role: 'admin' },
        });
        console.log(`✓ Đã tạo tài khoản quản trị ${email}`);
        console.log(`  Mật khẩu tạm: ${password}`);
        console.log('  Hãy đăng nhập và đổi mật khẩu trong mục Tài khoản.');
    } else if (!user) {
        console.error(`✗ Chưa có tài khoản ${email}. Đăng ký trước, hoặc thêm --create "Họ Tên".`);
        process.exitCode = 1;
    } else {
        await prisma.user.update({ where: { email }, data: { role: revoke ? 'user' : 'admin' } });
        console.log(revoke ? `✓ ${email} không còn là quản trị viên.` : `✓ ${email} đã là quản trị viên.`);
    }
} finally {
    await prisma.$disconnect();
}
