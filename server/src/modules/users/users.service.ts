import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  encryptField,
  decryptField,
  blindIndex,
} from '../../common/crypto/field-crypto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateFromGoogle(profile: any): Promise<any> {
    const { id, emails, displayName, photos } = profile;
    const email = emails[0].value;
    const emailHash = blindIndex(email)!;
    const profilePhotoUrl =
      photos && photos.length > 0 ? photos[0].value : null;

    // Override the global omit here — this internal comparison below needs
    // the real googleSubjectId, unlike every other (client-facing) read.
    let user = await this.prisma.user.findUnique({
      where: { emailHash },
      omit: { emailHash: false, googleSubjectId: false },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: encryptField(email)!,
          emailHash,
          name: displayName,
          googleSubjectId: id,
          profilePhotoUrl,
        },
      });
    } else {
      if (
        user.googleSubjectId !== id ||
        user.profilePhotoUrl !== profilePhotoUrl
      ) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleSubjectId: id,
            profilePhotoUrl,
          },
        });
      }
    }

    return user;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async getUsers(query?: string) {
    const users = await this.prisma.user.findMany({
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Email is encrypted at rest and can't be substring-matched in SQL, so
    // the filter is applied here against the decrypted value. The response
    // interceptor also decrypts these before they reach the client, but we
    // need the plaintext now to filter on it.
    if (!query) return users;
    const q = query.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (decryptField(u.email) || '').toLowerCase().includes(q),
    );
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
