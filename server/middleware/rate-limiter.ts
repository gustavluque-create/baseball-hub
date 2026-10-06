import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const hits = new Map<string, RateLimitRecord>();
  const { windowMs, max, message } = options;

  // Periodic cleanup every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetAt) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown_client';

    const now = Date.now();
    let record = hits.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      hits.set(key, record);
      return next();
    }

    record.count++;

    if (record.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      return res.status(429).json({
        success: false,
        error: message || 'Demasiadas solicitudes. Por favor, espere antes de reintentar.',
        retryAfterSeconds,
      });
    }

    next();
  };
}

// 1. Limiter for Admin Login attempts (10 attempts per 15 minutes)
export const adminLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de acceso administrativo. Intente nuevamente en 15 minutos.',
});

// 2. Limiter for Public News Comments (15 comments per 15 minutes)
export const commentsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Límite de comentarios excedido temporalmente. Por favor, espere unos minutos.',
});

// 3. Limiter for FCM Device Registration (30 requests per 15 minutes)
export const fcmRegisterLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Límite de registros de notificación alcanzado. Intente más tarde.',
});

// 4. Limiter for General Sensitive Endpoints (100 per minute)
export const sensitiveWriteLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Demasiadas operaciones de escritura. Reduzca la frecuencia de envío.',
});
