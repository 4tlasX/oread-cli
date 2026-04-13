/**
 * Express API server — loaded only when --api flag is passed.
 * All routes are thin wrappers over the core engine.
 * No business logic lives here.
 */
import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import chatRouter from './routes/chat.js';
import sessionsRouter from './routes/sessions.js';
import templatesRouter from './routes/templates.js';
import memoryRouter from './routes/memory.js';
import modelsRouter from './routes/models.js';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(s => s.trim());

export function createServer() {
  const app = express();

  app.use(cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, same-origin)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '256kb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', service: 'oread-cli' });
  });

  // Routes
  app.use('/api/chat', chatRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/memory', memoryRouter);
  app.use('/api/models', modelsRouter);

  // 404 + error handlers (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function startServer(port = 3002) {
  const app = createServer();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      console.log(`[oread] API server listening on http://127.0.0.1:${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}
