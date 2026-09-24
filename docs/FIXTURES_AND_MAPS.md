# Fixture scoring, parallel scheduling, and venue maps

Implemented and rehearsed on 21 September 2026.

## Choose how scores are recorded

In **Tournaments → Manage → Generate**, choose **Live scoring** or **Results only**. This choice is saved on every generated fixture. Manual fixture creation also offers the same choice.

In **Fixtures → Enter result** (or **Manage → result**), an authorized organizer can change the scoring mode before the fixture starts.

- **Live scoring:** use the Scorer link to open the fixture console and record live events.
- **Results only:** enter both final scores directly, optionally select a winner for a tied-score tiebreak and add notes, then choose **Submit final result**. Starting live scoring is rejected for these fixtures.
- Submission completes the match and updates its provisional scores. **Approvals** remains the publishing step. Publishing updates official standings and advances a knockout winner into the next match.
- Published results remain protected; use the existing authorized result override workflow for corrections. A fixture whose teams have not yet been determined cannot receive a result.

The Scorer page lists results-only fixtures with an **Enter final result** action. Sports & venues lets organizers set the sport scoring mode. Chess defaults to results-only; other sports default to live. Generators and manual fixtures inherit that setting unless explicitly overridden. Changing the sport updates unstarted fixtures; started and completed fixtures retain their mode.

## Schedule simultaneous matches

Set **Simultaneous matches** in the tournament generator. The allowed range is 1–64; the default is 1.

For a selected venue, configure **Sports & venues → Venues → Edit → Simultaneous matches at this venue** to reflect the number of independent courts/playing areas available. The generator rejects a concurrency setting above that venue's capacity. Existing venues default to one match at a time.

The generator schedules batches within a round, and waits until the previous round and its break finish before scheduling a subsequent knockout or round-robin round. Swiss schedules the requested round in parallel batches. Team-overlap checks still apply, and venue conflict checks account for existing bookings and their peak concurrency.

Example: eight-team knockout, two simultaneous matches, 30-minute matches and 10-minute breaks:

| Round         | Match start offsets  |
| ------------- | -------------------- |
| Quarterfinals | 0, 0, 40, 40 minutes |
| Semifinals    | 80, 80 minutes       |
| Final         | 120 minutes          |

The generator's concurrency limit applies to that generated schedule. The venue's capacity is checked against its existing bookings, including other tournaments. With no selected venue, generated times do not reserve a physical playing area; assign venues before the event.

## Google Maps setup

The homepage, campus-map page, and venue editor now display Google Maps focused on IIT Jammu's Jagti campus. An embedded viewing map works without a project API key. A selected venue uses its saved geographic coordinates.

For **click-to-select** location entry, configure the browser Maps JavaScript API integration:

1. In the intended Google Cloud project, enable Maps JavaScript API and the required billing configuration.
2. Create a browser API key restricted to the intended website referrers and Maps JavaScript API. Include local development origins only on a development key.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `client/.env.local` locally, or in the frontend build environment on the deployment host.
4. Optionally set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` to the project's production Map ID for Advanced Markers. The development default is `DEMO_MAP_ID`.
5. Restart the development frontend or rebuild/redeploy production, since `NEXT_PUBLIC_` values are bundled at build time.
6. Open the venue editor and click the desired spot. The selected location is captured automatically; no latitude/longitude typing is needed. Save the venue and reopen it to verify the location.

This is a public browser key, so referrer/API restrictions are essential. Do not use an unrestricted server key. No cloud account was changed and no billing was enabled during this work.

Without the configured key, the map remains viewable and displays configuration guidance; pin selection is unavailable. Manual latitude/longitude fields have been removed. An embedded Google map cannot expose click coordinates to the parent page; that requires the JavaScript API. An invalid key or a network failure produces a configuration/loading message and the viewing-map fallback. No venue locations are invented from the old percentage-based `mapX`/`mapY` fields.

References: [Google Maps JavaScript loading](https://developers.google.com/maps/documentation/javascript/load-maps-js-api), [adding a Google map](https://developers.google.com/maps/documentation/javascript/add-google-map), [IIT Jammu's published campus site plan](https://iitjammu.ac.in/corrigendum/Corrigendum_clause-IITJMU-IPM-SP-41-2020-21.pdf).

## Verification and limits

- Regression suite: 131 tests passed (21 client, 110 server).
- Both production builds passed; TypeScript and lint checks passed.
- An actual PostgreSQL/API rehearsal completed all seven matches of a results-only knockout, approved the results, and advanced winners through the final without live lifecycle calls.
- Knockout, round-robin, and Swiss generation honored two simultaneous matches. Over-capacity generation rolled back; an additional booking at a full venue was rejected.
- Venue coordinates and capacity persisted. Coordinate clearing, range checks, paired-coordinate validation, and invalid-capacity rejection passed.
- Edge browser verification toggled scoring modes, submitted a final result, displayed the home/venue maps, and saved/reloaded venue coordinates.
- The loaded homepage map was visually checked and showed IIT Jammu. Duplicate React keys discovered during this check were corrected to use backend IDs.
- Click-coordinate handling was tested with a mocked Maps JavaScript API. A real API key is **not configured**, so live SDK authorization and click-to-select still need verification after setup.

Local evidence: `reports/tournament-rehearsal/fixture-modes-1789936109129/`. See `results.json`, `browser.json`, `direct-result-browser.png`, `home-map-loaded.png`, and `venue-map-picker.png`. The earlier `browser-failure.json` is a superseded selector-label failure, not the final result.

Repeatable API rehearsal: `node scripts/fixture-modes-rehearsal.mjs`. Browser rehearsal: `node scripts/fixture-browser-rehearsal.mjs`. These use only the isolated test API/frontend on ports 4100/3100 and generated test data; they must not target a live event database.

## Volunteer and scorer follow-up (21 September 2026)

See [Volunteer import](VOLUNTEER_IMPORT.md) for the import workflow and current test evidence. The historical browser screenshots above include manual coordinate fields that were subsequently removed. The current venue editor uses map selection only.
