import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
    logger.info(`MUONGLAB API listening on http://localhost:${env.PORT}  (${env.NODE_ENV})`);
    logger.info(`  mail: ${env.mailEnabled ? 'SMTP' : 'console (OTP printed here)'} · AI: ${env.aiEnabled ? env.GEMINI_MODEL : 'off'} · speech: ${env.speechEnabled ? 'on' : 'off'}`);
});

prisma
    .$connect()
    .then(() => logger.info('Database connected'))
    .catch((e) => logger.error('Database connection failed – is PostgreSQL running? (npm run db:up)\n', e.message));

async function shutdown(signal) {
    logger.info(`${signal} received, shutting down…`);
    server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
