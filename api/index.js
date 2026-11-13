// Vercel serverless entry: mọi request /api/* được chuyển vào Express app của backend.
// Chạy local vẫn dùng backend/src/server.js như cũ.
import { createApp } from '../backend/src/app.js';

export default createApp();
