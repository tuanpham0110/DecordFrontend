import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundRoute } from './middleware/errors.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { contentRoutes } from './modules/content/content.routes.js';
import { learningRoutes } from './modules/learning/learning.routes.js';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { speechRoutes } from './modules/speech/speech.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';

export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    if (env.TRUST_PROXY) app.set('trust proxy', 1);

    app.use(helmet());
    app.use(
        cors({
            origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
            credentials: false,
            maxAge: 600,
        })
    );
    // compression would buffer the AI SSE stream
    app.use(compression({ filter: (req, res) => !req.path.startsWith('/api/ai') && compression.filter(req, res) }));
    app.use(express.json({ limit: '100kb' }));

    if (!env.isProd && env.NODE_ENV !== 'test') {
        app.use((req, res, next) => {
            const t0 = Date.now();
            res.on('finish', () => console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - t0}ms)`));
            next();
        });
    }

    app.get('/api/health', async (_req, res) => {
        let db = 'up';
        try {
            await prisma.$queryRaw`SELECT 1`;
        } catch {
            db = 'down';
        }
        res.status(db === 'up' ? 200 : 503).json({ status: db === 'up' ? 'ok' : 'degraded', db, time: new Date().toISOString() });
    });

    /** Which optional services are configured – lets the UI show/hide features. */
    app.get('/api/meta', (_req, res) => {
        res.json({
            ai: env.aiEnabled,
            aiModel: env.aiEnabled ? env.GEMINI_MODEL : null,
            speech: env.speechEnabled,
            speechEngine: env.speechEngine, // 'native' (pronunciation service) | 'ai' (Gemini estimate) | null
            mail: env.mailEnabled,
            emailVerification: env.verificationRequired,
            passwordReset: env.mailEnabled || !env.isProd,
            googleClientId: env.GOOGLE_CLIENT_ID || null,
            microsoftClientId: env.MICROSOFT_CLIENT_ID || null,
            supportEmail: env.SUPPORT_EMAIL || null,
        });
    });

    app.use('/api', apiLimiter);
    app.use('/api/auth', authRoutes);
    app.use('/api/content', contentRoutes);
    app.use('/api/me', learningRoutes);
    app.use('/api/ai', aiRoutes);
    app.use('/api/speech', speechRoutes);
    app.use('/api/admin', adminRoutes);

    app.use('/api', notFoundRoute);
    app.use(errorHandler);
    return app;
}
