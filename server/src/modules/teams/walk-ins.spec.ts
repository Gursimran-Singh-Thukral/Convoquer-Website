import { describe, expect, it, vi } from 'vitest';
import { ParticipantsService } from './participants.service.js';

describe('ParticipantsService.getWalkIns', () => {
  it('asks only for gate-registered passes and filters by search text', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: '1',
        name: 'Asha Verma',
        gatePassNumber: 'CQ26-AUD-7A9B',
        category: 'AUDIENCE',
        institute: { name: 'Govt College' },
        contactNumber: null,
        rollNumber: null,
      },
      {
        id: '2',
        name: 'Ravi Kumar',
        gatePassNumber: 'CQ26-GUEST-11AA',
        category: 'GUEST',
        institute: null,
        contactNumber: null,
        rollNumber: null,
      },
    ]);
    const svc = new ParticipantsService({ participant: { findMany } } as never);
    const all = await svc.getWalkIns();
    expect(all).toHaveLength(2);
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { gatePassNumber: { startsWith: 'CQ26-AUD' } },
      { gatePassNumber: { startsWith: 'CQ26-GUEST' } },
    ]);
    expect((await svc.getWalkIns({ query: 'govt' })).map((p) => p.id)).toEqual([
      '1',
    ]);
    expect(
      (await svc.getWalkIns({ query: 'guest-11' })).map((p) => p.id),
    ).toEqual(['2']);
    await svc.getWalkIns({ category: 'GUEST' });
    expect(findMany.mock.calls[3][0].where.category).toBe('GUEST');
  });
});

describe('walk-in pass access', () => {
  it('is locked to the sole-admin account on top of participant.view', async () => {
    const { TeamsController } = await import('./teams.controller.js');
    const guards = Reflect.getMetadata(
      '__guards__',
      TeamsController.prototype.getWalkIns,
    ) as { name: string }[];
    expect(guards.map((g) => g.name)).toEqual([
      'SessionGuard',
      'PermissionsGuard',
      'StrictSoleAdminGuard',
    ]);
    const delGuards = Reflect.getMetadata(
      '__guards__',
      TeamsController.prototype.deleteParticipant,
    ) as { name: string }[];
    expect(delGuards.map((g) => g.name)).toContain('StrictSoleAdminGuard');
  });
});

describe('sole-admin checks', () => {
  it('the strict guard fails closed when no sole admin is configured', async () => {
    const { StrictSoleAdminGuard } =
      await import('../../common/guards/sole-admin.guard.js');
    const old = process.env.SOLE_ADMIN_EMAIL;
    delete process.env.SOLE_ADMIN_EMAIL;
    const ctx = (user: unknown) =>
      ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;
    expect(() =>
      new StrictSoleAdminGuard().canActivate(ctx({ email: 'a@x.com' })),
    ).toThrow();
    process.env.SOLE_ADMIN_EMAIL = 'boss@x.com';
    expect(() =>
      new StrictSoleAdminGuard().canActivate(ctx({ email: 'other@x.com' })),
    ).toThrow();
    expect(
      new StrictSoleAdminGuard().canActivate(ctx({ email: 'boss@x.com' })),
    ).toBe(true);
    process.env.SOLE_ADMIN_EMAIL = old;
  });

  it('hides walk-in photos and ID pictures from everyone but the sole admin', async () => {
    const row = {
      id: '1',
      name: 'A',
      gatePassNumber: 'CQ26-AUD-1',
      photographUrl: 'p',
      idDocumentUrl: 'i',
      category: 'AUDIENCE',
      institute: null,
      teamMembers: [],
      rollNumber: null,
      contactNumber: null,
    };
    const findMany = vi.fn().mockResolvedValue([row]);
    const svc = new ParticipantsService({ participant: { findMany } } as never);
    expect((await svc.getParticipants({}))[0]).toMatchObject({
      photographUrl: null,
      idDocumentUrl: null,
    });
    expect((await svc.getParticipants({}, true))[0]).toMatchObject({
      photographUrl: 'p',
      idDocumentUrl: 'i',
    });
  });
});
