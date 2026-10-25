import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';
import audioRouter from './routes/audioRoutes.js';
import storefrontRouter from './routes/storefrontRoutes.js';
import voiceRouter from './routes/voiceRoutes.js';
import documentRouter from './routes/documentRoutes.js';
import studioRoutes from './routes/studioRoutes.js';
import settingsRouter from './routes/settingsRoutes.js';
import { isCreditBypassed } from './services/creditService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (isCreditBypassed()) {
  console.warn('[DEV_BYPASS_CREDITS ACTIVE] Credit enforcement is disabled for local testing. Never set this flag in production.');
}

const app = express();
const PORT = process.env.PORT || 4001;

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5175';

// CRITICAL: Trust proxy for Render/load balancer deployments
// Without this, rate limiter sees all requests as coming from the load balancer IP
app.set('trust proxy', 1);

// cors() has no `skip` option and app-level cors(restricted) always runs for
// every request. Use a per-request delegate so /api/storefront gets wildcard
// CORS (public iframe embeds) while the rest of the app stays restricted.
const corsDelegate = (req, callback) => {
  if (req.path.startsWith('/api/storefront')) {
    return callback(null, { origin: '*' });
  }
  callback(null, {
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });
};

app.use(cors(corsDelegate));

app.use(express.json({ limit: '50mb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: 'Too many requests, please slow down',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use X-Forwarded-For header when behind proxy
  keyGenerator: (req) => req.ip,
  // Storefront embed and /api/voices have their own limiters; spend endpoints
  // get tight per-route buckets. Health probe must not burn budget.
  skip: (req) =>
    req.path.startsWith('/api/storefront') ||
    req.path.startsWith('/api/audio/synthesize-async') ||
    req.path.startsWith('/api/voices') ||
    req.path === '/health',
});

app.use(apiLimiter);

// Bulk endpoint gets its own tighter 2/min bucket; mount BEFORE the router so
// it actually runs, and apiLimiter skips this path above.
app.use('/api/audio/synthesize-async', rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: 'Too many bulk requests, please try again later' },
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/audio', authMiddleware);
app.use('/api/audio', audioRouter);

// Public storefront embed API. No authMiddleware; embed is read-only public
// metadata keyed by audio_generations.id (the unique generation PK).
app.use('/api/storefront', storefrontRouter);

// Public voice catalog. No auth; CORS stays frontend-restricted (not wildcard).
app.use('/api/voices', voiceRouter);

// Document upload (PDF/EPUB server-side parsing). Stateless parse-and-return.
app.use('/api/documents', documentRouter);

// Studio API — protected by authMiddleware.
app.use('/api/studio', authMiddleware, studioRoutes);

// Settings API — protected by authMiddleware.
app.use('/api/settings', authMiddleware, settingsRouter);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Graceful shutdown: let in-flight jobs finish
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  try {
    const { queue } = await import('./queues/synthesisQueue.js');
    await queue.close();
  } catch {}
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  try {
    const { queue } = await import('./queues/synthesisQueue.js');
    await queue.close();
  } catch {}
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;