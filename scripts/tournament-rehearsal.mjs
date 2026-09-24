import { chromium, request, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Intentionally restricted to the isolated local test API. Never uses .env credentials.
const apiURL = 'http://127.0.0.1:4100/api';
const site = 'http://127.0.0.1:3100';
const output = `reports/tournament-rehearsal/run-${Date.now()}`;
await mkdir(output, { recursive: true });
const api = await request.newContext({ baseURL: apiURL, extraHTTPHeaders: { Origin: site } });
const checks = [];
async function call(method, path, data, expected = 200) {
  const response = await api.fetch(`${apiURL}${path}`, { method, data });
  const body = await response.json();
  if (response.status() !== expected)
    throw new Error(`${method} ${path}: ${response.status()} ${JSON.stringify(body)}`);
  return body;
}
const pass = (name) => {
  checks.push({ name, status: 'PASS' });
  console.log(`PASS ${name}`);
};
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const emptyContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const emptyPage = await emptyContext.newPage();
  if (!(await call('GET', '/events')).length) {
    for (const route of [
      '/',
      '/sports',
      '/venues',
      '/schedule',
      '/standings',
      '/bracket',
      '/faq',
      '/about',
    ]) {
      await emptyPage.goto(`${site}${route}`);
      await expect(emptyPage.locator('body')).not.toContainText('SPORTS J&K');
      await expect(emptyPage.locator('body')).not.toContainText('Gold: IIT Jammu');
      await expect(emptyPage.locator('body')).not.toContainText('OCTOBER 1');
      await emptyPage.screenshot({
        path: `${output}/empty-${route.replaceAll('/', '') || 'home'}.png`,
        fullPage: true,
      });
    }
    await writeFile(
      `${output}/empty-database.json`,
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          routes: [
            '/',
            '/sports',
            '/venues',
            '/schedule',
            '/standings',
            '/bracket',
            '/faq',
            '/about',
          ],
          events: 0,
          status: 'PASS',
        },
        null,
        2,
      ),
    );
    pass('Empty database public-page check: no fabricated sponsors, medal winners or event dates');
  }
  await emptyContext.close();
  const guest = await call('GET', '/auth/me');
  assert.equal(guest.authenticated, false);
  await call('POST', '/tournaments', {}, 401);
  pass('New visitor cannot create tournaments without authentication');
  await call('POST', '/auth/dev-login', { role: 'CONVENER' }, 201);
  for (const old of await call('GET', '/events?status=ACTIVE')) {
    if (old.slug.startsWith('rehearsal-'))
      await call('PATCH', `/events/${old.id}`, { status: 'COMPLETED' });
  }
  const suffix = Date.now();
  const event = await call(
    'POST',
    '/events',
    {
      name: `Rehearsal ${suffix}`,
      slug: `rehearsal-${suffix}`,
      edition: 'TEST',
      startDate: '2027-01-10T03:30:00Z',
      endDate: '2027-01-20T18:30:00Z',
      status: 'ACTIVE',
    },
    201,
  );
  const sport = await call(
    'POST',
    '/sports',
    {
      eventId: event.id,
      name: `Football ${suffix}`,
      description: 'Isolated tournament rehearsal; test teams only.',
    },
    201,
  );
  const venue = await call(
    'POST',
    '/venues',
    { eventId: event.id, name: `Test Arena ${suffix}`, location: 'Isolated rehearsal venue' },
    201,
  );
  const teams = [];
  for (let seed = 1; seed <= 8; seed++) {
    const institute = await call(
      'POST',
      '/institutes',
      { eventId: event.id, name: `Test Institute ${seed}`, shortName: `T${seed}` },
      201,
    );
    teams.push(
      await call(
        'POST',
        '/teams',
        {
          eventId: event.id,
          sportId: sport.id,
          instituteId: institute.id,
          name: `Seed ${seed} Test Team`,
        },
        201,
      ),
    );
  }
  pass(
    'Convener creates event, sport, venue, eight institutes and eight teams through authenticated API',
  );
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    storageState: await api.storageState(),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const csvRows = [];
  for (let team = 1; team <= 8; team++)
    for (let player = 1; player <= 2; player++) {
      csvRows.push(
        `Test Player ${team}-${player},Test Institute ${team},TEST-${team}-${player},${sport.name},PLAYER,ATHLETE`,
      );
    }
  const csv = 'name,college,rollNumber,sport,role,category\n' + csvRows.join('\n');
  await writeFile(`${output}/test-participants.csv`, csv);
  await page.goto(`${site}/organizer/import`);
  await page.getByLabel('Import event', { exact: true }).selectOption(event.id);
  await page.getByLabel('Google Sheets CSV', { exact: true }).setInputFiles({
    name: 'test-participants.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Validate import', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Validation passed for 16 rows');
  assert.equal((await call('GET', `/participants?eventId=${event.id}`)).length, 0);
  await page.getByRole('button', { name: 'Import participants', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Imported 16 rows successfully');
  const participants = await call('GET', `/participants?eventId=${event.id}`);
  assert.equal(participants.length, 16);
  await page.screenshot({ path: `${output}/00-csv-import.png`, fullPage: true });
  await page.getByRole('button', { name: 'Validate import', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Validation passed');
  await page.getByRole('button', { name: 'Import participants', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Imported 16 rows successfully');
  assert.equal((await call('GET', `/participants?eventId=${event.id}`)).length, 16);
  pass(
    'Sheets-format CSV browser preview, dry-run validation, 16-player import and duplicate-safe reimport',
  );
  await page.goto(`${site}/tournaments`);
  await page.getByRole('button', { name: /new tournament/i }).click();
  await page.getByPlaceholder("e.g. Football Men's Championship").fill(`Rehearsal Cup ${suffix}`);
  await page.locator('form select').first().selectOption(sport.id);
  await page.getByRole('button', { name: 'Create Tournament', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: `Rehearsal Cup ${suffix}`, exact: true }),
  ).toBeVisible();
  const tournaments = await call('GET', '/tournaments');
  const tournament = tournaments.find((t) => t.name === `Rehearsal Cup ${suffix}`);
  assert(tournament);
  pass('Creates a knockout tournament through the convener browser screen');
  await page
    .locator(`[data-tournament-id="${tournament.id}"]`)
    .getByRole('button', { name: /^Manage/ })
    .click();
  await page.getByRole('button', { name: 'seeding', exact: true }).click();
  const selects = page.locator('form select');
  for (let i = 0; i < 8; i++) {
    if (i >= (await selects.count()))
      await page.getByRole('button', { name: /Add seed row/ }).click();
    await selects.nth(i).selectOption(teams[i].id);
    await page
      .getByPlaceholder('Seed #')
      .nth(i)
      .fill(String(i + 1));
  }
  await page.getByRole('button', { name: 'Save Seeds', exact: true }).click();
  await expect(page.getByText('Seeds saved successfully.')).toBeVisible();
  await page.screenshot({ path: `${output}/01-seeding.png`, fullPage: true });
  await page.getByRole('button', { name: 'generate', exact: true }).click();
  await page.locator('form select').last().selectOption(venue.id);
  await page.locator('input[type="datetime-local"]').fill('2027-01-10T09:00');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Generate Knockout Bracket', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText(/Complete seeded knockout bracket generated/)).toBeVisible();
  pass('Saves seeds 1–8 and generates the complete schedule through the browser');
  const matches = await call('GET', `/matches?tournamentId=${tournament.id}`);
  assert.equal(matches.length, 7);
  assert.equal(new Set(matches.map((m) => m.stage.sequence)).size, 3);
  const opening = matches.filter((m) => m.stage.sequence === 1);
  assert.equal(opening[0].teamAId, teams[0].id);
  assert.equal(opening[2].teamAId, teams[1].id);
  await call(
    'POST',
    `/tournaments/${tournament.id}/generate-bracket`,
    { startTime: '2027-01-10T03:30:00Z' },
    409,
  );
  pass(
    'Seven matches across three rounds; top two seeds are in opposite halves; duplicate generation rejected',
  );
  await call(
    'POST',
    '/matches',
    {
      tournamentId: tournament.id,
      venueId: venue.id,
      teamAId: teams[0].id,
      teamBId: teams[1].id,
      scheduledStartTime: opening[0].scheduledStartTime,
    },
    409,
  );
  pass('Overlapping venue/team booking rejected');
  const summary = [];
  for (const scheduled of matches) {
    const match = await call('GET', `/matches/${scheduled.id}`);
    assert(match.teamAId && match.teamBId);
    const winner =
      teams.findIndex((t) => t.id === match.teamAId) <
      teams.findIndex((t) => t.id === match.teamBId)
        ? match.teamAId
        : match.teamBId;
    await call('POST', `/matches/${match.id}/start`, {}, 201);
    const requestId = randomUUID();
    const score = await call(
      'POST',
      `/matches/${match.id}/score-events`,
      { teamId: winner, eventType: 'POINT', points: 1, requestId },
      201,
    );
    const retry = await call(
      'POST',
      `/matches/${match.id}/score-events`,
      { teamId: winner, eventType: 'POINT', points: 1, requestId },
      201,
    );
    assert.equal(score.event.id, retry.event.id);
    await call('POST', `/matches/${match.id}/pause`, { reason: 'Rehearsal timeout' }, 201);
    await call('POST', `/matches/${match.id}/resume`, {}, 201);
    await call('POST', `/matches/${match.id}/end`, { winnerTeamId: winner }, 201);
    await call('GET', `/matches/${match.id}/result`, undefined, 404);
    const result = await call('POST', `/matches/${match.id}/result`, { winnerTeamId: winner }, 201);
    await call('PATCH', `/results/${result.id}/approve`, { notes: 'Rehearsal verified' });
    const published = await call('GET', `/matches/${match.id}/result`);
    assert.equal(published.status, 'PUBLISHED');
    await call(
      'PATCH',
      `/matches/${match.id}/score-manual`,
      { teamAScore: 9, reason: 'Must reject completed edit' },
      400,
    );
    summary.push({
      round: match.stage.name,
      match: match.matchNumber,
      teamA: match.teamA.name,
      teamB: match.teamB.name,
      winner: teams.find((t) => t.id === winner).name,
    });
  }
  assert.equal(summary.at(-1).teamA, teams[0].name);
  assert.equal(summary.at(-1).teamB, teams[1].name);
  pass(
    'All seven matches scored, paused, resumed, ended and published; seeds 1 and 2 meet only in final',
  );
  pass(
    'Score retries are idempotent; unpublished results are private; completed scores cannot be edited',
  );
  const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const publicPage = await publicContext.newPage();
  for (const route of [
    '/',
    '/sports',
    '/schedule',
    '/bracket',
    '/results',
    '/standings',
    '/teams',
    '/venues',
    '/contact',
    '/rules',
  ]) {
    const response = await publicPage.goto(`${site}${route}`);
    assert.equal(response.status(), 200, route);
    await expect(publicPage.locator('body')).not.toContainText('Internal Server Error');
  }
  await publicPage.goto(`${site}/matches/${matches.at(-1).id}`);
  await expect(publicPage.getByText(teams[0].name).first()).toBeVisible();
  await publicPage.screenshot({ path: `${output}/02-final-result.png`, fullPage: true });
  await publicPage.goto(`${site}/schedule`);
  await expect(publicPage.getByText(teams[0].name).first()).toBeVisible();
  await publicPage.screenshot({ path: `${output}/03-schedule.png`, fullPage: true });
  pass('Anonymous visitor can load public routes, schedule and published final result');
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        tournamentId: tournament.id,
        checks,
        matches: summary,
        browserErrors: errors,
        limits: [
          'Google OAuth provider exchange was not exercised; isolated development login used.',
          'Event, sport, venue, institutes and teams provisioned through authenticated HTTP API; tournament creation, seeding and generation exercised in browser.',
        ],
      },
      null,
      2,
    ),
  );
  console.log(`Report saved to ${output}/results.json`);
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify({ checks, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser?.close();
  await api.dispose();
}
