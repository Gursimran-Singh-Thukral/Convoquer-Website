import { chromium, request, expect } from '@playwright/test';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = 'reports/tournament-rehearsal';
const folder = (await readdir(root))
  .filter((name) => name.startsWith('fixture-modes-'))
  .sort()
  .at(-1);
const output = `${root}/${folder}`;
const report = JSON.parse(await readFile(`${output}/results.json`, 'utf8'));
const api = await request.newContext({ extraHTTPHeaders: { Origin: 'http://127.0.0.1:3100' } });
assert.equal(
  (
    await api.post('http://127.0.0.1:4100/api/auth/dev-login', { data: { role: 'CONVENER' } })
  ).status(),
  201,
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  storageState: await api.storageState(),
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [],
  checks = [];
page.on('pageerror', (error) => errors.push(error.message));
const pass = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
try {
  await page.goto('http://127.0.0.1:3100/matches');
  const filter = page
    .locator('select')
    .filter({ has: page.locator(`option[value="${report.browserTournamentId}"]`) });
  await expect(filter).toHaveCount(1, { timeout: 60000 });
  await filter.selectOption(report.browserTournamentId);
  await page.getByRole('button', { name: 'Enter result', exact: true }).first().click();
  await page.getByLabel('Scoring mode', { exact: true }).selectOption('LIVE');
  await expect(page.getByRole('link', { name: 'Open live scorer' })).toBeVisible();
  await page.getByLabel('Scoring mode', { exact: true }).selectOption('RESULT_ONLY');
  await expect(page.getByRole('link', { name: 'Open live scorer' })).toHaveCount(0);
  await page.getByLabel('Team A final score').fill('4');
  await page.getByLabel('Team B final score').fill('2');
  await page.getByRole('button', { name: 'Submit final result', exact: true }).click();
  await expect(page.getByText(/Final result submitted for approval/)).toBeVisible();
  await page.screenshot({ path: `${output}/direct-result-browser.png`, fullPage: true });
  pass(
    'Browser toggles scoring mode both ways and submits final result without starting live scoring',
  );

  await page.goto('http://127.0.0.1:3100/');
  await expect(page.getByTitle('IIT Jammu Google Map')).toBeVisible({ timeout: 60000 });
  await page.getByTitle('IIT Jammu Google Map').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/home-map.png` });
  await page.goto('http://127.0.0.1:3100/sports/manager');
  await page.getByRole('button', { name: 'VENUES', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.getByTitle('IIT Jammu Google Map')).toBeVisible();
  await expect(page.getByLabel('Venue latitude')).toHaveCount(0);
  await expect(page.getByLabel('Venue longitude')).toHaveCount(0);
  await expect(page.getByText(/Pin selection is unavailable/)).toBeVisible();
  await page.screenshot({ path: `${output}/venue-map-picker.png`, fullPage: true });
  pass('Venue editor shows the map and configuration guidance without manual coordinate fields');
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/browser.json`,
    JSON.stringify(
      {
        checks,
        errors,
        mapLimitation:
          'No real Maps JavaScript API key configured; iframe rendering and absence of manual coordinate fields verified. SDK click handler tested with a mock.',
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    `${output}/browser-failure.json`,
    JSON.stringify({ checks, errors, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
  await api.dispose();
}
