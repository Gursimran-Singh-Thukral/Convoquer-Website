import { describe, expect, it, vi } from 'vitest';
import { MatchesService } from './matches.service.js';

const setup = (permissions: Record<string, unknown>) => {
  const findMany = vi.fn().mockResolvedValue([]);
  const rbac: any = {
    getUserEffectiveAuth: vi.fn().mockResolvedValue({ permissions }),
  };
  return {
    findMany,
    svc: new MatchesService({ match: { findMany } } as never, rbac),
  };
};
const entry = (extra: Record<string, unknown>) => ({
  isGlobal: false,
  sportIds: [],
  eventIds: [],
  departmentIds: [],
  grants: [],
  ...extra,
});

describe('MatchesService.getManagedMatches', () => {
  it('limits a sport coordinator to the sports their role is scoped to', async () => {
    const { findMany, svc } = setup({
      'match.update': entry({ sportIds: ['athletics'] }),
      'result.submit': entry({ sportIds: ['athletics'] }),
    });
    await svc.getManagedMatches('u1', {});
    const where = findMany.mock.calls[0][0].where;
    expect(where.AND[0].OR).toEqual([
      { tournament: { sportId: { in: ['athletics'] } } },
      { tournament: { eventId: { in: [] } } },
      { officials: { some: { userId: 'u1' } } },
    ]);
  });

  it('shows everything to a global role', async () => {
    const { findMany, svc } = setup({
      'match.update': entry({ isGlobal: true }),
    });
    await svc.getManagedMatches('u1', {});
    expect(findMany.mock.calls[0][0].where.AND).toBeUndefined();
  });

  it('shows only their assigned fixtures to someone with no match permissions', async () => {
    const { findMany, svc } = setup({});
    await svc.getManagedMatches('u1', {});
    const or = findMany.mock.calls[0][0].where.AND[0].OR;
    expect(or).toEqual([
      { tournament: { sportId: { in: [] } } },
      { tournament: { eventId: { in: [] } } },
      { officials: { some: { userId: 'u1' } } }, // only fixtures they officiate
    ]);
  });
});
