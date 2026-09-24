import { chromium, request, expect } from '@playwright/test';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:3100',
  base = 'http://127.0.0.1:4100/api';
const folder = (await readdir('reports/tournament-rehearsal'))
  .filter((n) => n.startsWith('volunteer-sport-'))
  .sort()
  .at(-1);
const output = `reports/tournament-rehearsal/${folder}`;
const evidence = JSON.parse(await readFile(`${output}/results.json`, 'utf8'));
const api = await request.newContext({ extraHTTPHeaders: { Origin: origin } });
await api.post(`${base}/auth/dev-login`, { data: { role: 'CONVENER' } });
const matches = await (await api.get(`${base}/matches`)).json();
const fixture = matches.find(
  (m) => m.nextMatchId && ['SCHEDULED', 'READY'].includes(m.status) && m.teamAId && m.teamBId,
);
assert(fixture);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({
    storageState: await api.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${origin}/matches`);
  const filter = page
    .locator('select')
    .filter({ has: page.locator(`option[value="${fixture.tournamentId}"]`) });
  await expect(filter).toHaveCount(1, { timeout: 60000 });
  await filter.selectOption(fixture.tournamentId);
  await page
    .getByRole('row')
    .filter({
      has: page.getByRole('cell', {
        name: fixture.matchNumber || fixture.id.slice(0, 8),
        exact: true,
      }),
    })
    .getByRole('button', { name: 'Manage', exact: true })
    .click();
  await page.getByRole('button', { name: 'edit', exact: true }).click();
  const form = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save Changes', exact: true }) });
  await form.locator('input[type="text"]').fill(`REHEARSAL-${Date.now()}`);
  const pending = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && /\/matches\/[^/]+$/.test(r.url()),
  );
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 200, await response.text());
  assert.deepEqual(Object.keys(response.request().postDataJSON()), ['matchNumber']);
  await page.screenshot({ path: `${output}/fixture-edit.png`, fullPage: true });
  await page.goto(`${origin}/sports/manager`);
  await page.getByRole('button', { name: 'VENUES', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.getByTitle('IIT Jammu Google Map')).toBeVisible();
  await expect(page.getByLabel('Venue latitude')).toHaveCount(0);
  await expect(page.getByLabel('Venue longitude')).toHaveCount(0);
  await expect(page.getByText(/Pin selection is unavailable/)).toBeVisible();
  await page.screenshot({ path: `${output}/venue-map.png`, fullPage: true });
  assert.deepEqual(errors, []);
  evidence.checks.push(
    'Fixture Edit saves only changed match number without resending locked teams or winner',
    'Venue editor shows Google map and configuration guidance with no manual coordinate fields',
  );
  await writeFile(`${output}/results.json`, JSON.stringify(evidence, null, 2));
  console.log('PASS fixture edit and venue map browser checks');
} finally {
  await browser.close();
  await api.dispose();
}
