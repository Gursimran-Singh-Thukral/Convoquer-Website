import { describe, it, expect, afterEach } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { SoleAdminGuard } from './sole-admin.guard.js';
import { encryptField } from '../crypto/field-crypto.js';

function contextWithUser(email: string | null): ExecutionContext {
  const request = { user: email ? { email: encryptField(email) } : null };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SoleAdminGuard', () => {
  const ORIGINAL = process.env.SOLE_ADMIN_EMAIL;

  afterEach(() => {
    process.env.SOLE_ADMIN_EMAIL = ORIGINAL;
  });

  it('no-ops (allows through) when SOLE_ADMIN_EMAIL is unset', () => {
    delete process.env.SOLE_ADMIN_EMAIL;
    const guard = new SoleAdminGuard();
    expect(guard.canActivate(contextWithUser('anyone@iitjammu.ac.in'))).toBe(
      true,
    );
  });

  it('allows the exact configured email through, case-insensitively', () => {
    process.env.SOLE_ADMIN_EMAIL = '2025uce0044@iitjammu.ac.in';
    const guard = new SoleAdminGuard();
    expect(
      guard.canActivate(contextWithUser('2025UCE0044@iitjammu.ac.in')),
    ).toBe(true);
  });

  it('rejects every other account once SOLE_ADMIN_EMAIL is set', () => {
    process.env.SOLE_ADMIN_EMAIL = '2025uce0044@iitjammu.ac.in';
    const guard = new SoleAdminGuard();
    expect(() =>
      guard.canActivate(contextWithUser('someone-else@iitjammu.ac.in')),
    ).toThrow('This section is restricted to a single account.');
  });

  it('rejects an unauthenticated request', () => {
    process.env.SOLE_ADMIN_EMAIL = '2025uce0044@iitjammu.ac.in';
    const guard = new SoleAdminGuard();
    expect(() => guard.canActivate(contextWithUser(null))).toThrow(
      'Authentication required',
    );
  });
});
