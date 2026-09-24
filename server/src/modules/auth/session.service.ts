import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const secret = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(secret, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return `${session.id}.${secret}`;
  }

  async validateSession(token: string): Promise<any> {
    if (
      typeof token !== 'string' ||
      !/^[0-9a-f-]{36}\.[0-9a-f]{64}$/i.test(token)
    ) {
      throw new UnauthorizedException('Invalid session token format');
    }

    const [sessionId, secret] = token.split('.');

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (
      new Date() >= session.expiresAt ||
      Date.now() - session.lastSeenAt.getTime() > 24 * 60 * 60 * 1000
    ) {
      throw new UnauthorizedException('Session has expired');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const isMatch = await bcrypt.compare(secret, session.tokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid session secret');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return { session, user: session.user };
  }

  async revokeSession(
    sessionId: string,
    reason: string = 'USER_LOGOUT',
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });
  }
}
