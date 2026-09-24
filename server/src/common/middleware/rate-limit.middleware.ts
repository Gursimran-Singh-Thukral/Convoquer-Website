import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal in-memory sliding-window rate limiter. No new dependency (the
 * obvious choice, @nestjs/throttler, doesn't yet publish a build compatible
 * with this project's NestJS 12), single-process only — sufficient for this
 * deployment's current single-instance topology.
 */
function makeLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    if (buckets.size > 10000) {
      for (const [address, value] of buckets)
        if (value.resetAt <= now) buckets.delete(address);
    }
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      throw new HttpException(
        'Too many requests. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    next();
  };
}

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  // 15 attempts per 5 minutes per IP against auth endpoints.
  private readonly limiter = makeLimiter(15, 5 * 60 * 1000);

  use(req: Request, res: Response, next: NextFunction) {
    if (req.path.endsWith('/me') || req.path.endsWith('/logout')) return next();
    this.limiter(req, res, next);
  }
}

@Injectable()
export class GlobalRateLimitMiddleware implements NestMiddleware {
  // 300 requests per minute per IP across the whole API as a DoS/scraping backstop.
  private readonly limiter = makeLimiter(300, 60 * 1000);

  use(req: Request, res: Response, next: NextFunction) {
    this.limiter(req, res, next);
  }
}
