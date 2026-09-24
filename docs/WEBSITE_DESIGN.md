# Convoquer'26 — Website Design, Pages & Component Architecture

Comprehensive specification of all pages, layouts, component hierarchies, visual states, and design system tokens for the Convoquer'26 digital platform.

---

## 1. Design System & Visual Identity

### 1.1 Official Color Scheme: "Golden Hour"

Convoquer'26 is visually anchored by the **"Golden Hour"** identity — evoking collegiate sports championship dusk, dramatic stadium floodlights against evening skies, and the golden glory of podium triumph.

- **Primary Colors**:
  - **Burgundy (`HEX #800020`)**: Deep, regal, collegiate base representing endurance, discipline, and IIT Jammu athletic heritage.
  - **Night Wine Surface (`HEX #180308` / `#27060F`)**: Dark base surfaces and deep obsidian wine cards.
  - **Crimson Carrot (`HEX #FF4500`)**: Blazing high-energy accent representing athletic sprint, adrenaline, active live games, and bold CTAs.
  - **Gold (`HEX #FFD700`)**: Radiant champion gold representing trophies, Seed 1 top rankings, medals, and high-impact typographic highlights.
- **Hero & Radiant Gradients**:
  - `linear-gradient(135deg, #800020 0%, #FF4500 52%, #FFD700 100%)` (The iconic Golden Hour stadium gradient).
  - `radial-gradient(circle at top right, rgba(255, 69, 0, 0.25), rgba(128, 0, 32, 0.35), transparent 70%)`.
- **Anti-AI Editorial Aesthetics**:
  - **Avoiding Generic SaaS Clichés**: No sterile floating 4-pill bento boxes, no generic robotic drop-shadows, no centered "Unlock your sports potential" AI slogans.
  - **Tactile Sports Editorial**: Authentic physical elements — textured match ticket stubs with perforation lines, physical tournament bracket cards, stadium floodlight flare glows, monospaced score ticker boards, and raw collegiate team typography with sharp angular accents.
- **Typography**:
  - **Display Headings**: `Syne`, `Cabinet Grotesk`, or `Outfit` with tight tracking and uppercase condensed impact.
  - **Body Text**: `Inter` or `Plus Jakarta Sans` for clean, high-contrast, effortless legibility.
  - **Game Clock & Numbers**: `JetBrains Mono` or `Chakra Petch` for monospaced score numerals that never shift during real-time updates.

---

## 2. Core Portals & Architectural Domains

The Convoquer'26 frontend spans **4 interconnected portals** sharing a unified design language:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONVOQUER'26 FRONTEND                         │
├───────────────────┬───────────────────┬────────────────┬────────────────┤
│  1. Public Site   │  2. Security Gate │  3. Live Score │  4. Organizer  │
│  (Fans, Athletes) │  (Security Staff) │  (Referees)    │  (Conveners)   │
└───────────────────┴───────────────────┴────────────────┴────────────────┘
```

---

## 3. Global Layout Shells

### 3.1 Public Shell (`PublicLayout`)

Wraps all public-facing pages (`/`, `/schedule`, `/sports`, `/standings`, `/venues`).

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ [Logo + Edition Badge]  [Live Ticker Ribbon]  [Nav Links]  [Search] [Login]│  <-- Header
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                             PAGE CONTENT                                │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ [Sponsors]  [Quick Links]  [Emergency Contacts]  [IIT Jammu Info]  [Social] │  <-- Footer
└─────────────────────────────────────────────────────────────────────────┘
```

#### Key Shell Components:

1. **`Navbar`**:
   - Sticky top bar with glassmorphic background (`bg-zinc-950/80 backdrop-blur-lg border-b border-white/10`).
   - Convoquer'26 Logo with glowing edition pill (`'26`).
   - Navigation links: Home, Sports, Schedule, Standings, Colleges, Venues, About.
   - Quick Search Trigger (`Ctrl+K` command palette for instant match/team lookup).
   - "Get Pass / Register" CTA button (direct link to spectator registration).
   - Staff / Organizer Login button (`Sign In with Google`).
2. **`LiveMatchTicker`**:
   - Sub-header horizontal marquee / ribbon displaying real-time scores for ongoing matches.
   - Live blinking badge (`● LIVE`), Sport tag, Teams, current score, and minute/over.
   - Clicking any item navigates directly to the match's live center.
3. **`Footer`**:
   - Convoquer'26 branding and IIT Jammu sports council credits.
   - Official festival dates, campus coordinates, and emergency medical/security desk phone hotlines.
   - Quick sitemap and rulebook download links.

---

### 3.2 Security Desk Shell (`SecurityLayout`)

High-contrast, distraction-free tablet/laptop UI optimized for daylight readability and rapid input at campus entry gates.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 🛡️ CONVOQUER'26 SECURITY DESK  | Gate 1 - North     [Gate Officer Name] │
├─────────────────────────────────────────────────────────────────────────┤
│ [🔍 Instant Pass & Participant Search]          [+ Issue On-Spot Pass]  │
├─────────────────────────────────────────────────────────────────────────┤
│                     VERIFICATION & CHECK-IN WORKSPACE                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Scorer Console Shell (`ScorerLayout`)

Mobile-first layout designed for field-side scorekeepers operating under bright sunlight or with one hand.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ ⏱️ LIVE MATCH CONTROLLER: FB-SF-01                 [Undo] [Finish Match] │
├─────────────────────────────────────────────────────────────────────────┤
│                     SCOREBOARD & ACTION CONTROLS                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 3.4 Organizer Admin Shell (`OrganizerLayout`)

Desktop/tablet operations dashboard with collapsible sidebar, breadcrumbs, and role-based action access.

```text
┌───────────────┬─────────────────────────────────────────────────────────┐
│ [Convoquer'26]│ [Breadcrumbs]          [Active Role Badge]  [User Avatar]│
│               ├─────────────────────────────────────────────────────────┤
│ • Overview    │                                                         │
│ • Tournaments │                                                         │
│ • Fixtures    │                    ADMIN DASHBOARD                      │
│ • Teams       │                                                         │
│ • Users/RBAC  │                                                         │
│ • Audit Logs  │                                                         │
└───────────────┴─────────────────────────────────────────────────────────┘
```

---

## 4. Public Website Pages (Detailed Breakdown)

---

### Page 1: Home / Landing Page (`/`)

**Purpose**: Primary landing page to wow visitors, introduce the festival, highlight live games, and drive engagement.

#### Layout Wireframe:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ HERO: Ambient 3D Stadium Glow | Headline | Countdown | [Schedule] [Pass]│
├─────────────────────────────────────────────────────────────────────────┤
│ LIVE & UPCOMING HIGHLIGHTS: Horizontal Carousel of Ongoing Matches      │
├─────────────────────────────────────────────────────────────────────────┤
│ SPORTS GRID: Interactive cards with sport icons & athlete counts        │
├─────────────────────────────────────────────────────────────────────────┤
│ TOURNAMENT BRACKET SPOTLIGHT: Live interactive mini-bracket preview     │
├─────────────────────────────────────────────────────────────────────────┤
│ MEDAL TALLY SNAPSHOT: Top 4 Institutes Leaderboard + Full Standings CTA │
├─────────────────────────────────────────────────────────────────────────┤
│ CAMPUS MAP & VENUES: Interactive quick-guide to sports zones            │
├─────────────────────────────────────────────────────────────────────────┤
│ SPONSORS & PARTNERS CAROUSEL                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Component Breakdown:

1. **`HeroSection`**:
   - Animated Convoquer'26 emblem with glowing typography: _"North India's Premier Inter-Collegiate Sports Battle"_.
   - Live Countdown Timer (Days, Hours, Minutes, Seconds) with metallic glass card styling.
   - Dual Call to Actions: Primary _"View Live Schedule"_ and Secondary _"Get Spectator Pass"_.
2. **`LiveMatchCarousel`**:
   - Card stack showing active matches with real-time score counters, quarter/half indicators, and animated live pulses.
3. **`SportsBentoGrid`**:
   - 8–10 sports cards (Cricket, Football, Basketball, Volleyball, Badminton, Table Tennis, Chess, Athletics).
   - Hover effects: dynamic background image zoom, participating team counts, and direct sport page link.
4. **`MedalTallyPreview`**:
   - Podium visualization (1st, 2nd, 3rd) displaying Institute logo, Gold/Silver/Bronze pill counts, and total points.
5. **`VenueQuickMap`**:
   - Stylized dark map of IIT Jammu campus highlighting Main Stadium, Cricket Ground, SAC Indoor Arena, and Outdoor Courts.

---

### Page 2: Sports Directory (`/sports`)

**Purpose**: Complete catalog of all sports categories in Convoquer'26.

#### Layout & Components:

- **`SportsHeader`**: Title, search bar, and filter tabs (`All`, `Outdoor Fields`, `Indoor Arena`, `Racquet Sports`, `Mind Sports`).
- **`SportCardGrid`**:
  - Sport Name, Category badge (Men/Women/Mixed).
  - Venue badge with map link.
  - Active tournament format tag (`KNOCKOUT`, `ROUND_ROBIN`).
  - Participating teams counter.
  - CTA button: _"Explore Fixtures & Teams"_.

---

### Page 3: Sport Detail Page (`/sports/[slug]`)

**Purpose**: Deep-dive page for a specific sport (e.g., `/sports/football`, `/sports/cricket`).

#### Layout Wireframe:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ SPORT HERO BANNER: Sport Title, Venue Tag, Format Tag, Rulebook PDF CTA │
├─────────────────────────────────────────────────────────────────────────┤
│ TABS: [Overview]  [Tournaments & Brackets]  [Fixtures]  [Teams]  [Rules] │
├─────────────────────────────────────────────────────────────────────────┤
│ TAB CONTENT AREA                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Component Breakdown:

1. **`SportHeroBanner`**: Sport emblem, venue name with direct campus link, total registered teams, download link for official rules PDF.
2. **`SportTabNav`**: Interactive tab strip switching between:
   - **Overview Tab**: Sport rules summary, scoring structure, match durations, match ball / equipment specifications.
   - **Tournaments & Brackets Tab**: Embedded interactive knockout bracket or round-robin table for this sport.
   - **Fixtures Tab**: Filtered schedule showing only matches for this sport.
   - **Teams Tab**: Grid of registered teams from participating colleges with player rosters.
   - **Rules & Regulations Tab**: Complete guidelines, tie-breaker mechanisms, and official fouls/penalties.

---

### Page 4: Schedule & Fixtures Page (`/schedule`)

**Purpose**: Master schedule viewer for all matches throughout the festival.

#### Layout Wireframe:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ DATE SELECTOR PILLS: [Day 1 - Oct 1] [Day 2 - Oct 2] [Day 3] [Day 4]    │
├─────────────────────────────────────────────────────────────────────────┤
│ FILTERS: [Sport ▼] [Venue ▼] [Status: Live/Upcoming/Finished] [Search]  │
│ VIEW TOGGLE: [List View] | [Court Gantt Timeline View]                  │
├─────────────────────────────────────────────────────────────────────────┤
│ MATCH CARDS LIST (Grouped by Time Slot or Venue):                       │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ⚽ FOOTBALL | Main Ground | 09:00 AM | SEMIFINALS                   │ │
│ │ [Logo] IIT Jammu (Seed 1)  vs  [Logo] GCET Jammu (Seed 4)           │ │
│ │ Status: SCHEDULED | Referee: Dr. A. Sharma | [Match Center →]       │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Component Breakdown:

1. **`DatePillSelector`**: Horizontal scrollable date pills showing festival dates with active day highlight.
2. **`FilterToolbar`**:
   - Sport dropdown (with multi-select capability).
   - Venue filter dropdown.
   - Status chips: `All`, `Live Now` (animated green dot), `Upcoming`, `Completed`.
   - Team search input.
3. **`MatchCard`**:
   - Sport icon & stage tag (e.g. `SEMIFINALS`, `GROUP A`).
   - Venue location chip and scheduled time.
   - Team A vs Team B matchup with seed badges (e.g. `Seed 1`).
   - Real-time score indicator (if Live or Completed).
   - "Match Center" action button.
4. **`CourtTimelineView` (Alternative View)**:
   - Gantt-style timeline grid showing courts/venues along the Y-axis and hours along the X-axis for visual schedule density.

---

### Page 5: Match Detail & Live Match Center (`/matches/[id]`)

**Purpose**: The central live hub for a specific match with real-time score updates, lineups, and commentary.

#### Layout Wireframe:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ MATCH BANNER: Status Badge (● LIVE 62') | Venue | Stage: Semifinal 1   │
│ [Team A Logo] IIT Jammu    2  -  1    NIT Srinagar [Team B Logo]        │
│ Scorers: Sharma 14', Verma 55'        Scorer: Mir 38'                   │
├─────────────────────────────────────────────────────────────────────────┤
│ TABS: [Live Commentary & Events]  [Lineups & Rosters]  [Head-to-Head]   │
├─────────────────────────────────────────────────────────────────────────┤
│ LEFT: Match Event Timeline          │ RIGHT: Match Officials & Weather │
│ • 55' ⚽ Goal by Rahul Verma (IITJ) │ • Referee: Prof. R. Singh        │
│ • 45' 🟨 Yellow Card - NIT #7       │ • Scorekeeper: Aman (SAC)        │
│ • 38' ⚽ Goal by T. Mir (NIT)       │ • Venue: Main Ground             │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Component Breakdown:

1. **`MatchHeroScoreboard`**:
   - Team names, institute crests, and big monospaced score numerals.
   - Sport-specific sub-scores (halves, quarters, overs/wickets, or set scores).
   - Live match clock / status badge.
2. **`MatchEventTimeline`**:
   - Vertical timeline of key events (Goals, Wickets, Cards, Substitutions, Timeouts) with timestamp badges and player names.
3. **`TeamRosterComparison`**:
   - Side-by-side player lists for Team A and Team B.
   - Captain (`(C)`), Vice Captain (`(VC)`), and Jersey numbers.
4. **`OfficialsCard`**:
   - Lead referee, umpires, and official scorekeeper credentials.

---

### Page 6: Interactive Tournament Bracket Page (`/tournaments/[id]/bracket`)

**Purpose**: Full interactive tree visualization for knockout stages.

#### Key Features & Components:

1. **`BracketTreeViewer`**:
   - Pan-and-zoom SVG/Canvas tree connecting Round of 16, Quarterfinals, Semifinals, and Finals.
   - **Guaranteed Seeding Separation Display**:
     - Clearly highlights **Seed 1** on the Top Half and **Seed 2** on the Bottom Half.
     - Visual connector lines indicating that Seed 1 and Seed 2 cannot meet until the Final championship box.
2. **`BracketMatchNode`**:
   - Compact node displaying Team A (Seed) vs Team B (Seed), winner highlight, and match score.
   - Clicking a node opens a quick drawer with full match details.

---

### Page 7: Standings & Overall Medal Tally (`/standings`)

**Purpose**: Overall leaderboard of colleges competing for the Convoquer'26 Championship Trophy.

#### Component Breakdown:

1. **`ChampionshipLeaderboard`**:
   - Ranked list of institutes.
   - Columns: Rank, College Logo & Name, Gold 🥇, Silver 🥈, Bronze 🥉, Total Medals, Total Aggregate Points.
   - Champion highlight border for the 1st position college.
2. **`SportStandingsAccordion`**:
   - Expandable points tables for each sport (League / Round-Robin format).
   - Columns: Position, Team, Played (P), Won (W), Lost (L), Drawn (D), Goal Diff / Net Run Rate (GD/NRR), Points (PTS).

---

### Page 8: Colleges & Contingents Directory (`/institutes` & `/institutes/[id]`)

**Purpose**: Profiles of all participating institutes and their contingents.

#### Component Breakdown:

1. **`InstitutesGrid`**: Cards for each college (IIT Jammu, NIT Srinagar, SMVDU, GCET, etc.) with location, logo, contingent size, and medal count.
2. **`InstituteProfileView`**:
   - College banner, short name, state, official contacts.
   - List of all teams fielded by the college across sports.
   - Complete athlete contingent roster with photos, roll numbers, and assigned sports.

---

### Page 9: Campus Venues & Logistics Guide (`/venues`)

**Purpose**: Navigation and logistical assistance for visiting athletes, guests, and audience.

#### Component Breakdown:

1. **`InteractiveCampusMap`**: Detailed map overlay with venue pins (Main Ground, Cricket Ground, Indoor SAC Arena, Courts).
2. **`VenueDetailCards`**:
   - Venue Name, capacity, lighting/floodlight availability, sports hosted, directions from Gate 1 / Gate 2.
   - Current live match status at this venue.

---

### Page 10: About, Rules & Organizing Committee (`/about`)

**Purpose**: Information about the fest, leadership, and contact points.

#### Component Breakdown:

1. **`FestVisionSection`**: Legacy of Convoquer, theme, sportsmanship charter.
2. **`CommitteeGrid`**: Convener, Co-Conveners, Sports Heads, Web Team with photos and contact info.
3. **`EmergencyContactsStrip`**: Medical room, Security Control Room, Transport Desk phone numbers.

---

## 5. Security & Gate Desk Portal Pages

---

### Page 11: Security Gate Search & Clearance Dashboard (`/security`)

**Purpose**: Primary tool used by campus security guards at gates to verify arriving athletes, visitors, and audience members.

#### Layout Wireframe:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 🛡️ GATE 1 PASS VERIFICATION DESK             [Scanner: ON] [On-Spot Pass]│
├─────────────────────────────────────────────────────────────────────────┤
│ [ 🔍 Type Name, Roll Number, Phone, or Gate Pass CQ26-P-...        ]   │
├─────────────────────────────────────────────────────────────────────────┤
│ QUICK VERIFICATION CARD:                                                │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [Photo]  RAHUL SHARMA | Roll: 2023CSB101 | Institute: IIT Jammu    │ │
│ │ Category: ATHLETE | Sport: Football Men | Gate Pass: CQ26-P-8B9F2A  │ │
│ │ Status: [NOT CHECKED IN]                     [ ✔ VERIFY & CHECK IN ] │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ RECENT GATE CHECK-INS (Live Audit Stream)                               │
│ • 18:24 - Priya Gupta (CQ26-AUD-3001) - Audience - CHECKED IN          │
│ • 18:22 - Aman Deep (CQ26-P-1092) - Athlete (IIT Delhi) - CHECKED IN   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Component Breakdown:

1. **`LiveSecuritySearchBar`**:
   - Ultra-responsive, debounced search querying the PostgreSQL participant database.
   - Instant match across: Name, Roll Number, Phone Number, Gate Pass Number (`CQ26-P-xxxx`, `CQ26-AUD-xxxx`), or College.
2. **`QRScannerModal`**:
   - Uses device camera to scan athlete or spectator QR codes on phones or printed badges for instant check-in.
3. **`AttendeeVerificationCard`**:
   - Shows attendee photograph, full name, institute badge, category badge (`ATHLETE`, `AUDIENCE`, `GUEST`, `OFFICIAL`).
   - Primary Action: Glowing green _"Verify & Check In"_ button.
   - Already Checked-in Alert: Displays prominent warning if pass was already scanned earlier (with exact check-in timestamp) to stop badge-sharing.
4. **`LiveCheckInFeed`**:
   - Auto-updating stream of attendees cleared through the gate.

---

### Page 12: On-Spot Spectator / Guest Pass Registration (`/security/on-spot-pass`)

**Purpose**: Fast form for unregistered guests, local students, or unlisted visitors arriving at the campus gate.

#### Layout & Components:

1. **`OnSpotRegistrationForm`**:
   - Full Name (required).
   - Mobile Contact Number (required for SMS/WhatsApp pass receipt).
   - Category Selector: `AUDIENCE` | `GUEST` | `ATHLETE (Unlisted)`.
   - Institute / College / Affiliation name (with autocomplete from existing colleges).
   - College Roll / ID Number (optional).
   - Primary Action: _"Issue Pass & Check In Instantly"_.
2. **`IssuedPassModal`**:
   - Automatically generates unique alphanumeric pass (`CQ26-AUD-XXXXXX`).
   - Immediately visible in the security search without page refresh.
   - Generates scannable QR badge on screen with print/download option.

---

## 6. Live Scoring & Field-Side Referee Console Pages

---

### Page 13: Live Scorer Console (`/scorer/matches/[id]`)

**Purpose**: Official mobile scoring interface for referees and field scorekeepers to broadcast live events.

#### Component Breakdown (Adaptive by Sport):

1. **`ScoreboardHeader`**:
   - Game clock / quarter / half selector with Pause / Resume toggle.
   - Big touch-friendly score display.
2. **Football Controls**:
   - Quick Buttons: `+1 Goal Team A`, `+1 Goal Team B`.
   - Goal Event Dialog: Selects goal scorer and assist from team roster.
   - Card Logger: Selects player, Card Type (`Yellow`, `Red`), timestamp.
   - Substitution dialog.
3. **Cricket Controls**:
   - Runs: `0`, `1`, `2`, `3`, `4`, `6`.
   - Extras: `Wide`, `No Ball`, `Leg Bye`, `Bye`.
   - Wicket modal (Dismissal type, fielder, incoming batsman).
   - Over summary strip.
4. **Safety & Audit Bar**:
   - Prominent `Undo Last Action` button.
   - `Finalize Match` button with two-step confirmation dialog to submit official results.

---

## 7. Organizer & Admin Portal Pages

---

### Page 14: Organizer Executive Overview (`/organizer`)

**Purpose**: Real-time high-level operations dashboard for conveners and sports heads.

#### Component Breakdown:

1. **`MetricsRow`**:
   - Total Matches Today (Live / Remaining / Finished).
   - Total Athletes Checked-In vs Expected.
   - Active Venues & Courts in Use.
   - Pending Match Results awaiting approval.
2. **`QuickActionsGrid`**:
   - Create Fixture, Reschedule Match, Register On-Spot Contingent, Assign Referees.
3. **`LiveIncidentTracker`**:
   - Real-time stream of delays, weather pauses, or venue conflicts.

---

### Page 15: Tournament & Bracket Manager (`/organizer/tournaments` & `/organizer/tournaments/[id]`)

**Purpose**: Creation and configuration of tournaments, seeding, and bracket generation.

#### Component Breakdown:

1. **`TournamentConfigForm`**:
   - Sport selector, Tournament Name, Format (`KNOCKOUT`, `ROUND_ROBIN`, `GROUP_KNOCKOUT`).
   - Points configuration (Points for Win, Draw, Loss).
2. **`SeedingManagementPanel` (Crucial User Requirement)**:
   - Rank-order list of participating teams.
   - Drag-and-drop or rank inputs to assign **Seed 1**, **Seed 2**, **Seed 3**, **Seed 4**...
   - **Guaranteed Separation Badge**: Shows clear visual indicator that Seed 1 and Seed 2 are assigned to opposite halves of the bracket tree so they cannot play each other before the Finals.
3. **`AutomatedBracketGeneratorModal`**:
   - Generates elimination bracket stages and sequenced match time slots with break intervals.
4. **`RoundRobinGeneratorModal`**:
   - Generates complete round-robin schedules using the Berger polygon pairing algorithm.

---

### Page 16: Match Scheduling & Conflict Resolver (`/organizer/matches`)

**Purpose**: Complete fixture schedule management and rescheduling tool.

#### Component Breakdown:

1. **`MatchTable`**:
   - Filterable table of all matches with date, venue, teams, status, and assigned scorekeepers.
2. **`RescheduleMatchModal`**:
   - Allows changing start time, end time, or venue.
   - **Integrated Conflict Detection Engine**:
     - Automatically checks if venue is occupied in the requested time window.
     - Automatically checks if either team has another match scheduled in that window.
     - Displays real-time warning if a collision exists and blocks double-booking.
   - Requires a mandatory "Rescheduling Reason" written directly to the `AuditLog`.

---

### Page 17: Team & Contingent Approval Hub (`/organizer/teams`)

**Purpose**: Reviewing college registrations, verifying student IDs, and roster approval.

#### Component Breakdown:

1. **`TeamApprovalList`**: Filter by college and sport; status toggles (`PENDING`, `APPROVED`, `REJECTED`).
2. **`BulkRosterImportModal`**:
   - Drag-and-drop file upload for Excel / CSV roster sheets.
   - Row-by-row validation preview (checks duplicate roll numbers, missing colleges).
   - "Import and Auto-Generate Gate Passes" button.

---

### Page 18: User Management & RBAC Permissions (`/organizer/users`)

**Purpose**: Granting and revoking roles for fest volunteers, media, scorekeepers, and coordinators.

#### Component Breakdown:

1. **`UserDirectory`**: List of system users with active roles.
2. **`RoleAssignmentDrawer`**:
   - Checkboxes for roles: `CONVENER`, `SPORTS_HEAD`, `SPORTS_COORDINATOR`, `SCOREKEEPER`, `MEDIA`, `VOLUNTEER`.
   - **Sport Scope Selector**: Limits permissions for Sports Coordinators to their assigned sport (e.g. Football only).

---

### Page 19: Security & System Audit Log Explorer (`/organizer/audit-logs`)

**Purpose**: Complete compliance and audit traceability across Convoquer'26 operations.

#### Component Breakdown:

1. **`AuditLogTable`**:
   - Timestamp, User (with email and role), Action category (`match.reschedule`, `security.checkin`, `score.update`), Target Resource, and Old State vs New State diff viewer.
   - Export to CSV for post-event festival reports.

---

## 8. Common UI Components & States

### 8.1 Universal Component Library

| Component           | Usage                                | States Handled                                                |
| :------------------ | :----------------------------------- | :------------------------------------------------------------ |
| `MatchScoreChip`    | Compact live/final score chip        | Live (pulsing green), Scheduled (time), Finished (bold score) |
| `SeedBadge`         | Displays seed rank (e.g. `Seed 1`)   | Gold (`#1`), Silver (`#2`), Slate (`#3+`)                     |
| `StatusBadge`       | Visual state tags across app         | `LIVE`, `SCHEDULED`, `COMPLETED`, `RESCHEDULED`, `CANCELLED`  |
| `CollegeLogoAvatar` | College crest with fallback initials | Loaded, Fallback, Monogram placeholder                        |
| `TimeSlotPicker`    | DateTime selector with conflict hint | Available (green border), Conflicted (red glow)               |
| `EmptyState`        | Displays when filters return 0 items | Clean illustration, message, "Clear Filters" button           |
| `SkeletonCard`      | Skeleton loader during data fetching | Shimmer animation on glass card shape                         |

### 8.2 Error & Boundary Handling

- **404 Page (`/not-found`)**: Collegiate-themed "Out of Bounds" graphic with quick links back to Schedule and Home.
- **Unauthorized Page (`/unauthorized`)**: Explains required RBAC roles with "Return to Public Portal" action.
- **Offline / Network Reconnect Banner**: Floating toast alerting user when internet connectivity drops and displaying cached offline data.

---

## 9. Summary Sitemap & Routing Structure

```text
/ (Home)
├── /sports (All Sports Directory)
│   └── /sports/[slug] (Sport Details, Rules & Fixtures)
├── /schedule (Master Schedule & Match Viewer)
├── /matches/[id] (Live Match Center & Lineups)
├── /tournaments/[id]/bracket (Knockout Bracket Tree)
├── /standings (Points Tables & Overall Medal Tally)
├── /institutes (Participating Colleges)
│   └── /institutes/[id] (College Profile & Rosters)
├── /venues (Campus Venues & Interactive Map)
├── /about (Organizing Committee & Rules)
│
├── /security (Gate Desk Search & Verification)
│   └── /security/on-spot-pass (On-Spot Spectator Pass Issuance)
│
├── /scorer/matches/[id] (Mobile Field-Side Scorekeeper Console)
│
└── /organizer (Organizer Operations Dashboard)
    ├── /organizer/tournaments (Tournament & Bracket Seeding)
    ├── /organizer/matches (Scheduling & Conflict Resolver)
    ├── /organizer/teams (Team Approval & CSV Bulk Import)
    ├── /organizer/users (RBAC Permissions & Roles)
    └── /organizer/audit-logs (Security & Operation Audit Trail)
```
