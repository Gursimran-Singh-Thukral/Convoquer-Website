# Final-result scorecards (no live scoring)

Convoquer'26 records **final results only**. Live scoring and Weight Lifting were cancelled. The
respective Sports Coordinator enters the finished match's scorecard (Fixtures → Enter result, or
Scorer → Enter final result), an approver publishes it under **Results → Approvals**, and only then do
standings and knockout brackets move.

The server validates each scorecard and **derives** the winner and headline score from it
(`server/src/modules/results/result-formats.ts`), so a headline can never disagree with the detail.
The published scorecard is copied onto the match, so every public page renders the same data.

| Sport                      | What is entered                                                                                                                                  | Headline score            | Notes                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------- |
| Badminton (Men / Women)    | Team tie of games, each game best of 3 sets, entered set by set. Men: best of **5** games; Women: best of **3** games                            | Games won (3–2)           | The tie ends at a majority, so a later game only exists while the tie is open                   |
| Volleyball (Men, Women)    | Points of each set, best of **5** sets (first to 3)                                                                                              | Sets won (3–2)            | The 4th/5th set only appear while the match is open; no level sets                              |
| Table Tennis (Men / Women) | Best of **5 matches** (Men) / **3 matches** (Women), stopping at a majority like badminton; each match best of 3 sets to **11** points, win by 2 | Matches won (3–2)         | Set scores are validated (11–9, 12–10 …); player names per match are optional                   |
| Basketball                 | 4 quarters (+ overtime periods)                                                                                                                  | Total points              | Cannot end level: overtime required                                                             |
| Cricket                    | Runs / wickets / overs per innings, who batted first, 20 overs max                                                                               | Runs                      | Margin is worded "won by 12 runs" / "by 4 wickets"; a tie takes a super over or a chosen winner |
| Football                   | Full-time goals, optional extra time, optional penalty shoot-out                                                                                 | Goals                     | A level knockout **requires** the shoot-out; shown as `1–1 (4–3 pens)`                          |
| Chess                      | **4 boards** (each team fields 4 players; board N meets board N), optional player names                                                          | Board points (4 in total) | 2–2 is a drawn match. Win 2 match points, draw 1, loss 0                                        |
| Athletics                  | Ranked entries per category (Men / Women / Mixed): position, team, athlete, mark, DNS/DNF/DQ/NM                                                  | —                         | Semi-finals tick **Q** for finalists; everything is entered in one go per event                 |
| E-Sports — Valorant        | Final score of each knockout match                                                                                                               | Score                     | Semi-finals → final, plus a 3rd-place match. Cannot end level                                   |
| E-Sports — Free Fire, BGMI | One lobby per game: position, kills, placement points (PP), kill points (KP)                                                                     | —                         | See below                                                                                       |

## Free Fire and BGMI

Each game (Match 1, Match 2, …) is entered as its own lobby. PP defaults to the usual placement table
for that game (Free Fire 12-9-8-7-6-5-4-3-2-1; BGMI 15-12-10-8-6-4-2-1) and KP to 1 per kill; both can be
overridden. The **overall points table** (shown on Standings, one tab per game) adds up every
published game: Wins (first places), PP, KP and Total.

Teams level on total points are separated by — Free Fire: **wins → kill points → placement points**
(then Booyah, which is the same thing as a win). BGMI: **wins → placement points → kill points**.

## Chess standings

Points are 2 / 1 / 0. Tie-breaks after match points — Men (5-round Swiss): **Buchholz Cut-1** (opponents'
points without the lowest), then **Sonneborn–Berger**. Women (round robin): **Sonneborn–Berger**, then the
**direct encounter**. Swiss byes score a win but are not an opponent. Badminton, table tennis and volleyball
tables also break ties on rally-point difference after set/game difference.

## Men's chess Swiss

The tournament and its seven seeded teams are imported; rounds are not pre-made. Create each round in
**Tournaments → Manage → Generate → Swiss** (round 1 start time 3 Oct 10:00), publish its results,
then generate the next one.

## Data changes

Migration `20261001000000_final_results_only` sets every sport and unstarted match to results-only and
removes the Weight Lifting sport (its teams are deleted; participants are kept).
`server/prisma/import-fixtures.ts` reads `Fixtures.csv` plus `Chess Fixtures.csv` (flags: `--dry-run`,
`--replace`, `--only=<sport regex>`, `--csv=<path>`). E-Sports is imported as three tournaments —
Valorant (knockout), Free Fire and BGMI (points tables); re-run with `--replace --only=e-sports` to
split an older single E-Sports tournament.
