import { describe, expect, it, vi } from 'vitest';
import { DashboardController } from './dashboard.controller.js';

const setup = (entry: unknown) => {
  const getPendingApprovals = vi.fn().mockResolvedValue([]);
  const rbac: any = {
    getUserEffectiveAuth: vi.fn().mockResolvedValue({
      permissions: entry ? { 'result.approve': entry } : {},
    }),
  };
  const ctrl = new DashboardController({ getPendingApprovals } as never, rbac);
  const req: any = { user: { id: 'u1' } };
  return { ctrl, getPendingApprovals, req };
};
const scoped = (sportIds: string[]) => ({
  isGlobal: false,
  sportIds,
  eventIds: [],
  departmentIds: [],
});

describe('approvals queue', () => {
  it('works for a coordinator with two sports (Men and Women) with nothing passed in', async () => {
    const { ctrl, getPendingApprovals, req } = setup(scoped(['bm', 'bw']));
    await ctrl.getPendingApprovals(req);
    expect(getPendingApprovals).toHaveBeenCalledWith(undefined, undefined, {
      sportIds: ['bm', 'bw'],
      eventIds: [],
    });
  });

  it('refuses a sport outside the coordinator’s scope and anyone without the permission', async () => {
    const a = setup(scoped(['bm', 'bw']));
    await expect(a.ctrl.getPendingApprovals(a.req, 'cricket')).rejects.toThrow(
      /own sport/,
    );
    const b = setup(undefined);
    await expect(b.ctrl.getPendingApprovals(b.req)).rejects.toThrow(
      /result.approve/,
    );
  });

  it('gives a global role the full queue', async () => {
    const { ctrl, getPendingApprovals, req } = setup({
      isGlobal: true,
      sportIds: [],
      eventIds: [],
    });
    await ctrl.getPendingApprovals(req);
    expect(getPendingApprovals).toHaveBeenCalledWith(undefined, undefined);
  });
});
