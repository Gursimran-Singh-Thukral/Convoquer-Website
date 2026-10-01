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
