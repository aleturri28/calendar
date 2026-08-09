import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);

  return app;
}
