import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule, ObserveInstrument } from './app.module.js';
import cookieParser from 'cookie-parser';
import { DecryptResponseInterceptor } from './common/interceptors/decrypt-response.interceptor.js';
import {
  allowedOrigins,
  csrfProtection,
} from './common/security/http-security.js';
import { RequestValidationPipe } from './common/validation/request-validation.pipe.js';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET
      ? { instrument: ObserveInstrument }
      : {},
  );
  // Default Express JSON limit is 100kb, which the on-spot pass form blows
  // past once it embeds a photograph + ID document as base64 data URLs.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(csrfProtection);
  app.enableShutdownHooks();
  if (process.env.TRUST_PROXY) {
    app
      .getHttpAdapter()
      .getInstance()
      .set(
        'trust proxy',
        process.env.TRUST_PROXY.split(',').map((value) => value.trim()),
      );
  }
  app.useGlobalInterceptors(new DecryptResponseInterceptor());
  app.useGlobalPipes(new RequestValidationPipe());
  app.use((_req: unknown, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    // API-only responses (JSON) — this CSP is a defense-in-depth backstop
    // against the response ever being rendered as HTML (e.g. a
    // misconfigured proxy, or a browser sniffing an error page).
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  });
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins().includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  });
  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Convoquer Server running on port ${port}`);
}
await bootstrap();
