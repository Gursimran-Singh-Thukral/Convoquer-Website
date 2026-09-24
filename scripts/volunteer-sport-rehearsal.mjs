import { chromium, request, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = 'http://127.0.0.1:3100';
const base = 'http://127.0.0.1:4100/api';
const stamp = Date.now();
const output = `reports/tournament-rehearsal/volunteer-sport-${stamp}`;
await mkdir(output, { recursive: true });
const api = await request.newContext({ extraHTTPHeaders: { Origin: origin } });
const checks = [],
  errors = [];
const pass = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
async function call(method, path, data, status = 200) {
  const response = await api.fetch(`${base}${path}`, { method, data });
  assert.equal(response.status(), status, `${path}: ${await response.text()}`);
  return response.json();
}
let browser;
try {
  await call('POST', '/auth/dev-login', { role: 'CONVENER' }, 201);
  const event = await call(
    'POST',
    '/events',
    {
      name: `Volunteer rehearsal ${stamp}`,
      slug: `volunteer-${stamp}`,
      edition: 'Test',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    },
    201,
  );
  const sport = await call('POST', '/sports', { eventId: event.id, name: 'Chess' }, 201);
  assert.equal(sport.scoringMode, 'RESULT_ONLY');
  const cup = await call(
    'POST',
    '/tournaments',
    {
      eventId: event.id,
      sportId: sport.id,
      name: 'Chess scoring rehearsal',
      format: 'ROUND_ROBIN',
    },
    201,
  );
  const fixture = await call(
    'POST',
    '/matches',
    { tournamentId: cup.id, scheduledStartTime: '2027-06-01T09:00:00Z' },
    201,
  );
  assert.equal(fixture.scoringMode, 'RESULT_ONLY');
  await call('PATCH', `/sports/${sport.id}`, { scoringMode: 'LIVE' });
  assert.equal((await call('GET', `/matches/${fixture.id}`)).scoringMode, 'LIVE');
  await call('PATCH', `/sports/${sport.id}`, { scoringMode: 'RESULT_ONLY' });
  await call('POST', `/matches/${fixture.id}/start`, {}, 400);
  pass(
    'Chess defaults to results-only; fixtures inherit sport mode; sport changes propagate and prevent live start',
  );

  const teams = await call('GET', '/teams');
  const seed = teams.find(
    (t) => teams.filter((x) => x.eventId === t.eventId && x.sportId === t.sportId).length >= 4,
  );
  const field = teams
    .filter((t) => t.eventId === seed.eventId && t.sportId === seed.sportId)
    .slice(0, 4);
  const originalSport = await call('GET', `/sports/${seed.sportId}`);
  await call('PATCH', `/sports/${seed.sportId}`, { scoringMode: 'RESULT_ONLY' });
  const bracket = await call(
    'POST',
    '/tournaments',
    {
      eventId: seed.eventId,
      sportId: seed.sportId,
      name: `Inherited mode ${stamp}`,
      format: 'KNOCKOUT',
    },
    201,
  );
  await call(
    'POST',
    `/tournaments/${bracket.id}/generate-bracket`,
    {
      teamIds: field.map((t) => t.id),
      startTime: '2029-01-01T09:00:00Z',
      matchDurationMinutes: 30,
    },
    201,
  );
  const fixtures = await call('GET', `/matches?tournamentId=${bracket.id}`);
  assert(fixtures.every((m) => m.scoringMode === 'RESULT_ONLY'));
  const opening = fixtures.find((m) => m.teamAId && m.teamBId);
  await call('PATCH', `/sports/${seed.sportId}`, { scoringMode: 'LIVE' });
  await call('POST', `/matches/${opening.id}/start`, {}, 201);
  await call('PATCH', `/sports/${seed.sportId}`, { scoringMode: 'RESULT_ONLY' });
  assert.equal((await call('GET', `/matches/${opening.id}`)).scoringMode, 'LIVE');
  const resultFixture = fixtures.find((m) => m.id !== opening.id && m.teamAId && m.teamBId);
  pass(
    'Generated brackets inherit sport setting; changing the sport preserves an already-started fixture',
  );

  const rows = [
    {
      name: 'Test Volunteer A',
      email: `a-${stamp}@example.test`,
      department: 'Scoring',
      shift: 'MORNING',
    },
    {
      name: 'Test Volunteer B',
      email: `b-${stamp}@example.test`,
      department: 'Logistics',
      shift: 'EVENING',
    },
  ];
  const before = (await call('GET', '/volunteers')).length;
  assert.equal((await call('POST', '/volunteers/import', { rows, dryRun: true }, 201)).created, 2);
  assert.equal((await call('GET', '/volunteers')).length, before);
  assert.equal((await call('POST', '/volunteers/import', { rows }, 201)).created, 2);
  rows[0].department = 'Security';
  rows[0].email = rows[0].email.toUpperCase();
  assert.equal((await call('POST', '/volunteers/import', { rows }, 201)).updated, 2);
  assert.equal((await call('GET', '/volunteers')).length, before + 2);
  await call(
    'POST',
    '/volunteers/import',
    {
      rows: [
        { name: 'Rollback', email: `rollback-${stamp}@example.test` },
        {
          name: 'Invalid',
          email: `invalid-${stamp}@example.test`,
          venueName: 'No such rehearsal venue',
        },
      ],
    },
    400,
  );
  assert.equal((await call('GET', '/volunteers')).length, before + 2);
  await call('POST', '/volunteers/import', { rows: [rows[0], rows[0]] }, 400);
  await call('POST', '/volunteers/import-sheet', { sheetUrl: 'http://127.0.0.1/private' }, 400);
  pass(
    'Volunteer dry run writes nothing; import persists; case-insensitive reimport updates; invalid rows roll back atomically',
  );

  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    storageState: await api.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/organizer/volunteers/import`);
  await page.getByLabel('Volunteer CSV').setInputFiles({
    name: 'test-volunteers.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `name,email,department,shift\nBrowser Volunteer,browser-${stamp}@example.test,Scoring,MORNING\n`,
    ),
  });
  await page.getByRole('button', { name: 'Validate volunteers', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Validated:' })).toBeVisible();
  await page.getByRole('button', { name: 'Import volunteers', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Imported: created 1' })).toBeVisible();
  await page.screenshot({ path: `${output}/volunteer-import.png`, fullPage: true });
  pass('Organizer browser uploads generated Sheets-format CSV, previews, validates, and imports');
  await page.goto(`${origin}/scorer?matchId=${resultFixture.id}`);
  await expect(page.getByRole('dialog', { name: 'Fixture final result' })).toBeVisible({
    timeout: 60000,
  });
  await page.getByLabel('Team A final score').fill('1');
  await page.getByLabel('Team B final score').fill('0');
  await page.getByRole('button', { name: 'Submit final result', exact: true }).click();
  await expect(page.getByText(/Final result submitted for approval/)).toBeVisible();
  await page.screenshot({ path: `${output}/scorer-result.png`, fullPage: true });
  pass('Scorer deep link opens direct result entry and saves final result without live scoring');
  await call('PATCH', `/sports/${seed.sportId}`, {
    scoringMode: originalSport.scoringMode || 'LIVE',
  });
  await page.goto(origin);
  const explore = page.getByRole('button', { name: 'Explore', exact: true });
  await explore.click();
  await expect(explore).toHaveAttribute('aria-expanded', 'true');
  await explore.press('Escape');
  await expect(explore).toHaveAttribute('aria-expanded', 'false');
  const matchLink = page.locator('a[href^="/matches/"]').first();
  await expect(matchLink).toBeVisible();
  const target = await matchLink.getAttribute('href');
  await matchLink.click();
  await expect(page).toHaveURL(`${origin}${target}`);
  pass(
    'Explore responds to click and Escape; homepage match card navigates to its backend fixture',
  );
  await context.close();
  const guest = await request.newContext({ extraHTTPHeaders: { Origin: origin } });
  assert.equal((await guest.post(`${base}/volunteers/import`, { data: { rows } })).status(), 401);
  await guest.post(`${base}/auth/dev-login`, { data: { role: 'NO_ROLE' } });
  assert.equal((await guest.post(`${base}/volunteers/import`, { data: { rows } })).status(), 403);
  await guest.dispose();
  pass('Volunteer imports reject unauthenticated and unauthorized users');
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        checks,
        errors,
        eventId: event.id,
        fixtureId: resultFixture.id,
        limitations: [
          'Google Sheets network responses tested with mocks; no user-provided sheet.',
          'Real Google Maps pin selection requires a configured browser API key.',
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify({ checks, errors, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser?.close();
  await api.dispose();
}
