# Volunteer import and scoring follow-up

## Import volunteers

Open **Organizer → Import volunteers**. The account needs `volunteer.manage`; both import endpoints enforce this permission.

1. Prepare a Google Sheets tab with the headers below, or download the template from the import page.
2. Download the tab as CSV and upload it. Alternatively, expand **Import from a readable Google Sheets link**, paste the link and select **Load sheet**. The selected `gid` tab is used.
3. Review the preview and select **Validate volunteers**. Validation performs no writes.
4. Select **Import volunteers**. The confirmation reports created and updated records.

| Column                        | Requirement                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| `name`, `email`               | Required; email identifies a volunteer on repeat imports, ignoring case |
| `contactNumber`, `department` | Optional                                                                |
| `shift`                       | Optional: MORNING, AFTERNOON, EVENING, NIGHT                            |
| `status`                      | Optional: ACTIVE, ON_BREAK, RELIEVED                                    |
| `venueName` or `venueId`      | Optional; venue must exist. Use ID when names are ambiguous             |

Example generated test data:

```csv
name,email,department,shift,status
Test Volunteer A,volunteer-a@example.test,Scoring,MORNING,ACTIVE
Test Volunteer B,volunteer-b@example.test,Logistics,EVENING,ACTIVE
```

Imports support 1–1,000 records and files up to 2 MB. Quoted commas, line breaks, escaped quotes and UTF-8 BOMs are supported. Blank optional CSV values preserve existing values during reimport. Duplicate emails within a batch, ambiguous existing records and invalid venues reject the entire batch. A failed batch leaves no partial import. Completed imports create an audit record with counts.

Google Sheets links must be readable by the server without an interactive login. This feature does not connect to a private Google account. For private sheets, use CSV upload; changing sharing permissions is unnecessary. No real user sheet was supplied during testing. The URL export and redirect handling were tested with mocked Google responses.

## Scoring and buttons

- Sports & venues exposes **Sport scoring mode**. New Chess sports default to results-only; other sports default to live. Existing Chess sports and unstarted fixtures are migrated to results-only.
- New fixtures and generated schedules inherit the sport setting unless overridden. Changing a sport updates its unstarted fixtures, including previous fixture overrides. Started and completed matches retain their mode.
- Results-only fixtures appear in Scorer with **Enter final result**. A scorer deep link also opens the result editor. Result submission and publication remain separate authorized actions.
- Fixture Edit sends only changed fields, avoiding backend rejection from unchanged bracket teams/winner fields. Winner entry belongs in the result editor. Fields protected after match start are disabled.
- Homepage match action buttons now link to their backend fixture. Explore supports clicking and Escape.
- Venue selection captures a clicked Google Maps pin automatically. Manual coordinate inputs are removed. Configure the browser Maps key using [Maps setup](FIXTURES_AND_MAPS.md#google-maps-setup). Without it, only map viewing is available.

## Verification

The isolated rehearsal uses PostgreSQL on port 55432 and API/frontend ports 4100/3100. It does not reset or import generated records into the project database.

`node scripts/volunteer-sport-rehearsal.mjs` exercises sport defaults, inherited bracket modes, preservation of started fixtures, volunteer dry runs, persistence, repeat imports, rollback, permission denial, browser CSV import, direct result submission from Scorer, and homepage/Explore navigation. `node scripts/fixture-edit-rehearsal.mjs` checks fixture edits and the venue editor.

Evidence: `reports/tournament-rehearsal/volunteer-sport-1789982905543/results.json`, with browser screenshots in the same directory. Regression suite: **137 tests passed** (23 client, 114 server). Both production builds passed. The Google Maps click handler is tested with an SDK mock; real provider authorization and pin selection still require the configured key and a live check. This is not an exhaustive certification of every site button or every sport's scoring rules.
