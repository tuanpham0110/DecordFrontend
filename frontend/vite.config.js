import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        server: {
            port: 5173,
            // In dev the browser calls /api on the Vite server, which forwards to the backend.
            proxy: {
                '/api': { target: env.VITE_API_PROXY || 'http://localhost:4000', changeOrigin: true },
            },
        },
    };
});
