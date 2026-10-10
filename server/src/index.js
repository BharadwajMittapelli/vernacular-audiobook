import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';
import audioRouter from './routes/audioRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

// CRITICAL: Trust proxy for Render/load balancer deployments
// Without this, rate limiter sees all requests as coming from the load balancer IP
app.set('trust proxy', 1);

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));

app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after a minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use X-Forwarded-For header when behind proxy
  keyGenerator: (req) => req.ip,
});

app.use(apiLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/audio', authMiddleware);
app.use('/api/audio', audioRouter);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;