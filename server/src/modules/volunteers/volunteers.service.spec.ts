import { describe, it, expect, beforeEach } from 'vitest';
import { VolunteersService } from './volunteers.service.js';
import { recordStore } from '../../../test/record-store.mock.js';

describe('VolunteersService', () => {
  let service: VolunteersService;

  beforeEach(() => {
    const volunteer = recordStore(
      Array.from({ length: 4 }, (_, index) => ({
        id: `vol-${index + 1}`,
        volunteerCode: `VOL-2026-00${index + 1}`,
        name: 'Fixture Volunteer',
        email: 'fixture@iitjammu.ac.in',
        department: 'Operations',
        shift: 'MORNING',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    service = new VolunteersService(
      { volunteer } as any,
      { sendVenueAssignment: async () => {} } as any,
    );
  });

  it('should list default volunteers', async () => {
    const list = await service.getVolunteers();
    expect(list.length).toBeGreaterThanOrEqual(4);
    expect(list[0].volunteerCode).toBe('VOL-2026-001');
  });

  it('should filter volunteers by shift and department', async () => {
    const morning = await service.getVolunteers({ shift: 'MORNING' });
    expect(morning.length).toBeGreaterThanOrEqual(2);
    morning.forEach((v) => expect(v.shift).toBe('MORNING'));
  });

  it('should add a new volunteer strictly from backend', async () => {
    const newVol = await service.createVolunteer(
      {
        name: 'Tarun Saxena',
        email: 'tarun.vol@iitjammu.ac.in',
        department: 'Scorekeeper Logistics',
        shift: 'EVENING',
        venueId: 'venue-sac-hall',
      },
      'admin-backend-user',
    );

    expect(newVol.id).toBeDefined();
    expect(newVol.volunteerCode).toMatch(/^VOL-2026-[A-F0-9]{8}$/);
    expect(newVol.assignedBy).toBe('admin-backend-user');

    const fetched = await service.getVolunteerById(newVol.id);
    expect(fetched.name).toBe('Tarun Saxena');
  });

  it('should update volunteer shift and status', async () => {
    const updated = await service.updateVolunteer('vol-1', {
      shift: 'NIGHT',
      status: 'ON_BREAK',
    });

    expect(updated.shift).toBe('NIGHT');
    expect(updated.status).toBe('ON_BREAK');
  });

  it('should delete a volunteer', async () => {
    const res = await service.deleteVolunteer('vol-4');
    expect(res.success).toBe(true);
    await expect(service.getVolunteerById('vol-4')).rejects.toThrow();
  });
});
