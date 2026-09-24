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
  const origin = req.get('origin');
  if (!origin || !allowedOrigins().includes(origin)) {
    res
      .status(403)
      .json({ statusCode: 403, message: 'Request origin is not allowed' });
    return;
  }
  next();
}
