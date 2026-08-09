import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { authRouter } from './routes/auth.js';
import { daysRouter } from './routes/days.js';
import { calendarRouter } from './routes/calendar.js';
import { commentsRouter } from './routes/comments.js';
import { feedRouter, timelineRouter } from './routes/stream.js';
import { eventsRouter } from './routes/events.js';

const here = dirname(fileURLToPath(import.meta.url));
const clientDist = join(here, '../../client/dist');

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/days', daysRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/feed', feedRouter);
  app.use('/api/timeline', timelineRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api', commentsRouter);

  // Il 404 JSON sotto /api deve venire prima del fallback SPA, altrimenti una
  // chiamata API sbagliata riceve HTML e il client va in errore di parsing.
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*splat', (req, res) => res.sendFile(join(clientDist, 'index.html')));
  }

  return app;
}
