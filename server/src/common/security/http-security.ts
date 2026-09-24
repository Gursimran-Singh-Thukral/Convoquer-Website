import type { Request, Response, NextFunction } from 'express';

export function allowedOrigins(): string[] {
  const configured = [
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    ...(process.env.CORS_ORIGINS || '').split(','),
  ]
    .filter((value): value is string => !!value?.trim())
    .map((value) => new URL(value.trim()).origin);
  return [
    ...new Set(
      process.env.NODE_ENV === 'production'
        ? configured
        : [...configured, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    ),
  ];
}

/**
 * The browser origin a write came from. Some browsers/extensions omit Origin
 * (or send "null") on requests they still mark as same-origin, so fall back to
 * the Referer's origin rather than rejecting a genuine first-party request.
 */
function requestOrigin(req: Request): string | undefined {
  const origin = req.get('origin');
  if (origin && origin !== 'null') return origin;
  const referer = req.get('referer');
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/** Cookie-authenticated writes require an explicitly trusted browser origin. */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
    !req.cookies?.sessionId
  )
    return next();
  // Browser-set and unforgeable by page script: a same-origin request can't be
  // a cross-site forgery even when Origin/Referer were stripped.
  if (req.get('sec-fetch-site') === 'same-origin') return next();
  const origin = requestOrigin(req);
  if (!origin || !allowedOrigins().includes(origin)) {
    res
      .status(403)
      .json({ statusCode: 403, message: 'Request origin is not allowed' });
    return;
  }
  next();
}
