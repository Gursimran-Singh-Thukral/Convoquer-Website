import { chromium, request, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const web = 'http://127.0.0.1:3100';
const base = 'http://127.0.0.1:4100/api';
const output = `reports/tournament-rehearsal/events-access-${Date.now()}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [],
  pageErrors = [];
const pass = (name) => {
  checks.push({ name, status: 'PASS' });
  console.log(`PASS ${name}`);
};
const api = await request.newContext({ extraHTTPHeaders: { Origin: web } });
async function call(method, path, data, status = 200) {
  const response = await api.fetch(`${base}${path}`, { method, data });
  assert.equal(response.status(), status, `${method} ${path}: ${await response.text()}`);
  return response.json();
}
try {
  await call('POST', '/auth/dev-login', { role: 'REHEARSAL_NO_ROLE' }, 201);
  const effective = await call('GET', '/users/me/permissions');
  assert.equal(effective.roles.length, 0);
  await call('GET', '/dashboard/overview', undefined, 403);
  const outsider = await browser.newContext({ storageState: await api.storageState() });
  const denied = await outsider.newPage();
  const forbiddenFetches = [];
  denied.on('request', (req) => {
    if (/\/api\/(dashboard\/|content\/manage)/.test(req.url())) forbiddenFetches.push(req.url());
  });
  for (const route of ['/organizer', '/organizer/content', '/organizer/events']) {
    await denied.goto(`${web}${route}`);
    await expect(denied).toHaveURL(`${web}/access-denied`, { timeout: 60000 });
    await expect(denied.locator('a[href="/organizer"]')).toHaveCount(0);
  }
  assert.deepEqual(forbiddenFetches, []);
  await denied.screenshot({ path: `${output}/unauthorized.png`, fullPage: true });
  pass(
    'Signed-in account without a role is denied all three organizer pages before private data loads; dashboard API returns 403',
  );
  await call('POST', '/events', { name: 'Denied' }, 403);
  await outsider.close();
  await call('POST', '/auth/dev-login', { role: 'CONVENER' }, 201);
  const context = await browser.newContext({
    storageState: await api.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${web}/organizer/content`);
  const rail = page.locator('[data-purpose="organizer-nav-rail"]');
  for (const label of ['Events', 'Content', 'Tournaments', 'Sports & venues'])
    await expect(rail.getByRole('link', { name: label, exact: true })).toBeVisible({
      timeout: 60000,
    });
  await page.screenshot({ path: `${output}/content-navigation.png`, fullPage: true });
  pass(
    'Content dashboard includes working organizer navigation for Events, Content, Tournaments and Sports & venues',
  );
  await rail.getByRole('link', { name: 'Events', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Events dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  const name = `Browser Event ${Date.now()}`;
  await page.getByLabel('Event name', { exact: true }).fill(name);
  await page.getByLabel('URL slug').fill(`browser-event-${Date.now()}`);
  await page.getByLabel('Edition', { exact: true }).fill('Test 2027');
  await page.getByLabel('Start date and time').fill('2027-03-01T09:00');
  await page.getByLabel('End date and time').fill('2027-03-03T18:00');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Generated rehearsal event; no real registrations.');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  let card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(card).toBeVisible();
  const id = await card.getAttribute('data-event-id');
  await card.getByRole('button', { name: 'Edit event', exact: true }).click();
  await page.getByLabel('Event name', { exact: true }).fill(`${name} Updated`);
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  card = page.locator(`article[data-event-id="${id}"]`);
  await expect(card.getByRole('heading')).toHaveText(`${name} Updated`);
  await page.reload();
  await expect(card.getByRole('heading')).toHaveText(`${name} Updated`);
  await card.getByRole('button', { name: 'Archive event', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(card).toContainText('ARCHIVED');
  await page.screenshot({ path: `${output}/events-dashboard.png`, fullPage: true });
  await card.getByRole('button', { name: 'Delete event', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(card).toHaveCount(0);
  await call('GET', `/events/${id}`, undefined, 404);
  pass(
    'Browser creates, reads, edits, reloads persisted changes, archives and deletes an empty event',
  );
  const events = await call('GET', '/events');
  const populated = events.find((event) => event._count.sports > 0);
  assert(populated);
  await call('DELETE', `/events/${populated.id}`, undefined, 409);
  await call('PATCH', `/events/${populated.id}`, { endDate: '2000-01-01T00:00:00.000Z' }, 400);
  await call('PATCH', `/events/${populated.id}`, { status: 'UNKNOWN' }, 400);
  pass('Backend rejects deleting populated events, reversed dates and unknown event statuses');
  await call('POST', '/auth/dev-login', { role: 'REHEARSAL_NO_ROLE' }, 201);
  await call('PATCH', `/events/${populated.id}`, { name: 'Denied' }, 403);
  await call('DELETE', `/events/${populated.id}`, undefined, 403);
  pass('Unassigned account cannot create, edit or delete events through the API');
  assert.deepEqual(pageErrors, []);
  await context.close();
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ completedAt: new Date().toISOString(), checks, pageErrors }, null, 2),
  );
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify({ checks, error: String(error), pageErrors }, null, 2),
  );
  throw error;
} finally {
  await api.dispose();
  await browser.close();
}
