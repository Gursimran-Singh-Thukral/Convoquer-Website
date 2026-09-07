import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateFromGoogle(profile: any): Promise<any> {
    const { id, emails, displayName, photos } = profile;
    const email = emails[0].value;
    const profilePhotoUrl =
      photos && photos.length > 0 ? photos[0].value : null;

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
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
}
