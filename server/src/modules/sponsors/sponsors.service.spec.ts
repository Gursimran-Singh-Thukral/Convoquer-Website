import { describe, it, expect, beforeEach } from 'vitest';
import { SponsorsService } from './sponsors.service.js';
import { recordStore } from '../../../test/record-store.mock.js';

describe('SponsorsService', () => {
  let service: SponsorsService;

  beforeEach(() => {
    const sponsor = recordStore(
      Array.from({ length: 6 }, (_, index) => ({
        id: `spon-${index + 1}`,
        name: index === 0 ? 'SPORTS J&K' : 'Fixture Sponsor',
        role: 'Test role',
        tier: index < 2 ? 'TITLE' : 'ASSOCIATE',
        orderIndex: index + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    service = new SponsorsService({ sponsor } as any);
  });

  it('should list default sponsors ordered by orderIndex', async () => {
    const sponsors = await service.getSponsors();
    expect(sponsors.length).toBeGreaterThanOrEqual(6);
    expect(sponsors[0].name).toBe('SPORTS J&K');
  });

  it('should filter sponsors by tier', async () => {
    const titleSponsors = await service.getSponsors({ tier: 'TITLE' });
    expect(titleSponsors.length).toBeGreaterThanOrEqual(2);
    titleSponsors.forEach((s) => expect(s.tier).toBe('TITLE'));
  });

  it('should create a new sponsor from backend', async () => {
    const created = await service.createSponsor(
      {
        name: 'TATA MOTORS',
        role: 'Official Logistics Ally',
        tier: 'POWERED_BY',
        color: 'text-[#FFD700]',
      },
      'user-sponsorship-head',
    );

    expect(created.id).toBeDefined();
    expect(created.name).toBe('TATA MOTORS');
    expect(created.addedBy).toBe('user-sponsorship-head');

    const found = await service.getSponsorById(created.id);
    expect(found.role).toBe('Official Logistics Ally');
  });

  it('should update sponsor details', async () => {
    const updated = await service.updateSponsor('spon-1', {
      name: 'SPORTS J&K ACADEMY',
      role: 'Chief Grand Patron',
    });

    expect(updated.name).toBe('SPORTS J&K ACADEMY');
    expect(updated.role).toBe('Chief Grand Patron');
  });

  it('should delete a sponsor', async () => {
    const res = await service.deleteSponsor('spon-5');
    expect(res.success).toBe(true);
    await expect(service.getSponsorById('spon-5')).rejects.toThrow();
  });
});
