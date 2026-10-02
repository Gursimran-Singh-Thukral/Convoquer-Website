import { describe, expect, it, vi } from 'vitest';
import { InstitutesService } from './institutes.service.js';
import { ParticipantsService } from './participants.service.js';

describe('participating institutes', () => {
  it('lists only institutes with a team or an athlete/official by default', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const svc = new InstitutesService({ institute: { findMany } } as never);
    await svc.getInstitutes('e1');
    expect(findMany.mock.calls[0][0].where.OR).toEqual([
      { teams: { some: {} } },
      { participants: { some: { category: { in: ['ATHLETE', 'OFFICIAL'] } } } },
    ]);
    await svc.getInstitutes('e1', undefined, true);
    expect(findMany.mock.calls[1][0].where.OR).toBeUndefined();
  });
});

describe('walk-in registration never creates an institute', () => {
  const dto = {
    eventId: 'e1',
    name: 'Asha',
    contactNumber: '9876543210',
    photographUrl: 'data:image/png;base64,AAAA',
    idDocumentUrl: 'data:image/png;base64,BBBB',
    category: 'AUDIENCE',
  };
  const make = (inst: unknown) => {
    const prisma: any = {
      event: { findUnique: vi.fn().mockResolvedValue({ id: 'e1' }) },
      institute: {
        findUnique: vi.fn().mockResolvedValue(inst),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      participant: {
        create: vi.fn(async ({ data }: any) => ({
          id: 'p',
          ...data,
          institute: null,
        })),
      },
    };
    return { prisma, svc: new ParticipantsService(prisma) };
  };

  it('attaches the chosen institute and creates nothing', async () => {
    const { prisma, svc } = make({ id: 'i1', eventId: 'e1' });
    await svc.registerOnSpotAttendee({ ...dto, instituteId: 'i1' });
    expect(prisma.participant.create.mock.calls[0][0].data.instituteId).toBe(
      'i1',
    );
    expect(prisma.institute.create).not.toHaveBeenCalled();
  });

  it('ignores a typed name that matches no institute instead of inventing one', async () => {
    const { prisma, svc } = make(null);
    await svc.registerOnSpotAttendee({
      ...dto,
      instituteName: 'Some Random School',
    });
    expect(prisma.institute.create).not.toHaveBeenCalled();
    expect(
      prisma.participant.create.mock.calls[0][0].data.instituteId,
    ).toBeUndefined();
  });

  it('rejects an institute id from another event', async () => {
    const { svc } = make({ id: 'i9', eventId: 'other' });
    await expect(
      svc.registerOnSpotAttendee({ ...dto, instituteId: 'i9' }),
    ).rejects.toThrow(/Choose a college/);
  });
});
