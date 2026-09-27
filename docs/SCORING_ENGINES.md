# Sport scoring engines

Convoquer keeps scoring rules in server-side, deterministic reducers under
`server/src/modules/scoring/engines`. The scorer UI sends domain events; it
does not calculate or persist an authoritative score. Reversing an event
replays the remaining event log through the same reducer.

## Current coverage

- Cricket: toss and bat/bowl decision, limited-overs innings, legal deliveries,
  extras, wickets, targets, automatic strike changes, free hits, batting
  scorecards, bowling figures and delivery history.
- Badminton: BWF-style best-of-three rally scoring, 30-point cap, singles or
  doubles roster setup, and server/receiver state.
- Volleyball, table tennis and squash: sport-specific set/game targets and
  win-by-two rules.
- Football, basketball, chess, athletics and weightlifting: dedicated event
  reducers in the same directory.

Match configuration remains in `Tournament.formatConfig`, such as
`oversPerInnings`, `bestOfGames`, and `pointsPerGame`. Existing event records
without player metadata remain valid and replay with aggregate scoring.

Every match in `LIVE` status is shown in the public Live Arena. `isTelecast`
may still be used for featured video or broadcast treatment, but it does not
hide the official score feed.

## Open-source references

The architecture and implementation remain native to Convoquer so that its
RBAC, event log, result approval and database transactions stay authoritative.
The following projects were reviewed as rule and interaction references:

- [Cricksnap](https://github.com/AssassinAsh/scorecard) for ball entry,
  scorecard fields, strike changes and limited-overs presentation. Its README
  identifies the project as MIT licensed; no source code was copied.
- [Badminton Scoreboard](https://github.com/BoviliusMeidi/badmintonscore-web)
  for singles/doubles service setup and reducer-based match state. The project
  is MIT licensed, copyright 2025 Bovilius Meidi; Convoquer's implementation
  was independently adapted to its team IDs and server event log.
- [Volley Overlay Control](https://github.com/JacoboSanchez/volley-overlay-control)
  (Apache-2.0) and [svc-scoreboard](https://github.com/ThomDietrich/svc-scoreboard)
  (MIT) were assessed for future display and clock work.

Do not paste a third-party application's UI, authentication, or persistence
layer into the client. Add rules behind the `SportEngine` interface, include
replay tests, and expose only the relevant controls in the scorer console.
