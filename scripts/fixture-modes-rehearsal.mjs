import { request } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:4100/api';
const api = await request.newContext({ extraHTTPHeaders: { Origin: 'http://127.0.0.1:3100' } });
const checks = [];
const pass = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
async function call(method, path, data, status = 200) {
  const response = await api.fetch(`${base}${path}`, { method, data });
  assert.equal(response.status(), status, `${path}: ${await response.text()}`);
  return response.json();
}
const output = `reports/tournament-rehearsal/fixture-modes-${Date.now()}`;
await mkdir(output, { recursive: true });
try {
  await call('POST', '/auth/dev-login', { role: 'CONVENER' }, 201);
  const teams = await call('GET', '/teams');
  const seed = teams.find(
    (team) =>
      teams.filter((t) => t.eventId === team.eventId && t.sportId === team.sportId).length >= 8,
  );
  assert(seed, 'Run the core tournament rehearsal first');
  const field = teams
    .filter((t) => t.eventId === seed.eventId && t.sportId === seed.sportId)
    .slice(0, 8);
  const venue = await call(
    'POST',
    '/venues',
    {
      eventId: seed.eventId,
      name: `Parallel courts ${Date.now()}`,
      simultaneousMatches: 2,
      latitude: 32.8018222,
      longitude: 74.8952306,
    },
    201,
  );
  assert.equal(venue.latitude, 32.8018222);
  await call('PATCH', `/venues/${venue.id}`, { latitude: null, longitude: null });
  assert.equal((await call('GET', `/venues/${venue.id}`)).latitude, null);
  await call('PATCH', `/venues/${venue.id}`, { latitude: 32.802, longitude: 74.896 });
  await call('PATCH', `/venues/${venue.id}`, { latitude: 91, longitude: 74 }, 400);
  await call('PATCH', `/venues/${venue.id}`, { latitude: 32 }, 400);
  await call('PATCH', `/venues/${venue.id}`, { simultaneousMatches: 0 }, 400);
  pass(
    'Venue capacity and geographic coordinates persist; clear works; invalid coordinates/capacity rejected',
  );
  const existing = await call('GET', '/matches');
  const start =
    Math.max(
      Date.now(),
      ...existing.map((m) => Date.parse(m.scheduledEndTime || m.scheduledStartTime)),
    ) +
    7 * 86400000;
  const tournament = await call(
    'POST',
    '/tournaments',
    {
      eventId: seed.eventId,
      sportId: seed.sportId,
      name: `Parallel results cup ${Date.now()}`,
      format: 'KNOCKOUT',
    },
    201,
  );
  const options = {
    teamIds: field.map((t) => t.id),
    defaultVenueId: venue.id,
    startTime: new Date(start).toISOString(),
    matchDurationMinutes: 30,
    breakMinutes: 10,
    simultaneousMatches: 2,
    scoringMode: 'RESULT_ONLY',
  };
  await call(
    'POST',
    `/tournaments/${tournament.id}/generate-bracket`,
    { ...options, simultaneousMatches: 3 },
    400,
  );
  assert.equal((await call('GET', `/matches?tournamentId=${tournament.id}`)).length, 0);
  await call('POST', `/tournaments/${tournament.id}/generate-bracket`, options, 201);
  const matches = await call('GET', `/matches?tournamentId=${tournament.id}`);
  assert.equal(matches.length, 7);
  assert(matches.every((m) => m.scoringMode === 'RESULT_ONLY'));
  const offsets = matches
    .map((m) => (Date.parse(m.scheduledStartTime) - start) / 60000)
    .sort((a, b) => a - b);
  assert.deepEqual(offsets, [0, 0, 40, 40, 80, 80, 120]);
  pass(
    'Eight-team bracket uses two simultaneous matches with round barriers; capacity overflow rolls back',
  );
  const opening = matches.find((m) => m.stage.sequence === 1);
  await call(
    'POST',
    '/matches',
    {
      tournamentId: tournament.id,
      venueId: venue.id,
      scheduledStartTime: new Date(start).toISOString(),
      scheduledEndTime: new Date(start + 30 * 60000).toISOString(),
    },
    409,
  );
  await call('POST', `/matches/${opening.id}/start`, {}, 400);
  await call('POST', `/matches/${opening.id}/result`, {}, 400);
  pass(
    'Full venue rejects another fixture; results-only fixture rejects live start and missing final scores',
  );
  for (const fixture of matches.sort((a, b) => a.stage.sequence - b.stage.sequence)) {
    const match = await call('GET', `/matches/${fixture.id}`);
    assert(match.teamAId && match.teamBId);
    const result = await call(
      'POST',
      `/matches/${match.id}/result`,
      { finalScoreA: 3, finalScoreB: 1, notes: 'Direct entry rehearsal' },
      201,
    );
    const updated = await call('GET', `/matches/${match.id}`);
    assert.equal(updated.status, 'COMPLETED');
    assert.equal(updated.teamAScore, 3);
    assert.equal(updated.actualStartTime, null);
    await call('PATCH', `/results/${result.id}/approve`, {});
    assert.equal((await call('GET', `/matches/${match.id}/result`)).status, 'PUBLISHED');
  }
  pass('All seven results entered without live scoring, approved, and advanced through the final');
  let browserTournamentId;
  for (const [format, endpoint] of [
    ['ROUND_ROBIN', 'generate-round-robin'],
    ['SWISS', 'generate-swiss-round'],
  ]) {
    const cup = await call(
      'POST',
      '/tournaments',
      {
        eventId: seed.eventId,
        sportId: seed.sportId,
        name: `${format} parallel ${Date.now()}`,
        format,
      },
      201,
    );
    const time = start + (format === 'SWISS' ? 3 : 2) * 86400000;
    await call(
      'POST',
      `/tournaments/${cup.id}/${endpoint}`,
      {
        ...options,
        teamIds: field.slice(0, 4).map((t) => t.id),
        startTime: new Date(time).toISOString(),
      },
      201,
    );
    const fixtures = await call('GET', `/matches?tournamentId=${cup.id}`);
    assert.equal(fixtures.length, format === 'SWISS' ? 2 : 6);
    assert.equal(fixtures.filter((m) => Date.parse(m.scheduledStartTime) === time).length, 2);
    assert(fixtures.every((m) => m.scoringMode === 'RESULT_ONLY'));
    browserTournamentId = cup.id;
  }
  pass('Round-robin and Swiss also honor two simultaneous matches and results-only mode');
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        checks,
        tournamentId: tournament.id,
        browserTournamentId,
        venueId: venue.id,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify({ checks, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await api.dispose();
}
