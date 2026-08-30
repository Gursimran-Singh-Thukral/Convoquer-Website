# Convoquer'26 Digital Platform

**Product:** Official Digital Platform for Convoquer'26
**Institute:** Indian Institute of Technology Jammu
**Event:** Convoquer'26
**Event Dates:** 1–4 October 2026
**Document Version:** 1.0
**Status:** Initial Product Requirements Document
**Target Feature Freeze:** 10–12 September 2026
**Primary Development Team:** Web Development Team, IIT Jammu

---

# 1. Product Overview

## 1.1 Introduction

Convoquer'26 is the annual inter-collegiate sports fest of the Indian Institute of Technology Jammu, bringing together colleges and institutes from the region to compete across multiple sporting disciplines.

The Convoquer'26 Digital Platform will be a centralized full-stack platform combining:

1. The official public-facing Convoquer'26 website.
2. A competition-management system for sports, teams, fixtures, live scores, results and standings.
3. An internal organizer platform with granular role-based access control.
4. Operational tools for sports coordination, hospitality, management, media and volunteers.
5. A secure backend and auditable data-management system.

The platform is intended to become the official digital source of truth for event information, schedules, live scores and results.

---

# 2. Product Vision

> **To build a professional, secure and centralized digital platform that serves as the official online identity of Convoquer'26 while digitally supporting the organization, management and execution of the sports fest.**

The platform should replace fragmented/manual approaches wherever practical and provide a single source of truth for:

- Sports
- Teams
- Players
- Fixtures
- Match schedules
- Live scores
- Results
- Standings
- Overall institute rankings
- Announcements
- Venues
- Media
- Sponsors
- Organizer operations

---

# 3. Product Philosophy

The system should follow five fundamental principles.

## 3.1 Single Source of Truth

Competition-related information should originate from the centralized backend rather than being independently maintained across multiple pages or systems.

For example:

```text
Match
  ↓
Live Score
  ↓
Result
  ↓
Standings
  ↓
Public Website
  ↓
Organizer Dashboards
```

## 3.2 Least Privilege

Every authenticated organizer should receive exactly the information and capabilities required for their responsibilities.

A user should receive:

> **Neither more nor less access than required.**

## 3.3 Security by Design

Authentication, authorization, sessions, audit logging, data integrity and critical-action protection must be considered during architecture and implementation rather than added after development.

## 3.4 Data-Driven Architecture

Sports, venues, tournaments, teams, matches, sponsors and similar entities should be represented as database entities rather than hard-coded website sections.

## 3.5 Phased Development

The project must be divided into manageable phases so that the team can produce a stable testable version before the September deadline.

---

# 4. Background & Existing Information

The Convoquer'26 organizing policy establishes the leadership structure as:

- Convener
- Three Co-Conveners
- Hospitality & Security Head
- Management Head
- Media Head
- Design Head
- Sponsorship Head
- Overall Sports Coordinator
- Web Developer

The policy defines the Convener as responsible for overall leadership, supervision and decision-making. Co-Conveners assist with coordination and decision-making.

The policy further defines the major Head-level responsibilities:

- Hospitality & Security — accommodation, food, guest/player management, safety, crowd management and institute security coordination.
- Management — scheduling, logistics and on-ground coordination.
- Media — social media, promotion, photography, videography and publicity.
- Design — graphics, banners, posters and branding.
- Sponsorship — sponsor outreach and sponsor relations.
- Overall Sports Coordinator — coordination of sports events, match conduct, officials and gameplay issues.
- Web Developer — development and maintenance of the official website/portal for registrations, schedules, results and live updates.

Lower-level Sports Coordinator, Volunteer and team-member workflows remain subject to further organizational confirmation.

---

# 5. Goals

## 5.1 Primary Goals

The platform should:

1. Provide the official online presence of Convoquer'26.
2. Display authoritative event information.
3. Provide centralized sports and tournament information.
4. Provide match schedules and fixtures.
5. Support live score updates.
6. Support direct result entry when live scoring is not used.
7. Automatically reflect approved results on the public website.
8. Maintain standings and tournament progression.
9. Provide an overall institute ranking/leaderboard.
10. Provide granular organizer dashboards.
11. Provide secure IIT Jammu-only organizer authentication.
12. Provide auditable critical operations.
13. Support mobile-friendly operational interfaces.
14. Be maintainable by the Web Development Team.
15. Establish a foundation that can potentially be reused for future Convoquer editions.

---

# 6. Non-Goals / Explicitly Deferred Areas

The following are not guaranteed for the initial release and require further stakeholder decisions:

- Participant self-registration.
- Public participant accounts.
- Public player profiles.
- Advanced player statistics.
- Advanced team statistics.
- Accommodation management.
- Transportation management.
- Medical facility management.
- Parking management.
- Advanced offline conflict resolution.
- Fully automated tournament generation for every possible tournament format.
- Post-Convoquer multi-year archival system beyond the foundational architecture.
- Any competition rule not officially approved by the organizing committee.

These may be introduced in later phases.

---

# 7. Event Information

## 7.1 Event

**Convoquer'26**

## 7.2 Institute

**Indian Institute of Technology Jammu**

## 7.3 Dates

**1–4 October 2026**

## 7.4 Venues

The event will use multiple venues.

Most sports are expected to be conducted on campus. Athletics is currently expected to use a track outside the campus, subject to confirmation.

The final venue list is TBD.

## 7.5 Expected Participation

Current estimates:

- Approximately 15-16 participating colleges/institutes.
- Approximately 12 sports, subject to confirmation.
- Total participant count is TBD.

---

# 8. Sports

## 8.1 Confirmed / Likely Sports

Current list:

- Cricket
- Football
- Basketball (M/W)
- Volleyball (M/W)
- Badminton (M/W/Mix)
- Table Tennis (M/W)
- Athletics (M/W)
- Chess (M/W)
- E-Sports
- Squash (M/W)
- Weightlifting

## 8.3 Dynamic Sports Model

Sports must be database-driven.

The system should not require developers to create new code merely to add a sport.

An authorized organizer should eventually be able to create/configure a sport through the organizer platform.

---

# 9. Public Platform

The public platform is available without authentication.

## 9.1 Public Navigation

Proposed structure:

```text
Home
About
Sports
Schedule
Live Scores
Results
Teams
Leaderboard
Rules & Regulations
Venues
Campus / Event Map
News
Announcements
Gallery
Sponsors
FAQ
Contact
```

---

# 10. Home Page

The Home page should function as both:

1. The primary promotional landing page.
2. The live information hub during the fest.

## 10.1 Proposed Components

- Convoquer'26 branding
- IIT Jammu branding
- Event dates
- Countdown
- Primary event introduction
- Featured sports
- Live matches
- Today's schedule
- Upcoming matches
- Recent results
- Overall leaderboard
- Latest announcements
- News
- Sponsors
- Gallery
- Contact information

## 10.2 During the Fest

The homepage should prioritize dynamic information such as:

- Live matches
- Current scores
- Upcoming fixtures
- Important announcements
- Latest results

---

# 11. About

The About section should provide:

- Convoquer overview
- History
- Convoquer'25 reference where applicable
- Purpose
- IIT Jammu association
- Event objectives
- Organizing committee information where appropriate

---

# 12. Sports Directory

The Sports page should display all sports configured for the current edition.

Each sport may provide:

```text
Sport
├── Overview
├── Teams
├── Schedule
├── Live Matches
├── Results
├── Standings
├── Bracket
└── Rules
```

Not every sport needs every section.

The UI should adapt based on the tournament configuration.

---

# 13. Schedule

The Schedule page should provide centralized event scheduling.

Users should be able to filter by:

- Sport
- Date
- Venue
- Match status

Potential states:

- Upcoming
- Live
- Completed
- Postponed
- Cancelled

Each fixture should lead to its Match Details page.

---

# 14. Live Scores

The platform should support live score display.

Example:

```text
FOOTBALL — SEMI FINAL

IIT Jammu        2
NIT Srinagar     1

67' ● LIVE
```

Live information should be generated from the same match data used by the organizer platform.

The platform should support sport-specific score structures.

Examples:

### Football

- Goals
- Match time
- Cards
- Substitutions where implemented

### Basketball

- Period/quarter scores
- Current score

### Volleyball

- Set-by-set score

### Badminton

- Game/set scores

### Chess

- Board/round results

The exact event-level scoring requirements for each sport remain configurable.

---

# 15. Direct Result Entry

The system must support a second result workflow for sports/events where live scoring is impractical.

```text
Create Result
    ↓
Enter Result
    ↓
Validate
    ↓
Submit
    ↓
Approve
    ↓
Publish
```

This is especially relevant to sports/events such as athletics and other result-oriented competitions.

---

# 16. Match Lifecycle

A match should have controlled states.

Proposed states:

```text
SCHEDULED
    ↓
READY
    ↓
LIVE
    ↓
COMPLETED
    ↓
RESULT_PENDING
    ↓
APPROVED
    ↓
PUBLISHED
```

Exceptional states:

```text
POSTPONED
CANCELLED
ABANDONED
DISPUTED
```

State transitions must be permission-controlled.

---

# 17. Results

The Results section should provide:

- Completed matches
- Sport-specific results
- Match details
- Final scores
- Result status
- Tournament progression

Only approved/published results should be treated as official public results.

---

# 18. Standings & Leaderboards

## 18.1 Sport Standings

Where applicable, sports may expose:

- Played
- Wins
- Losses
- Draws
- Points
- Scores
- Goal/run/point differential
- Other sport-specific metrics

Exact rules are TBD.

## 18.2 Overall Institute Ranking

The system should support an overall ranking of participating institutes.

The ranking calculation system is TBD and must be configurable once officially approved.

---

# 19. Teams

The public platform should provide team information where approved for public display.

Possible information:

- Institute
- Sport
- Team name
- Tournament
- Matches
- Results
- Standings

Public player-level information is TBD.

---

# 20. Rules & Regulations

Rules should be organized by:

- General rules
- Sport
- Tournament

Official rule documents should be downloadable where necessary.

---

# 21. Venues

Each venue may contain:

- Venue name
- Location
- Sports hosted
- Directions
- Map
- Schedule
- Current/upcoming matches
- Venue-specific instructions

---

# 22. Campus / Event Map

The platform should provide an event/campus map showing relevant:

- Sports venues
- Reporting desk
- Important locations
- Event facilities

Exact map implementation is TBD.

---

# 23. News

News is intended for longer-form event communication.

Potential content:

- Event announcements
- Registration opening
- Major milestones
- Event stories
- Results/highlights
- Media coverage

---

# 24. Announcements

Announcements are intended for time-sensitive information.

Examples:

- Match postponement
- Venue change
- Schedule update
- Emergency information
- Operational notices

Public announcements and internal organizer announcements must be treated as separate visibility scopes.

---

# 25. Gallery & Media

The Media team should be able to manage:

- Photos
- Albums
- Videos
- Livestream information
- Event coverage
- Published media

The platform is expected to support livestreaming, subject to final implementation details.

---

# 26. Sponsors

Sponsors should be represented as structured data.

Possible attributes:

- Sponsor name
- Logo
- Tier/category
- Website
- Display priority
- Status
- Visibility

Sponsors should be dynamically manageable.

---

# 27. FAQ

The FAQ should answer common questions regarding:

- Participation
- Sports
- Schedule
- Venues
- Reporting
- Results
- Rules
- Contacts

---

# 28. Contact

The Contact section may contain:

- Official Convoquer contact
- Reporting desk
- Emergency contacts
- Relevant institute contacts

Personal contact information should only be published after authorization.

---

# 29. Organizer Platform

Authenticated organizers should have access to both:

1. The complete public website.
2. A separate role-specific dashboard.

The public navigation should remain available to them.

An authenticated organizer should see a clearly identifiable:

> **Dashboard**

button.

---

# 30. Organizer Dashboard Principle

Every dashboard should be contextual.

A user should immediately see:

- Information relevant to their role.
- Their responsibilities.
- Their assignments.
- Relevant notifications.
- Required actions.
- Relevant schedules.

Users should not be presented with unnecessary administrative information.

---

# 31. RBAC Architecture

The authorization model shall use:

```text
User
  ↓
Roles
  ↓
Permissions
  ↓
Scope
  ↓
Assignments
```

## 31.1 Permission

Defines **what** a user may do.

## 31.2 Scope

Defines **where** the permission applies.

Possible scopes:

- Global
- Department
- Sport
- Assigned resource
- Own resource
- Public

## 31.3 Assignment

Defines the specific operational resource/task a user is responsible for.

---

# 32. Permission Actions

Core actions:

```text
VIEW
CREATE
UPDATE
DELETE
PUBLISH
APPROVE
ASSIGN
OVERRIDE
```

Domain-specific actions may include:

```text
SCORE_UPDATE
RESULT_SUBMIT
RESULT_APPROVE
IMPORT
EXPORT
REVOKE
```

---

# 33. Organizational Roles

The initial role model includes:

### Global

- Convener
- Co-Convener

### Heads

- Hospitality & Security Head
- Management Head
- Media Head
- Design Head
- Sponsorship Head
- Overall Sports Coordinator
- Web Developer

### Operational

- Sports Coordinator
- Volunteer
- Media Team
- Design Team
- Web Team
- Management Team

Additional specialized roles may be introduced without restructuring the authorization architecture.

---

# 34. Multiple Roles

A user may have multiple roles.

Example:

```text
User
├── Sports Coordinator
└── Media Team
```

Effective permissions are the union of applicable permissions, subject to scope and security restrictions.

---

# 35. Convener

The Convener shall have global authority over the platform.

Capabilities include, subject to audit:

- User management
- Role management
- Permission management
- Sports
- Tournaments
- Teams
- Players
- Matches
- Scores
- Results
- Schedules
- Venues
- Volunteers
- Tasks
- Media
- Sponsors
- Announcements
- System configuration
- Audit logs
- Sessions
- Critical overrides

The Convener's authority does not bypass audit logging.

---

# 36. Co-Convener

Co-Conveners shall have operational authority comparable to the Convener.

However:

- Each Co-Convener must have an independent account.
- Actions must be attributable to the individual.
- Co-Conveners must not impersonate the Convener.
- Sensitive and critical actions must appear in audit logs.

---

# 37. Hospitality & Security Head

The dashboard should support:

### Participant intelligence

- Participating institutes
- Teams
- Players/participants where permitted
- Expected participant counts
- Sport distribution
- Venue distribution
- Match schedules

### Hospitality

- Refreshment planning
- Expected attendance
- Venue-based participant estimates
- Hospitality assignments
- Volunteer assignments

### Security

- Operational information
- Venue information
- Crowd-related information
- Security assignments
- Internal instructions

The role should not inherently have access to competition modification, score modification or global user administration.

---

# 38. Management Head

Capabilities should include:

- Event schedules
- Venue scheduling
- Logistics (Buggy, Bus)
- On-ground coordination
- Operational tasks
- Assignments
- Schedule updates
- Venue management

Competition results and scores should not be modifiable solely by virtue of this role.

---

# 39. Media Head

Capabilities should include:

- Gallery management
- Albums
- Photography
- Videography
- Livestream management
- News
- Public announcements
- Media uploads
- Media publication
- Event publicity

Competition data remains outside this role unless separately assigned.

---

# 40. Design Head

Capabilities should focus on:

- Design assets
- Branding
- Graphics
- Posters
- Banners
- Digital creatives
- Asset organization

Design users should not automatically receive competition publication or score-management privileges.

---

# 41. Sponsorship Head

Capabilities should include:

- Sponsor records
- Sponsor tiers
- Sponsor logos
- Sponsor links
- Sponsor visibility
- Sponsor-related operational information

Confidential sponsor documents, if ever stored, should use additional restricted permissions.

---

# 42. Overall Sports Coordinator

The Overall Sports Coordinator should have cross-sport competition-management access.

Capabilities should include:

- Sports
- Tournaments
- Teams
- Players
- Fixtures
- Matches
- Officials
- Scheduling
- Venue coordination
- Live score oversight
- Result management
- Standings
- Brackets
- Sports Coordinators

The role should not automatically receive system-administration permissions.

---

# 43. Sports Coordinator

Default scope:

> **One assigned sport**

A Sports Coordinator may manage:

- Their sport
- Its teams
- Its players
- Its tournaments
- Its fixtures
- Its matches
- Its volunteers
- Its scores
- Its results
- Its standings
- Its officials
- Its relevant venues

Sports Coordinators should not manage unrelated sports.

Their exact lower-level responsibilities remain subject to formal organizational confirmation.

---

# 44. Volunteers

Volunteers should receive task-based access.

Potential capabilities:

- View own assignments
- View own schedule
- Accept assignments
- Mark assignment status
- View relevant venue information
- View relevant public/operational announcements

Volunteers should not automatically receive access to:

- Score modification
- Result approval
- User management
- Role management
- Unrelated participant data
- Competition administration

---

# 45. Media / Design / Web / Management Team Members

Team members should receive permissions below their respective Heads.

A Team Member should not automatically inherit their Head's complete permission set.

Specialized roles may be introduced for:

- Photographer
- Videographer
- Livestream operator
- Social media operator
- Designer
- Web operator
- Management volunteer

---

# 46. Authentication

Organizer authentication shall use Google authentication.

Only IIT Jammu institutional accounts are eligible.

Expected email format:

```text
student_id@iitjammu.ac.in
```

Example:

```text
2026uma0220@iitjammu.ac.in
```

Authentication shall verify:

1. Identity through Google.
2. Verified email.
3. Approved institutional domain.
4. Organizer authorization in the application database.

An IIT Jammu email address alone shall **not** grant organizer privileges.

---

# 47. Session Management

The system shall maintain a server-controlled session registry.

A session record should conceptually contain:

```text
session_id
user_id
token/session hash
created_at
last_seen_at
expires_at
ip_address
user_agent
device/session metadata
is_revoked
revocation_reason
last_rotation
```

Session identifiers must be non-predictable.

Sessions should support:

- Expiration
- Revocation
- Rotation where applicable
- Individual session termination
- Logout invalidation
- Security-event tracking

The system should detect suspicious session reuse.

IP information may be used as a security signal, but IP address alone should not be treated as an immutable identity because legitimate network changes can occur.

---

# 48. UUIDs and Identifiers

Persistent backend entities should use random, non-sequential UUID identifiers.

Sequential identifiers such as:

```text
/matches/1
/matches/2
/matches/3
```

should not be used as public resource identifiers.

Human-readable identifiers may exist separately.

Example:

```text
Internal ID:
UUID

Human Match Number:
FB-SF-02
```

UUIDs are not an authorization mechanism.

Every resource access must additionally pass authentication, authorization and scope validation.

---

# 49. Object-Level Authorization

The backend must prevent unauthorized resource access even when a user knows or guesses a resource UUID.

For every protected request:

```text
Authentication
      ↓
Session validation
      ↓
Permission validation
      ↓
Scope validation
      ↓
Resource-level authorization
      ↓
Business-rule validation
      ↓
Operation
```

A valid UUID alone must never grant access.

---

# 50. Critical Actions

Critical operations should include additional controls.

Examples:

- Final score modification
- Result approval
- Result override
- Team disqualification
- Tournament structure modification
- Permission changes
- Role changes
- Session revocation
- Critical data restoration

Critical actions should record:

```text
WHO
WHAT
WHEN
RESOURCE
BEFORE
AFTER
REASON
SESSION
```

Where appropriate, the system should require an explicit reason before performing the action.

---

# 51. Audit Logging

The system shall maintain an audit trail for important operations.

Example:

```text
User:
2026uma0220@iitjammu.ac.in

Action:
MATCH_SCORE_UPDATED

Resource:
Football Match UUID

Previous:
2–1

New:
3–1

Timestamp:
...

Session:
...

Reason:
...
```

Audit records should not be casually deletable.

Critical historical information should remain available for authorized review.

---

# 52. Data Integrity

Competition information is high-integrity data.

Score/result operations must be performed server-side.

The frontend must never be treated as a security boundary.

Before accepting a score/result update, the backend should validate:

- User authentication
- Session validity
- Permission
- Resource scope
- Match state
- Sport-specific rules
- Data validity
- State transition validity

---

# 53. Competition Engine

The competition system should be modeled around:

```text
Event
  ↓
Sport
  ↓
Tournament
  ↓
Round
  ↓
Fixture
  ↓
Match
  ↓
Score / Events
  ↓
Result
  ↓
Standings / Bracket
```

---

# 54. Tournament Formats

The architecture should support multiple tournament formats.

Potential formats:

- Knockout
- Round Robin
- League
- Swiss
- Group Stage + Knockout

The exact format of each sport is TBD.

---

# 55. Tournament Seeding

The system should support seeded tournaments.

The organizers may configure seeding constraints.

One proposed use case is preventing designated strong teams from meeting before a specified stage.

The exact rules must be defined by the organizing committee.

The system must not silently manipulate competition draws.

Any seeding configuration/generation should be traceable.

---

# 56. Fixtures

Fixtures should contain:

- Tournament
- Round
- Match
- Participating teams/participants
- Venue
- Scheduled time
- Officials
- Status

Fixtures should be editable only by authorized users.

Schedule changes should be audited.

---

# 57. Match Model

A Match should conceptually contain:

```text
Match
├── UUID
├── Sport
├── Tournament
├── Round
├── Venue
├── Scheduled Time
├── Teams / Participants
├── Officials
├── Status
├── Score
├── Live Events
├── Result
└── Audit History
```

---

# 58. Live Scoring

The system should provide a mobile-friendly scoring interface.

Primary use is expected to be on phones.

The scoring interface should prioritize:

- Large controls
- Fast interaction
- Minimal navigation
- Clear current score
- Match status
- Confirmation of critical actions

The system should support temporary local state where feasible so short connectivity interruptions do not unnecessarily destroy entered information.

Advanced offline conflict resolution is deferred.

---

# 59. Direct Result Mode

Authorized users should be able to enter a result directly when live scoring is unavailable or unsuitable.

This must follow the same validation and approval mechanisms as live-scored matches.

---

# 60. Result Approval

Results should not automatically become official merely because a score operator submitted them.

Proposed flow:

```text
Score Operator
      ↓
Submit
      ↓
Result Pending
      ↓
Authorized Sports Coordinator
      ↓
Approve
      ↓
Publish
```

Exact approval permissions will be finalized during implementation.

---

# 61. Sport-Specific Scoring

The backend should not assume that all sports use:

```text
Team A score
Team B score
```

The data model should support sport-specific scoring structures.

Examples:

```text
Football
→ Goals / match events

Basketball
→ Period scores

Volleyball
→ Set scores

Badminton
→ Game scores

Chess
→ Board / round results

Athletics
→ Individual performance results
```

The exact structures will be finalized for confirmed sports.

---

# 62. Overall Ranking

The system should support configurable overall institute ranking.

Possible scoring inputs:

- Gold
- Silver
- Bronze
- Sport position
- Tournament points

The official scoring formula is TBD.

The architecture should allow the formula to be configured without rebuilding the entire platform.

---

# 63. Participant & Team Data

The organizing institute expects to provide participant data through an Excel file.

The initial import system should therefore support:

```text
Excel
  ↓
Validation
  ↓
Preview
  ↓
Error Report
  ↓
Approval
  ↓
Database Import
```

Expected fields currently include:

- Name
- ID Photograph
- College
- Gender
- Contact Number

The final schema must be based on the official Excel format before development begins.

---

# 64. Import System

Imports should not directly overwrite production data without validation.

The system should provide:

- File validation
- Required-column validation
- Data-type validation
- Duplicate detection
- Error reporting
- Preview
- Import confirmation
- Import audit log

Import jobs should have unique IDs.

---

# 65. Hospitality Intelligence

The platform should derive useful operational information from competition data.

For example:

```text
Participant
 ↓
Team
 ↓
Sport
 ↓
Match
 ↓
Time
 ↓
Venue
```

This can allow Hospitality to estimate:

- Participants per institute
- Participants per sport
- Participants expected at each venue
- Match-based participant distribution
- Refreshment requirements

The exact operational formulas will be determined after the event logistics are finalized.

---

# 66. Volunteer Assignment System

The system should support:

```text
Head / Coordinator
      ↓
Create Assignment
      ↓
Select Volunteer
      ↓
Venue
      ↓
Date / Time
      ↓
Task
      ↓
Volunteer Dashboard
```

Potential assignment states:

```text
ASSIGNED
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
```

Exact workflow remains configurable.

---

# 67. Internal vs Public Announcements

Two separate visibility scopes should exist.

### Public Announcement

Visible to visitors.

### Internal Announcement

Visible only to authorized organizers or relevant departments.

Example:

```text
PUBLIC:
Football semifinal moved to 4 PM.

INTERNAL:
All football volunteers report to Ground 2 at 2:30 PM.
```

---

# 68. Media & Livestream

The platform should be prepared for livestreaming.

Media users may manage:

- Stream information
- Stream status
- Assigned venue
- Event coverage
- Gallery
- News
- Videos

The exact streaming provider/technical implementation is TBD.

---

# 69. Sponsors

Sponsor information should be stored as structured entities.

A sponsor may contain:

```text
UUID
Name
Logo
Tier
Website
Priority
Status
Visibility
```

Sponsor display should be dynamically generated.

---

# 70. Security Architecture

The proposed high-level security flow is:

```text
Internet
   ↓
Cloudflare
   ↓
HTTPS
   ↓
Application
   ↓
Authentication
   ↓
Session Validation
   ↓
Authorization
   ↓
Input Validation
   ↓
Business Rules
   ↓
Database Transaction
   ↓
Audit Log
```

Cloudflare will serve as the external protection layer for bot/DDoS-related traffic.

Application-level authorization and data-integrity protections remain mandatory.

---

# 71. Security Requirements

The system should implement, as applicable:

- HTTPS
- Secure authentication
- Google OAuth
- Verified institutional domain
- Secure sessions
- Session expiration
- Session revocation
- Secure cookies where applicable
- CSRF protection where applicable
- Server-side authorization
- Object-level authorization
- Input validation
- Database constraints
- Transactional critical operations
- Audit logs
- UUID identifiers
- Secrets management
- Environment-variable separation
- Production/debug separation
- Secure error handling
- Backup/recovery procedures
- Cloudflare protection

No system can honestly guarantee that it is impossible to compromise; the engineering requirement is to minimize attack surface and ensure that compromise of a single identifier or client-side control does not grant unauthorized access.

---

# 72. Frontend Security Principle

The frontend must never be considered authoritative for permissions.

For example, hiding:

```text
[Edit Score]
```

does not constitute security.

The backend must independently reject unauthorized requests.

---

# 73. Database Security

The database must not be directly exposed to the public Internet unless explicitly required and secured.

Application services should mediate database access.

Production credentials must not be committed to GitHub.

Database migrations should be version-controlled.

---

# 74. Data Deletion

Critical competition data should not be casually hard-deleted.

Where appropriate:

```text
ACTIVE
 ↓
ARCHIVED
```

should be preferred.

Critical historical information should remain available through audit/history mechanisms.

---

# 75. Public / Private Data Separation

The database may contain information that must never appear publicly.

Examples:

- Internal organizer information
- Session metadata
- Audit logs
- Internal assignments
- Sensitive participant data
- Private sponsor information

The API layer must explicitly determine what information is publicly serializable.

---

# 76. Technical Architecture

The exact technology stack will be finalized after the requirements are approved.

The architecture should consist conceptually of:

```text
Browser / Mobile
       ↓
Cloudflare
       ↓
Frontend
       ↓
Backend API
       ↓
Authentication / Authorization
       ↓
Application Services
       ↓
Database
       ↓
File / Media Storage
```

The system should support deployment on the IIT Jammu-provided VM where feasible.

---

# 77. Code Quality & Formatting

The codebase shall use automated formatting and linting.

Developers should not manually spend time correcting indentation or line spacing.

The project should use:

- Prettier
- ESLint
- EditorConfig
- TypeScript
- Automated checks

VS Code should be configured for formatting on save.

---

# 78. Automated Code Checks

Every Pull Request should automatically check:

```text
Formatting
Linting
Type checking
Tests
Build
```

A Pull Request that fails required checks should not be merged into the protected main branch.

---

# 79. GitHub Workflow

Recommended workflow:

```text
main
  │
  └── development
        │
        ├── feature/home
        ├── feature/auth
        ├── feature/rbac
        ├── feature/scoring
        └── feature/dashboard
```

Developers should:

1. Create a feature branch.
2. Implement the feature.
3. Commit changes.
4. Push the branch.
5. Open a Pull Request.
6. Pass automated checks.
7. Receive code review.
8. Merge through the approved workflow.

Direct pushes to protected branches should be restricted.

---

# 80. Development Standards

The project should establish:

- Branch naming conventions
- Commit conventions
- Pull Request conventions
- Code-review requirements
- Formatting rules
- Naming conventions
- Folder structure
- Component conventions
- API conventions
- Error-handling conventions
- Environment configuration
- Definition of Done

These should be documented separately in the engineering documentation.

---

# 81. Accessibility

The public website should aim for:

- Keyboard accessibility
- Adequate contrast
- Semantic HTML
- Meaningful labels
- Accessible forms
- Responsive design
- Reduced-motion consideration
- Screen-reader-friendly structure

---

# 82. Responsive Design

The public website must work across:

- Desktop
- Laptop
- Tablet
- Mobile

The organizer platform should additionally prioritize mobile usability for operational roles.

The live-scoring interface should be designed primarily for phone-sized screens.

---

# 83. Performance

The public website should prioritize:

- Fast initial load
- Optimized images
- Lazy loading
- Efficient API requests
- Caching where appropriate
- Minimal unnecessary JavaScript
- Responsive interactions

Live score updates should avoid unnecessarily polling the backend at excessive frequencies.

The final real-time mechanism will be determined during technical architecture.

---

# 84. SEO

The public website should include:

- Proper page titles
- Meta descriptions
- Open Graph metadata
- Structured semantic HTML
- Sitemap
- Robots configuration
- Social sharing metadata
- Indexable public content

Private organizer pages must not be indexed.

---

# 85. Observability

The production platform should provide enough visibility to diagnose issues.

At minimum:

- Application logs
- Error logs
- Authentication failures
- Critical operation logs
- Database errors
- Deployment logs
- Audit logs

Sensitive data must not be unnecessarily written to logs.

---

# 86. Backup & Recovery

Production data should have a backup strategy.

The exact:

- Frequency
- Retention
- Storage location
- Restoration procedure

must be finalized before production deployment.

A backup that has never been tested for restoration should not be considered sufficient.

---

# 87. V1 Priority Model

Features should be classified as:

### P0 — Critical

Required for the platform to be considered operational.

### P1 — High

Important for the official event experience.

### P2 — Medium

Useful but can be deferred.

### P3 — Future

Not required for Convoquer'26 initial deployment.

---

# 88. Proposed P0 Features

The following should be treated as the initial critical scope:

## Public

- Home
- About
- Sports
- Schedule
- Live Scores
- Results
- Teams
- Leaderboard
- Rules
- Venues
- Announcements
- Contact

## Competition

- Sports
- Teams
- Tournament structure
- Fixtures
- Matches
- Basic live scoring
- Direct result entry
- Result approval
- Standings where applicable

## Organizer

- Google authentication
- IIT Jammu domain restriction
- Session management
- RBAC foundation
- Convener / Co-Convener access
- Sports Coordinator functionality
- Basic volunteer assignments
- Basic Management functionality

## Security

- UUID identifiers
- Server-side authorization
- Object-level authorization
- Audit logging
- Secure sessions
- Cloudflare deployment
- Protected database access

## Development

- GitHub repository
- Branch protection
- Formatting
- Linting
- Type checking
- Automated CI

---

# 89. Proposed P1 Features

- Advanced tournament generation
- Advanced seeding
- Sport-specific advanced live events
- Hospitality intelligence
- Advanced volunteer task management
- Media dashboard
- Livestream management
- Sponsor management
- Gallery
- News CMS
- Campus map
- Advanced standings
- Player statistics

---

# 90. Proposed P2 Features

- Advanced player profiles
- Advanced team statistics
- Advanced analytics
- Advanced offline scoring
- Advanced notifications
- Advanced operational dashboards
- Advanced media workflows

---

# 91. Proposed P3 / Future

- Multi-year Convoquer editions
- Convoquer'27 using the same platform
- Historical archives
- Advanced tournament-generation algorithms
- Advanced analytics
- Full operational resource planning
- More sophisticated participant logistics

---

# 92. Development Phases

## Phase 0 — Foundation

### Objective

Establish the development environment.

Deliverables:

- GitHub repository
- Branch strategy
- Project structure
- Formatting
- Linting
- TypeScript
- CI
- Development documentation
- Environment configuration

---

## Phase 1 — Public Website Foundation

Deliver:

- Layout
- Navigation
- Home
- About
- Sports
- Rules
- Venues
- Sponsors
- Contact
- Responsive design

---

## Phase 2 — Authentication & RBAC

Deliver:

- Google login
- IIT Jammu email restriction
- User records
- Roles
- Permissions
- Scopes
- Sessions
- Logout
- Session revocation
- Organizer dashboard routing

---

## Phase 3 — Core Competition Data

Deliver:

- Sports
- Institutes
- Teams
- Players
- Tournaments
- Venues
- Fixtures
- Matches

Include validated Excel import.

---

## Phase 4 — Competition Operations

Deliver:

- Schedule
- Match management
- Tournament rounds
- Basic brackets
- Standings
- Result entry
- Result approval

---

## Phase 5 — Live Scoring

Deliver:

- Mobile scoring interface
- Live match state
- Sport-specific score models for priority sports
- Live public display
- Match completion
- Result submission

---

## Phase 6 — Organizer Dashboards

Deliver department-specific dashboards.

Priority:

1. Convener
2. Co-Conveners
3. Overall Sports Coordinator
4. Sports Coordinators
5. Management
6. Hospitality
7. Media
8. Volunteers
9. Other departments

---

## Phase 7 — Media & Event Experience

Deliver:

- Gallery
- News
- Livestream integration
- Announcements
- Sponsors
- Map
- Event information

---

## Phase 8 — Integration & Testing

Perform:

- End-to-end testing
- Permission testing
- Score integrity testing
- Session testing
- Import testing
- Mobile testing
- Browser testing
- Performance testing
- Security review
- Failure testing

---

## Phase 9 — Production

Deliver:

- Production deployment
- Domain
- Cloudflare
- HTTPS
- Database
- Backups
- Monitoring
- Final security verification

---

# 93. Deadline Strategy

The project should target:

## 10–12 September

**Feature freeze / test-ready build**

No major new features should be introduced after this point.

## 12–17 September

Focus on:

- Bug fixing
- Testing
- Security review
- Performance
- Data validation
- Deployment
- Documentation

## 18–23 September

The project team should minimize development workload around the lead developer's mid-semester examinations.

---

# 94. Team Development Strategy

The development team consists of approximately:

- 1 Project Lead / Web Developer
- 6–7 beginner developers

The project must therefore include a learning-oriented workflow.

Beginners should not be assigned large undefined modules.

Each developer should follow:

```text
Learn
 ↓
Small Exercise
 ↓
Guided Implementation
 ↓
Feature
 ↓
Code Review
 ↓
Merge
```

---

# 95. Proposed Team Workstreams

Final allocation will be determined after technical-stack selection.

Potential workstreams:

### Project Lead

- Architecture
- Integration
- Code review
- Security decisions
- Critical backend logic
- Deployment
- Technical coordination

### Frontend Team

- Public website
- Components
- Responsive UI
- Public data presentation

### Backend Team

- API
- Database
- Authentication
- RBAC
- Competition engine

### Competition Team

- Fixtures
- Match management
- Scoring
- Results
- Standings

### Organizer Platform Team

- Dashboards
- Tasks
- Assignments
- Department functionality

### QA / Platform

- Testing
- CI
- Deployment
- Monitoring
- Documentation

These are workstreams, not final assignments.

---

# 96. Acceptance Criteria

The platform should not be considered ready merely because pages render.

A feature is considered complete when:

1. Required functionality works.
2. Unauthorized users cannot perform the operation.
3. Relevant edge cases are handled.
4. Data is validated.
5. Errors are handled gracefully.
6. UI is responsive where applicable.
7. Tests exist for critical logic.
8. Formatting/linting/type checks pass.
9. The feature has been reviewed.
10. Relevant documentation exists.

---

# 97. Competition Integrity Acceptance Criteria

The following must hold:

### Unauthorized score modification

A user without the required permission must receive an authorization failure.

### Wrong sport

A Football Coordinator must not be able to modify Cricket data.

### Invalid state

A completed/published match must not be modified through ordinary score-update operations.

### Auditability

Critical score/result changes must record the responsible user and previous/current values.

### UUID manipulation

Knowing another resource's UUID must not grant access to that resource.

### Session theft

A copied session credential must not automatically provide unrestricted access from an unrelated environment.

### Result integrity

Public results must originate from approved competition data.

---

# 98. Open Decisions

The following require stakeholder confirmation:

- Final sports list. (11)
- Final number of participating institutes. (TBD)
- Exact participant fields. (TBD)
- Official Excel structure. (TBD)
- Tournament format for each sport. (TBD)
- Overall ranking formula. (TBD)
- Final scoring rules. (TBD)
- Final venue list. (TBD)
- Medical facilities. (Will be Provided)
- Transportation. (Buggies for Internal Movements)
- Parking. (Provided)
- Refreshment arrangements. (Sports Head, Hospitality Head)
- Volunteer responsibilities. (Respective Heads)
- Sports Coordinator responsibilities. (Score Approval, Requirements, Equipments, Scoring, Referees)
- Exact media/livestream system. (Youtube Link, Drive Link)
- Public player information. (Jersey Number, Name)
- Public participant information. (Jersey Number, Name)
- Final notification strategy. (WhatsApp, Mail)
- Final post-Convoquer archival requirements.

These must not be silently assumed by developers.

---

# 99. Important Architectural Decisions Already Approved

The following decisions are considered accepted for the project:

1. Convoquer'26 will be a full digital platform rather than only a promotional website.
2. The public website and organizer platform will use the same underlying system.
3. Organizers can browse the public website normally.
4. Authenticated organizers receive a separate Dashboard entry point.
5. Organizer accounts use IIT Jammu institutional Google authentication.
6. Only authorized IIT Jammu users receive organizer privileges.
7. Users may have multiple roles.
8. Authorization will be granular and scope-aware.
9. Convener has absolute operational authority.
10. Co-Conveners have comparable operational authority with individual traceability.
11. Sports Coordinators are scoped to their assigned sport.
12. Volunteers use assignment-oriented access.
13. Live scoring and direct-result workflows will both exist.
14. UUIDs will be used for persistent identifiers.
15. UUIDs will never substitute for authorization.
16. Server-side authorization is mandatory.
17. Critical actions must be auditable.
18. Sessions must be server-controlled and revocable.
19. Cloudflare will provide an external defensive layer against bot/DDoS-related traffic.
20. Code formatting will be automated.
21. GitHub-based development with automated CI will be used.
22. The project will be developed in phases.
23. Feature freeze is targeted for 10–12 September 2026.

---

# 100. Future Architecture Direction

The system should be designed so that the Convoquer platform can potentially evolve into:

```text
Convoquer Platform
│
├── Convoquer'26
├── Convoquer'27
├── Convoquer'28
└── ...
```

Each edition can eventually have its own:

- Sports
- Teams
- Participants
- Tournaments
- Matches
- Results
- Rankings
- Media
- Sponsors

This is a future architectural objective and does not imply that a complete multi-year archive must be delivered for Convoquer'26.

---

# 101. Success Criteria

The project will be considered successful if, before Convoquer'26:

### Public users can

- Find event information.
- Find sports.
- Find schedules.
- Find venues.
- Follow live scores.
- View results.
- View standings.
- View announcements.
- Access official rules.
- Access event information from mobile devices.

### Organizers can

- Authenticate securely.
- Access only their permitted functionality.
- Manage relevant operational information.
- Manage matches and scores according to their permissions.
- Publish/approve relevant information.
- Manage assignments where applicable.
- Trace critical actions.

### The system can

- Maintain competition data centrally.
- Import official participant data.
- Support multiple tournament formats.
- Support live scoring.
- Support direct result entry.
- Protect critical competition data.
- Maintain an audit trail.
- Run through the official domain.
- Be maintained by the Web Development Team.

---

# 102. Product Principle

The most important principle of the Convoquer'26 Digital Platform is:

> **The public should see what is happening. The organizers should see what they need to do. The system should know who is allowed to do what.**

This principle should guide future feature decisions, UI design, database architecture and authorization logic.
