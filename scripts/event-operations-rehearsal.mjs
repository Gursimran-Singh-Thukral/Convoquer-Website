import { request } from '@playwright/test';
import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
const root = 'reports/tournament-rehearsal';
const runs = (await readdir(root))
  .filter((n) => n.startsWith('run-'))
  .sort()
  .reverse();
let run, report;
for (const candidate of runs) {
  try {
    report = JSON.parse(await readFile(`${root}/${candidate}/results.json`, 'utf8'));
    run = candidate;
    break;
  } catch {}
}
assert(report, 'Run tournament-rehearsal.mjs first');
const base = 'http://127.0.0.1:4100/api';
const api = await request.newContext({ extraHTTPHeaders: { Origin: 'http://127.0.0.1:3100' } });
const guest = await request.newContext();
const checks = [];
async function call(method, path, data, expected = 200, client = api) {
  const response = await client.fetch(`${base}${path}`, { method, data });
  const body = await response.json();
  assert.equal(response.status(), expected, `${method} ${path}: ${JSON.stringify(body)}`);
  return body;
}
const pass = (name) => {
  checks.push({ name, status: 'PASS' });
  console.log(`PASS ${name}`);
};
try {
  await call('POST', '/auth/dev-login', { role: 'CONVENER' }, 201);
  const tournament = await call('GET', `/tournaments/${report.tournamentId}`);
  const eventId = tournament.eventId,
    sportId = tournament.sportId;
  const teams = await call('GET', `/teams?eventId=${eventId}&sportId=${sportId}`);
  const participants = await call('GET', `/participants?eventId=${eventId}`);
  await call('GET', '/participants', undefined, 401, guest);
  const team = await call('GET', `/teams/${teams[0].id}`, undefined, 200, guest);
  assert(!JSON.stringify(team).includes('rollNumber'));
  assert(!JSON.stringify(team).includes('contactNumber'));
  pass(
    'Anonymous participant list denied; public team roster excludes private contact and roll number fields',
  );
  const participant = participants[0];
  const lookup = await call(
    'GET',
    `/security/search?eventId=${eventId}&q=${participant.gatePassNumber}`,
  );
  assert(JSON.stringify(lookup).includes(participant.id));
  const checkin = await call('POST', '/security/check-in', { participantId: participant.id }, 201);
  assert(['CHECK_IN_SUCCESS', 'ALREADY_CHECKED_IN'].includes(checkin.status));
  assert.equal(
    (await call('POST', '/security/check-in', { participantId: participant.id }, 201)).status,
    'ALREADY_CHECKED_IN',
  );
  const blocked = participants[1];
  await call('PATCH', `/participants/${blocked.id}`, {
    isFlagged: true,
    flagReason: 'Rehearsal entry hold',
  });
  await call('POST', '/security/check-in', { participantId: blocked.id }, 400);
  await call('PATCH', `/participants/${blocked.id}`, { isFlagged: false, flagReason: '' });
  pass('Gate-pass lookup, check-in, duplicate check-in and flagged-participant rejection');
  const pixel =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8Z0AAAAASUVORK5CYII=';
  const attendee = await call(
    'POST',
    '/security/on-spot-pass',
    {
      eventId,
      name: 'Test Audience Visitor',
      contactNumber: '+919000000000',
      photographUrl: pixel,
      idDocumentUrl: pixel,
      category: 'AUDIENCE',
    },
    201,
    guest,
  );
  assert.equal(attendee.attendee.isCheckedIn, false);
  assert(!JSON.stringify(attendee).includes('idDocumentUrl'));
  pass(
    'Public attendee registration issues a pass without self-check-in or returning ID documents',
  );
  const unique = Date.now();
  const existingFixtures = await call('GET', `/matches?sportId=${sportId}`);
  const nextStart =
    Math.max(
      Date.now(),
      ...existingFixtures.map((m) => Date.parse(m.scheduledEndTime || m.scheduledStartTime)),
    ) + 86400000;
  const sport = await call('POST', '/sports', { eventId, name: `CRUD Sport ${unique}` }, 201);
  await call('PATCH', `/sports/${sport.id}`, { description: 'Updated through API' });
  await call('DELETE', `/sports/${sport.id}`);
  await call('GET', `/sports/${sport.id}`, undefined, 404);
  const venue = await call('POST', '/venues', { eventId, name: `CRUD Venue ${unique}` }, 201);
  await call('PATCH', `/venues/${venue.id}`, {
    location: 'Rehearsal location',
    mapX: 20,
    mapY: 40,
  });
  await call('DELETE', `/venues/${venue.id}`);
  const blank = await call(
    'POST',
    '/tournaments',
    { eventId, sportId, name: `CRUD Cup ${unique}` },
    201,
  );
  await call('PATCH', `/tournaments/${blank.id}`, { name: `Updated Cup ${unique}` });
  await call('DELETE', `/tournaments/${blank.id}`);
  await call('DELETE', `/tournaments/${tournament.id}`, undefined, 409);
  pass(
    'Sports, venues and tournaments support create/read/update/delete; tournament with fixtures cannot be deleted',
  );
  const sponsor = await call(
    'POST',
    '/sponsors',
    { name: 'Rehearsal Sponsor', role: 'Test partner' },
    201,
  );
  await call('PATCH', `/sponsors/${sponsor.id}`, { description: 'Updated partner record' });
  assert((await call('GET', '/sponsors', undefined, 200, guest)).some((s) => s.id === sponsor.id));
  await call('DELETE', `/sponsors/${sponsor.id}`);
  const volunteer = await call(
    'POST',
    '/volunteers',
    {
      name: 'Test Volunteer',
      email: 'test-volunteer@example.com',
      contactNumber: '+919000000001',
      department: 'Logistics',
      venueId: tournament.matches[0].venueId,
      venueName: tournament.matches[0].venue.name,
    },
    201,
  );
  const publicVolunteers = await call('GET', '/volunteers/public', undefined, 200, guest);
  assert(!JSON.stringify(publicVolunteers).includes('test-volunteer@example.com'));
  const task = await call(
    'POST',
    '/operations-tasks',
    { title: 'Rehearsal equipment check', volunteerId: volunteer.id, department: 'Logistics' },
    201,
  );
  await call('PATCH', `/operations-tasks/${task.id}`, { status: 'DONE' });
  pass('Sponsor CRUD, volunteer assignment, private contact filtering and task completion');
  const notice = await call(
    'POST',
    '/announcements',
    {
      heading: `Public rehearsal ${unique}`,
      description: 'Fixture update test',
      targets: ['PUBLIC'],
    },
    201,
  );
  const privateNotice = await call(
    'POST',
    '/announcements',
    {
      heading: `Private rehearsal ${unique}`,
      description: 'Staff only test',
      targets: ['SECURITY_TEAM'],
    },
    201,
  );
  const feed = await call('GET', '/announcements/public', undefined, 200, guest);
  assert(feed.some((n) => n.id === notice.id));
  assert(!feed.some((n) => n.id === privateNotice.id));
  const entry = await call(
    'POST',
    '/content',
    { kind: 'FAQ', title: 'Test question', body: 'Test answer', status: 'DRAFT' },
    201,
  );
  assert(
    !(await call('GET', '/content?kind=FAQ', undefined, 200, guest)).some((e) => e.id === entry.id),
  );
  await call('PATCH', `/content/${entry.id}`, { status: 'PUBLISHED' });
  assert(
    (await call('GET', '/content?kind=FAQ', undefined, 200, guest)).some((e) => e.id === entry.id),
  );
  await call('PATCH', `/content/${entry.id}`, { status: 'ARCHIVED' });
  pass('Public/staff announcement separation and draft/publish/archive content workflow');
  const media = await call(
    'POST',
    '/media-assets',
    { slot: 'GALLERY', title: 'Rehearsal image', imageUrl: pixel },
    201,
  );
  await call('PATCH', `/media-assets/${media.id}/approve`, {});
  assert(
    (await call('GET', '/media-assets/published', undefined, 200, guest)).some(
      (m) => m.id === media.id,
    ),
  );
  await call('DELETE', `/media-assets/${media.id}`);
  pass('Media submission, approval, public gallery visibility and removal');
  const final =
    tournament.matches.find((m) => m.stage?.name === 'Final') || tournament.matches.at(-1);
  const finalResult = await call('GET', `/matches/${final.id}/result`);
  const winner = teams.find((t) => t.id === finalResult.winnerTeamId);
  const medalInput = {
    eventId,
    sportId,
    tournamentId: tournament.id,
    instituteId: winner.instituteId,
    type: 'GOLD',
  };
  const medal = await call('POST', '/medals', medalInput, 201);
  assert.equal((await call('POST', '/medals', medalInput, 201)).id, medal.id);
  assert(
    (await call('GET', `/events/${eventId}/medal-tally`)).some(
      (r) => r.instituteId === winner.instituteId && r.gold === 1,
    ),
  );
  pass('Gold award, repeat-award idempotency and backend medal tally');
  const bye = await call(
    'POST',
    '/tournaments',
    { eventId, sportId, name: `Bye Cup ${unique}` },
    201,
  );
  await call(
    'POST',
    `/tournaments/${bye.id}/generate-bracket`,
    { teamIds: teams.slice(0, 3).map((t) => t.id), startTime: new Date(nextStart).toISOString() },
    201,
  );
  const byeMatches = await call('GET', `/matches?tournamentId=${bye.id}`);
  assert.equal(byeMatches.length, 3);
  assert.equal(byeMatches.filter((m) => m.status === 'BYE').length, 1);
  assert(byeMatches.find((m) => m.stage.sequence === 2).teamAId);
  const league = await call(
    'POST',
    '/tournaments',
    { eventId, sportId, name: `League ${unique}`, format: 'ROUND_ROBIN' },
    201,
  );
  const rr = await call(
    'POST',
    `/tournaments/${league.id}/generate-round-robin`,
    {
      teamIds: teams.slice(0, 4).map((t) => t.id),
      startTime: new Date(nextStart + 86400000).toISOString(),
    },
    201,
  );
  assert.equal(rr.totalMatches, 6);
  assert.equal(new Set(rr.matches.map((m) => [m.teamAId, m.teamBId].sort().join(':'))).size, 6);
  pass('Three-team knockout bye advancement and four-team round-robin pair coverage');
  const swiss = await call(
    'POST',
    '/tournaments',
    { eventId, sportId, name: `Swiss ${unique}`, format: 'SWISS' },
    201,
  );
  const firstSwiss = await call(
    'POST',
    `/tournaments/${swiss.id}/generate-swiss-round`,
    {
      teamIds: teams.slice(0, 4).map((t) => t.id),
      startTime: new Date(nextStart + 3 * 86400000).toISOString(),
    },
    201,
  );
  assert.equal(firstSwiss.matches.length, 2);
  await call(
    'POST',
    `/tournaments/${swiss.id}/generate-swiss-round`,
    { startTime: new Date(nextStart + 4 * 86400000).toISOString() },
    409,
  );
  for (const match of firstSwiss.matches) {
    await call('POST', `/matches/${match.id}/start`, {}, 201);
    await call(
      'POST',
      `/matches/${match.id}/score-events`,
      { teamId: match.teamAId, eventType: 'POINT' },
      201,
    );
    await call('POST', `/matches/${match.id}/end`, { winnerTeamId: match.teamAId }, 201);
    const result = await call(
      'POST',
      `/matches/${match.id}/result`,
      { winnerTeamId: match.teamAId },
      201,
    );
    await call('PATCH', `/results/${result.id}/approve`, {});
  }
  const secondSwiss = await call(
    'POST',
    `/tournaments/${swiss.id}/generate-swiss-round`,
    { startTime: new Date(nextStart + 4 * 86400000).toISOString() },
    201,
  );
  assert.equal(secondSwiss.roundNumber, 2);
  const oldPairs = new Set(firstSwiss.matches.map((m) => [m.teamAId, m.teamBId].sort().join(':')));
  assert(secondSwiss.matches.every((m) => !oldPairs.has([m.teamAId, m.teamBId].sort().join(':'))));
  pass(
    'Swiss next round waits for published results, then generates fresh pairings from standings',
  );
  const liveMatch = rr.matches[0];
  await call('POST', `/matches/${liveMatch.id}/start`, {}, 201);
  const abort = new AbortController();
  const stream = await fetch(`${base}/realtime/matches/${liveMatch.id}`, { signal: abort.signal });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  const timeout = setTimeout(() => abort.abort(), 15000);
  const receiveScore = (async () => {
    let text = '';
    while (!text.includes('match.score.updated')) {
      const { value, done } = await reader.read();
      if (done) throw new Error('SSE closed before a score update');
      text += new TextDecoder().decode(value);
    }
    return text;
  })();
  const score = await call(
    'POST',
    `/matches/${liveMatch.id}/score-events`,
    { teamId: liveMatch.teamAId, eventType: 'POINT' },
    201,
  );
  assert((await receiveScore).includes(liveMatch.id));
  clearTimeout(timeout);
  abort.abort();
  await Promise.all(
    Array.from({ length: 10 }, () =>
      call(
        'POST',
        `/matches/${liveMatch.id}/score-events`,
        { teamId: liveMatch.teamAId, eventType: 'POINT' },
        201,
      ),
    ),
  );
  assert.equal((await call('GET', `/matches/${liveMatch.id}`)).teamAScore, 11);
  await call('PATCH', `/matches/${liveMatch.id}/score-manual`, {
    teamAScore: 50,
    teamBScore: 0,
    reason: 'Rehearsal correction',
  });
  await call(
    'POST',
    `/matches/${liveMatch.id}/score-events/${score.event.id}/reverse`,
    { reason: 'Rehearsal reversal' },
    201,
  );
  assert.equal((await call('GET', `/matches/${liveMatch.id}`)).teamAScore, 49);
  pass(
    'SSE delivers committed score updates; ten concurrent scores are retained; reversal preserves manual correction',
  );
  const low = await request.newContext({ extraHTTPHeaders: { Origin: 'http://127.0.0.1:3100' } });
  await call('POST', '/auth/dev-login', { role: 'VOLUNTEER' }, 201, low);
  await call('POST', '/tournaments', { eventId, sportId, name: 'Unauthorized' }, 403, low);
  await call('POST', '/auth/logout', {}, 200, low);
  assert.equal((await call('GET', '/auth/me', undefined, 200, low)).authenticated, false);
  await low.dispose();
  const csrf = await api.post(`${base}/tournaments`, {
    headers: { Origin: 'https://untrusted.example' },
    data: { eventId, sportId, name: 'Untrusted origin' },
  });
  assert.equal(csrf.status(), 403);
  pass('Volunteer privilege restriction, logout invalidation and cross-origin mutation rejection');
  await writeFile(
    `${root}/${run}/operations.json`,
    JSON.stringify({ completedAt: new Date().toISOString(), checks }, null, 2),
  );
} catch (error) {
  await writeFile(
    `${root}/${run}/operations-failure.json`,
    JSON.stringify({ checks, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await api.dispose();
  await guest.dispose();
}
