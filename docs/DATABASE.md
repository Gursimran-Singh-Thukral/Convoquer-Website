# Convoquer'26 Digital Platform — Database Architecture

**Project:** Convoquer'26 Digital Platform  
**Institute:** Indian Institute of Technology Jammu  
**Event:** Convoquer'26  
**Database:** PostgreSQL  
**ORM:** Prisma  
**Database Document Version:** 1.0  
**Status:** Approved Database Design Baseline

---

# 1. Purpose

This document defines the logical database architecture of the Convoquer'26 Digital Platform.

It describes:

- What data the platform stores.
- How entities are related.
- Which data is authoritative.
- Which data is derived.
- How users and permissions are represented.
- How competition data is represented.
- How sessions are managed.
- How critical actions are audited.
- How participant data is imported.
- How database integrity is maintained.

The actual Prisma schema should be generated from this design after review.

---

# 2. Database Philosophy

The database must be:

- Relational.
- Strongly constrained.
- Transaction-safe.
- Auditable.
- Modular.
- Understandable to the development team.
- Extensible to future Convoquer editions.

The database should not become a dumping ground for frontend state.

The database stores **authoritative application data**, while temporary UI state remains on the client where appropriate.

---

# 3. Database Technology

## 3.1 PostgreSQL

PostgreSQL is the primary database.

Reasons:

- Strong relational model.
- Transactions.
- Foreign-key constraints.
- Good indexing.
- JSON support where genuinely useful.
- Strong consistency.
- Mature production ecosystem.

---

# 4. Prisma

Prisma will provide the primary application-level database interface.

Responsibilities:

- Schema definition.
- Migrations.
- Type-safe queries.
- Relationships.
- Transactions.
- Development tooling.

The application should avoid arbitrary database access from controllers.

Preferred flow:

```text id="v1d0b5"
Controller
    ↓
Service
    ↓
Prisma
    ↓
PostgreSQL
```

---

# 5. Database Domain Structure

The database is logically divided into:

```text id="m7my9v"
IDENTITY
├── User
├── Role
├── Permission
├── UserRole
├── RolePermission
└── Session

ORGANIZATION
├── Department
├── Task
├── Assignment
└── Volunteer-related data

EVENT
├── Event
├── Sport
├── Venue
└── Official

PARTICIPATION
├── Institute
├── Team
├── Participant
└── TeamMembership

COMPETITION
├── Tournament
├── TournamentParticipant
├── Round
├── Fixture
├── Match
├── MatchParticipant
├── ScoreEvent
├── Result
├── Standings
└── Bracket

CONTENT
├── News
├── Announcement
├── Gallery
├── Media
└── Sponsor

SYSTEM
├── ImportJob
├── AuditLog
└── SystemSetting
```

Some names are conceptual and may change during schema implementation.

---

# 6. ID Strategy

All major persistent entities should use random UUID identifiers.

Examples:

```text id="q8yd3m"
User
Event
Sport
Institute
Team
Player
Tournament
Round
Match
Result
Venue
Assignment
AuditLog
```

---

# 7. UUID Principle

UUIDs are intended to make identifiers difficult to guess.

However:

> UUIDs are not a security boundary.

For example:

```text id="b3n3rj"
/matches/<UUID>
```

must still require authorization for protected operations.

The server must verify:

```text id="5t7rc9"
Authentication
+
Permission
+
Scope
+
Resource Authorization
```

---

# 8. Public Identifiers

Where useful, entities may additionally have human-readable identifiers.

Example:

```text id="0f9vpo"
UUID:
550e8400-e29b-41d4-a716-446655440000

Match Number:
FB-SF-02
```

The UUID remains the canonical database identifier.

---

# 9. Event

The `Event` entity represents a particular edition of Convoquer.

Example:

```text id="9c7xk6"
Convoquer'26
```

Conceptual fields:

```text
id
name
slug
edition
start_date
end_date
description
status
created_at
updated_at
```

Potential status:

```text
DRAFT
UPCOMING
LIVE
COMPLETED
ARCHIVED
```

---

# 10. Event Relationships

An Event can contain:

```text id="8h6q0d"
Event
├── Sports
├── Institutes
├── Teams
├── Participants
├── Tournaments
├── Venues
├── Sponsors
├── News
├── Announcements
└── Galleries
```

This makes future editions possible.

---

# 11. User

A `User` represents an authenticated person using the organizer platform.

Conceptual fields:

```text
id
email
name
profile_photo_url
google_subject_id
is_active
created_at
updated_at
last_login_at
```

The exact profile fields depend on the Google OAuth implementation.

---

# 12. Institutional Email

Organizer users must use IIT Jammu institutional email addresses.

Example:

```text
2026uma0220@iitjammu.ac.in
```

The email should be normalized before storage.

The database should enforce uniqueness on the normalized email.

---

# 13. Google Identity

The Google account's stable provider identifier should be stored where required.

The application must not rely solely on email text to identify a Google account.

Conceptually:

```text id="5tb1jy"
User
├── email
└── google_subject_id
```

The exact OAuth implementation will determine the final field names.

---

# 14. User Status

A user may have a lifecycle such as:

```text id="2g5d5f"
PENDING
ACTIVE
SUSPENDED
DEACTIVATED
```

A deactivated user must not be able to create new authenticated sessions.

Existing sessions should be revocable.

---

# 15. Role

A Role represents a collection of permissions.

Examples:

```text
CONVENER
CO_CONVENER
HOSPITALITY_HEAD
SECURITY_HEAD
MANAGEMENT_HEAD
MEDIA_HEAD
DESIGN_HEAD
SPONSORSHIP_HEAD
OVERALL_SPORTS_COORDINATOR
WEB_DEVELOPER
SPORTS_COORDINATOR
VOLUNTEER
MEDIA_MEMBER
DESIGN_MEMBER
WEB_MEMBER
MANAGEMENT_MEMBER
```

Some of these may eventually be represented as configurable roles rather than hard-coded enums.

---

# 16. Permission

A Permission represents an atomic capability.

Examples:

```text
sports.view
sports.update

match.view
match.update

score.update
result.submit
result.approve

user.view
user.update

role.assign

media.create
media.publish

task.assign
task.update

audit.view
```

Permissions should remain fine-grained.

---

# 17. UserRole

Because one person can have multiple roles, the relationship is many-to-many.

Conceptually:

```text id="ry8t6y"
User
 │
 ├── UserRole ── Role
 │
 ├── UserRole ── Role
 │
 └── UserRole ── Role
```

A UserRole may contain:

```text
id
user_id
role_id
event_id
department_id
sport_id
assigned_by
created_at
expires_at
```

Scope fields are optional depending on the role.

---

# 18. RolePermission

A RolePermission joins roles with permissions.

```text id="91b2mk"
Role
  │
  └── RolePermission
         │
         └── Permission
```

A role should not directly contain arbitrary permission logic inside application code.

---

# 19. Role Scope

A role may have a scope.

Examples:

```text id="3otq3q"
Global
Department
Sport
Assignment
```

Example:

```text id="w1ux8x"
Role:
SPORTS_COORDINATOR

Scope:
Sport = Football
```

---

# 20. Session

A `Session` represents an active authenticated browser session.

Conceptual fields:

```text
id
user_id
token_hash
created_at
last_seen_at
expires_at
revoked_at
revocation_reason
ip_address
user_agent
device_metadata
last_rotation_at
```

---

# 21. Session Security

The database stores a secure representation of the session credential rather than exposing session secrets.

The browser receives the session identifier through a secure cookie.

The server resolves the session against the database.

---

# 22. Session Lifecycle

```text id="9x8xw7"
CREATED
   ↓
ACTIVE
   ↓
EXPIRED
```

or:

```text id="m14o2q"
ACTIVE
   ↓
REVOKED
```

Possible revocation reasons:

```text
USER_LOGOUT
ADMIN_REVOKED
SECURITY_EVENT
USER_DEACTIVATED
SESSION_EXPIRED
```

---

# 23. Session Validation

Every protected request should verify:

```text id="u4r3b6"
Session exists
AND
Session is not revoked
AND
Session is not expired
AND
User is active
```

Additional security signals may be evaluated where appropriate.

---

# 24. Session IP Address

The session records the originating IP address.

IP information can be used for:

- Security auditing.
- Suspicious-session detection.
- Incident investigation.

It should not automatically invalidate a session whenever the IP changes.

Mobile networks and institutional networks can legitimately change IP addresses.

---

# 25. Department

A `Department` represents an organizational section.

Examples:

```text
Hospitality & Security
Management
Media
Design
Sponsorship
Sports
Web
```

Departments may contain:

- Heads.
- Members.
- Volunteers.
- Tasks.
- Assignments.

---

# 26. Task

A Task represents operational work.

Examples:

```text
Venue setup
Participant assistance
Reporting desk
Media coverage
Sports ground preparation
```

Conceptual fields:

```text
id
event_id
department_id
title
description
priority
status
created_by
created_at
updated_at
```

---

# 27. Assignment

An Assignment connects a person to an operational task.

Conceptual fields:

```text
id
task_id
user_id
venue_id
start_time
end_time
status
assigned_by
created_at
updated_at
```

---

# 28. Assignment Status

Proposed states:

```text
ASSIGNED
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
```

---

# 29. Institute

An `Institute` represents a participating college/institute.

Conceptual fields:

```text
id
event_id
name
short_name
logo_url
city
state
status
created_at
updated_at
```

An institute belongs to an Event edition.

---

# 30. Institute Uniqueness

The same institute may participate in multiple Convoquer editions.

Therefore:

```text id="y0b2x8"
Institute
```

should be considered event-specific unless a future global institution registry is deliberately introduced.

For the initial system:

```text id="n2y6k1"
Event
  ↓
Institute
```

is acceptable.

---

# 31. Participant

A Participant represents a person registered for the event.

Conceptual fields:

```text
id
event_id
institute_id
name
photograph_url
roll_number
gender
date_of_birth
contact_number
created_at
updated_at
```

The final fields depend on the official registration spreadsheet.

Fields currently marked TBD must not be assumed to be required.

---

# 32. Participant Privacy

Not every participant field is public.

Potentially sensitive fields include:

- Roll number.
- Date of birth.
- Contact number.
- Internal registration information.

The database may store these fields while the public API deliberately excludes them.

---

# 33. Participant vs User

A Participant is **not necessarily an application User**.

```text id="h9j6w5"
Participant
    ≠
Organizer User
```

A participant may not have an organizer login.

The two entities should remain separate.

---

# 34. Team

A Team represents a participating sporting team.

Conceptual fields:

```text
id
event_id
institute_id
sport_id
name
short_name
status
created_at
updated_at
```

Examples:

```text
IIT Jammu Football Team
NIT Srinagar Basketball Team
```

---

# 35. Team Membership

A participant can belong to one or more teams where the competition rules permit it.

Use a joining entity:

```text id="d3c4xp"
Participant
     │
     └── TeamMembership
              │
              └── Team
```

Conceptual fields:

```text
id
team_id
participant_id
role
created_at
```

Potential roles:

```text
PLAYER
CAPTAIN
SUBSTITUTE
```

Exact role set is TBD.

---

# 36. Sport

A Sport represents a competition discipline.

Conceptual fields:

```text
id
event_id
name
slug
description
logo_url
is_active
created_at
updated_at
```

---

# 37. Sport Configuration

Sport-specific configuration should not be hard-coded into the UI.

Potential configuration:

```text
scoring_type
competition_format
points_system
tiebreaker_system
player_statistics_enabled
team_statistics_enabled
```

Some configuration may belong to Tournament rather than Sport.

---

# 38. Tournament

A Tournament represents a specific competition within a sport.

Conceptual fields:

```text
id
event_id
sport_id
name
format
status
points_system
configuration
created_at
updated_at
```

Potential formats:

```text
KNOCKOUT
ROUND_ROBIN
LEAGUE
SWISS
GROUP_KNOCKOUT
```

---

# 39. Tournament Participant

A TournamentParticipant identifies who is actually participating in a particular tournament.

This is useful because:

- Not every team necessarily participates in every tournament.
- Chess may use individuals.
- Athletics may contain individual participants.
- Future sports may have different competition units.

Conceptually:

```text id="a6k0cq"
Tournament
      │
      └── TournamentParticipant
                │
                └── Team / Participant
```

The exact polymorphic design will be finalized during schema implementation.

---

# 40. Tournament Configuration

Tournament-specific configuration may include:

```text
number_of_rounds
points_for_win
points_for_draw
points_for_loss
tiebreakers
seeding_rules
qualification_rules
```

Configuration must be validated server-side.

---

# 41. Round

A Round represents a stage or iteration within a tournament.

Examples:

```text
Group Stage
Quarter Final
Semi Final
Final
```

Swiss:

```text
Round 1
Round 2
Round 3
```

Conceptual fields:

```text
id
tournament_id
name
round_number
type
status
```

---

# 42. Fixture

A Fixture represents a scheduled competition encounter.

Conceptual fields:

```text
id
tournament_id
round_id
venue_id
scheduled_at
status
```

A fixture may generate or correspond to a Match.

---

# 43. Match

A Match is the primary competitive unit for match-based sports.

Conceptual fields:

```text
id
fixture_id
tournament_id
round_id
venue_id
match_number
scheduled_at
started_at
ended_at
status
```

---

# 44. Match Participants

A Match may contain:

- Two teams.
- Multiple participants.
- Individual competitors.

Therefore the architecture should not permanently assume exactly two team IDs.

Conceptually:

```text id="q1a5k2"
Match
  │
  └── MatchParticipant
         ├── Team
         └── Participant
```

The exact representation will be determined based on the confirmed sports.

---

# 45. Match Status

Potential states:

```text
SCHEDULED
READY
LIVE
COMPLETED
RESULT_PENDING
APPROVED
PUBLISHED
POSTPONED
CANCELLED
ABANDONED
DISPUTED
```

---

# 46. Score

A score represents the current competitive state of a match.

The architecture should distinguish between:

```text id="v2z0q4"
Current Score
```

and:

```text id="n4k5k3"
Score History / Score Events
```

The current score may be derived from score events or stored as a materialized current state for performance.

The final strategy will be determined per sport.

---

# 47. Score Event

A ScoreEvent records a meaningful scoring action.

Conceptual fields:

```text
id
match_id
sequence_number
timestamp
participant_id
event_type
value
metadata
created_by
created_at
```

Examples:

```text
FOOTBALL_GOAL
BASKETBALL_POINTS
VOLLEYBALL_POINT
BADMINTON_POINT
```

The event structure should be sport-aware.

---

# 48. Score Event Ordering

Score events should have deterministic ordering.

A `sequence_number` may be used alongside timestamps.

Example:

```text
1
2
3
4
```

This allows the system to reconstruct a match timeline.

---

# 49. Score Corrections

Corrections should not silently overwrite historical information where auditability is required.

Preferred model:

```text id="a9m4c0"
Original Event
      ↓
Correction / Reversal
      ↓
New State
```

The exact correction mechanism depends on the sport.

Critical changes must generate audit records.

---

# 50. Result

A Result represents the official outcome of a competition.

Conceptual fields:

```text
id
match_id
status
winner
final_score
submitted_by
submitted_at
approved_by
approved_at
published_at
created_at
updated_at
```

---

# 51. Result Status

Proposed:

```text
DRAFT
SUBMITTED
APPROVED
PUBLISHED
REJECTED
```

---

# 52. Result Approval

The result workflow is:

```text id="m0o2p9"
Score / Result Operator
        ↓
SUBMITTED
        ↓
Authorized Sports Authority
        ↓
APPROVED
        ↓
PUBLISHED
```

The exact approval hierarchy is defined separately in `RBAC.md`.

---

# 53. Result Immutability

Once a result becomes officially published, ordinary users must not be able to modify it.

A correction should use an explicit correction/override workflow.

Example:

```text id="9d6q2w"
Published Result
      ↓
Correction Requested
      ↓
Authorized Override
      ↓
Corrected Result
      ↓
Audit
      ↓
Republished
```

---

# 54. Standings

Standings represent the current competitive ranking within a tournament.

Possible fields:

```text
id
tournament_id
participant_id
played
wins
losses
draws
points
score_for
score_against
differential
rank
```

The exact fields depend on sport.

---

# 55. Derived vs Stored Standings

Standings are fundamentally derived from results.

The architecture should prefer:

```text id="r2g9by"
Approved Results
      ↓
Standings Calculation
```

rather than allowing arbitrary manual edits.

A cached/materialized standings table may be used for performance if necessary.

---

# 56. Bracket

Knockout brackets can be represented through rounds, fixtures and advancement relationships.

Conceptually:

```text id="9g1qmc"
Quarter Final
  ├── Winner → Semi Final
  └── Loser

Semi Final
  ├── Winner → Final
  └── Loser
```

The exact schema should avoid duplicating participant information unnecessarily.

---

# 57. Overall Institute Ranking

The overall Convoquer ranking is derived from competition outcomes.

Conceptually:

```text id="7k3z8x"
Results
   ↓
Medals / Sport Points
   ↓
Institute Total
   ↓
Overall Ranking
```

The official scoring formula remains TBD.

---

# 58. Medal Tally

The system should support medal records.

Conceptually:

```text id="7m3r8z"
Institute
├── Gold
├── Silver
└── Bronze
```

Whether medal tally is stored directly or calculated from approved results should be determined after the final ranking rules are confirmed.

---

# 59. Venue

A Venue represents a physical event location.

Conceptual fields:

```text
id
event_id
name
description
address
latitude
longitude
map_reference
directions
is_active
```

Potential additional fields:

```text
capacity
contact_information
instructions
```

Only confirmed information should be stored.

---

# 60. Officials

Officials may be associated with sports or matches.

Potential fields:

```text
id
event_id
name
role
contact_information
```

Match-specific assignment:

```text
MatchOfficial
├── match_id
├── official_id
└── role
```

Exact official data requirements are TBD.

---

# 61. News

A News entity represents public editorial content.

Conceptual fields:

```text
id
event_id
title
slug
content
cover_media_id
status
author_id
published_at
created_at
updated_at
```

Potential statuses:

```text
DRAFT
PUBLISHED
ARCHIVED
```

---

# 62. Announcement

Announcements are short operational communications.

Conceptual fields:

```text
id
event_id
title
content
visibility
priority
status
created_by
published_at
created_at
updated_at
```

Visibility may be:

```text
PUBLIC
INTERNAL
DEPARTMENT
SPORT
```

---

# 63. Media

A Media entity represents an uploaded media asset.

Conceptual fields:

```text
id
event_id
storage_key
url
type
mime_type
file_size
title
description
uploaded_by
created_at
```

Potential media types:

```text
IMAGE
VIDEO
DOCUMENT
```

---

# 64. Gallery

A Gallery groups media assets.

Conceptual fields:

```text
id
event_id
title
description
cover_media_id
status
created_at
updated_at
```

Relationship:

```text id="k4v8qa"
Gallery
   │
   └── GalleryMedia
          │
          └── Media
```

---

# 65. Sponsor

A Sponsor represents an event sponsor.

Conceptual fields:

```text
id
event_id
name
logo_media_id
tier
website_url
display_priority
status
created_at
updated_at
```

---

# 66. Import Job

An ImportJob tracks participant/data imports.

Conceptual fields:

```text
id
event_id
file_name
file_reference
status
total_rows
successful_rows
failed_rows
uploaded_by
started_at
completed_at
error_report
```

---

# 67. Import Status

Potential states:

```text
UPLOADED
VALIDATING
VALIDATED
FAILED
IMPORTING
COMPLETED
PARTIALLY_COMPLETED
CANCELLED
```

Production imports should preferably be atomic unless a deliberately designed staged-import mechanism is used.

---

# 68. Import Validation

Validation should check:

- Required columns.
- Data types.
- Valid institutes.
- Valid sports.
- Valid teams.
- Duplicate records.
- Invalid dates.
- Invalid contact information.
- Missing required values.

---

# 69. Audit Log

AuditLog is one of the most important system entities.

Conceptual fields:

```text
id
actor_user_id
session_id
action
resource_type
resource_id
timestamp
ip_address
previous_state
new_state
reason
metadata
```

---

# 70. Audit Actions

Examples:

```text
USER_CREATED
USER_UPDATED
ROLE_ASSIGNED
ROLE_REVOKED

MATCH_CREATED
MATCH_UPDATED
MATCH_SCORE_UPDATED

RESULT_SUBMITTED
RESULT_APPROVED
RESULT_OVERRIDDEN

TOURNAMENT_UPDATED
SCHEDULE_CHANGED

IMPORT_STARTED
IMPORT_COMPLETED

SESSION_REVOKED
```

---

# 71. Audit Immutability

Audit records should not be casually deleted or modified.

The application should not provide a normal UI operation such as:

```text
Delete Audit Log
```

Audit cleanup/retention policies should be explicitly defined.

---

# 72. Audit State Representation

For critical modifications, the audit system should preserve enough information to understand what changed.

Example:

```text
Previous:
2–1

New:
3–1
```

Full database snapshots should not automatically be stored for every operation if doing so would create unnecessary storage or privacy concerns.

---

# 73. System Setting

SystemSetting represents configurable platform-level values.

Potential examples:

```text
EVENT_STATUS
MAINTENANCE_MODE
DEFAULT_TIMEZONE
DEFAULT_SCORE_SETTINGS
PUBLIC_SITE_CONFIGURATION
```

Sensitive secrets must not be stored as ordinary system settings.

---

# 74. Configuration Philosophy

Configuration should be stored in the database only when it is appropriate for authorized runtime modification.

Deployment secrets remain environment-level configuration.

---

# 75. Relationships — Identity

```text id="x3i1j4"
User
 │
 ├──< UserRole >── Role
 │                  │
 │                  └──< RolePermission >── Permission
 │
 ├──< Session
 │
 ├──< Assignment
 │
 └──< AuditLog
```

---

# 76. Relationships — Event

```text id="2v8p0a"
Event
 │
 ├──< Sport
 ├──< Institute
 ├──< Venue
 ├──< Tournament
 ├──< Participant
 ├──< Team
 ├──< Sponsor
 ├──< News
 ├──< Announcement
 └──< Gallery
```

---

# 77. Relationships — Participation

```text id="y7d0k2"
Institute
    │
    └──< Team
            │
            └──< TeamMembership >── Participant
```

A Participant also belongs to an Institute.

---

# 78. Relationships — Competition

```text id="f5m1v8"
Sport
  │
  └──< Tournament
          │
          └──< Round
                  │
                  └──< Fixture
                          │
                          └── Match
                               ├──< MatchParticipant
                               ├──< ScoreEvent
                               └── Result
```

---

# 79. Relationships — Operations

```text id="j4r9w3"
Department
    │
    ├──< Task
    │      │
    │      └──< Assignment >── User
    │
    └── Users / Roles
```

---

# 80. Public Data Boundary

The database may contain significantly more information than the public website.

For example:

```text id="q0m8by"
Participant
├── Name                 PUBLIC*
├── Institute            PUBLIC*
├── Roll Number          INTERNAL
├── DOB                  INTERNAL
└── Contact Number       INTERNAL
```

`*` indicates subject to final public-data policy.

The API must explicitly construct public DTOs.

---

# 81. Foreign Keys

Foreign-key relationships should be used wherever referential integrity is required.

Examples:

```text id="c4b7yz"
match.tournament_id
→ tournament.id

team.institute_id
→ institute.id

participant.institute_id
→ institute.id
```

Orphaned competition records should not be possible under normal operations.

---

# 82. Unique Constraints

Likely unique constraints include:

```text
User.email

User.google_subject_id

Event.slug

Sport(event_id, slug)

Institute(event_id, name)

Team(event_id, institute_id, sport_id, name)

Session.id

ImportJob.id
```

Exact constraints will be finalized during Prisma schema design.

---

# 83. Nullability

Fields should be nullable only when the business domain genuinely permits missing information.

Do not make every field optional merely to simplify imports.

For example:

```text
User.email
```

should be required.

Where the event committee has not decided whether a participant's DOB is collected, that field may remain optional.

---

# 84. Soft Deletion

Critical competition data should generally not be hard-deleted.

Potential model:

```text
deleted_at
```

or an explicit status.

Examples:

```text
ACTIVE
ARCHIVED
DISABLED
```

Soft deletion strategy should be applied selectively rather than universally.

---

# 85. Cascading Deletes

Cascading deletes should be used carefully.

Automatic deletion of a complete competition tree is dangerous.

For example:

```text id="e9y6p2"
DELETE Sport
   ↓
DELETE Tournament
   ↓
DELETE Match
   ↓
DELETE Results
```

should not be possible through an accidental ordinary operation.

Critical competition records should generally be archived rather than cascaded away.

---

# 86. Transactions

Transactions are required for operations involving multiple dependent database changes.

Examples:

### Result Approval

```text
Update Result
+
Update Match State
+
Create Audit Log
```

### Score Update

```text
Validate
+
Create Score Event
+
Update Current Score
+
Audit
```

### Participant Import

```text
Validate
+
Insert / Update Participants
+
Record Import
```

---

# 87. Score Transaction Principle

A score update must never result in:

```text
Score changed
BUT
Audit missing
```

or:

```text
Audit created
BUT
Score not changed
```

Critical database operations should therefore be grouped transactionally wherever appropriate.

---

# 88. Derived Data

The system should distinguish between authoritative and derived information.

### Authoritative

- Participant records.
- Match records.
- Score events.
- Approved results.
- User roles.

### Derived

- Standings.
- Rankings.
- Medal tally.
- Match statistics.
- Institute totals.

Derived data should be recalculable from authoritative information wherever practical.

---

# 89. Materialized / Cached Data

If performance requires storing derived data, the system must retain a clear distinction between:

```text
SOURCE DATA
```

and:

```text
DERIVED DATA
```

Derived data should be refreshable.

---

# 90. Competition Recalculation

If an approved result changes through an authorized correction:

```text id="72r3jo"
Corrected Result
      ↓
Recalculate Standings
      ↓
Recalculate Ranking
      ↓
Update Public Views
```

The system should avoid requiring developers to manually repair every dependent page.

---

# 91. Time Handling

All timestamps should be stored consistently.

Recommended database strategy:

> Store timestamps in UTC.

The application should display them in the appropriate event timezone.

The event is expected to use:

```text
Asia/Kolkata
```

for public/event operations.

---

# 92. Date vs Timestamp

Use:

### Date

For:

- Event start date.
- Event end date.
- Participant date of birth.

### Timestamp

For:

- Match scheduled time.
- Score event time.
- Audit events.
- Sessions.
- News publication.

---

# 93. Indexing Strategy

Indexes should be created around actual query patterns.

Likely indexes include:

```text
User.email

Session.user_id
Session.expires_at
Session.revoked_at

Match.tournament_id
Match.venue_id
Match.scheduled_at
Match.status

Result.match_id
Result.status

Team.institute_id
Team.sport_id

Participant.institute_id

AuditLog.actor_user_id
AuditLog.resource_id
AuditLog.timestamp
```

Indexes should not be added indiscriminately.

---

# 94. Public Schedule Queries

The database should efficiently support:

```text
Today's matches
Upcoming matches
Matches by sport
Matches by venue
Live matches
Completed matches
```

Therefore match scheduling fields require appropriate indexing.

---

# 95. Audit Queries

Authorized administrators should be able to query:

```text
Actions by user
Actions on a match
Actions during a time period
Score modifications
Result overrides
Permission changes
Session revocations
```

Indexes should support these use cases.

---

# 96. Concurrency

The competition system may have multiple users interacting with the same match.

The database must therefore protect against conflicting updates.

Potential mechanisms:

- Transactions.
- Row-level locking where necessary.
- Version checks.
- Optimistic concurrency controls.

The exact strategy will be finalized during scoring implementation.

---

# 97. Score Concurrency

Example:

```text
Operator A
   │
   └── Score = 3–1

Operator B
   │
   └── Score = 4–1
```

The system must not silently lose one update.

The final implementation should define which scoring events are accepted and in what order.

---

# 98. Optimistic Concurrency

Where appropriate, records may include:

```text
version
updated_at
```

A client can submit:

```text
"I am modifying version 12."
```

The server can reject the update if the current record is already version 13.

This is particularly useful for administrative editing.

---

# 99. Public Read Performance

Public read-heavy data may be cached.

Potential candidates:

- Sports.
- Venues.
- Published rules.
- Sponsors.
- Published news.
- Published results.

Live scores should use real-time updates rather than relying solely on long-lived caching.

---

# 100. Database Connection Management

The application must use controlled database connection management.

The server should not create a new database connection for every request without pooling/management.

Prisma's connection management should be configured appropriately for the deployment environment.

---

# 101. Production Database Access

PostgreSQL should not be publicly exposed unnecessarily.

Preferred:

```text id="2a4b9y"
Internet
   X
   │
PostgreSQL

NestJS
   │
   ▼
PostgreSQL
```

Only the application/database infrastructure should have access according to network rules.

---

# 102. Database Credentials

Production credentials must:

- Never be committed to Git.
- Never appear in frontend environment variables.
- Never appear in client-side bundles.
- Be stored through secure server environment configuration.

---

# 103. Database Migrations

All schema changes should be version-controlled through Prisma migrations.

Workflow:

```text id="3f9qg7"
Modify Prisma Schema
        ↓
Generate Migration
        ↓
Review
        ↓
Test
        ↓
Apply
```

Manual production schema modification should be avoided.

---

# 104. Development Database

Developers should preferably use a separate development database.

Development data must not accidentally modify production data.

---

# 105. Test Database

Automated integration tests should use a controlled test database.

Tests should not run against production.

---

# 106. Seed Data

The repository may include development seed data for:

- Test users.
- Roles.
- Permissions.
- Sports.
- Institutes.
- Teams.
- Sample tournaments.
- Sample matches.

Production secrets and real participant information must never be included in seed files.

---

# 107. Privacy

The database may contain personal information.

Access must therefore follow least privilege.

Sensitive information should be:

- Restricted.
- Excluded from public DTOs.
- Protected in logs.
- Protected in backups.
- Deleted/retained according to the final institutional policy.

---

# 108. Contact Information

Participant contact numbers, if collected, should be treated as internal operational information.

They should not be included in public APIs by default.

---

# 109. Photographs

Participant photographs, if eventually collected, should be represented through media/file references rather than raw binary data inside PostgreSQL.

Whether photographs are publicly displayed remains TBD.

---

# 110. Database Backup

The production database requires automated backups.

The final strategy must define:

- Backup frequency.
- Retention.
- Storage location.
- Encryption.
- Restoration procedure.

---

# 111. Backup Integrity

A backup is not considered reliable merely because it was created successfully.

The team should periodically test restoration.

---

# 112. Data Recovery

If competition data is accidentally modified:

```text id="0f9q1d"
Audit History
      +
Backup
      +
Correction Workflow
```

should allow the team to identify and restore the correct state.

---

# 113. Import Safety

Participant imports should not directly overwrite existing data without validation.

Recommended:

```text id="n6g1fj"
Upload
 ↓
Validate
 ↓
Preview
 ↓
Confirm
 ↓
Transaction
```

---

# 114. Duplicate Detection

The import system should identify possible duplicates using appropriate fields.

Potential identifiers:

- Institutional roll number.
- Name + institute.
- Official registration identifier.

The final matching rules depend on the official registration spreadsheet.

---

# 115. Data Ownership

Each domain should have a clear owner.

Examples:

```text
Competition Data
→ Overall Sports / authorized sports roles

Participant Data
→ Authorized management/sports roles

Media
→ Media Team

Design Assets
→ Design Team

Sponsors
→ Sponsorship Team

Users/Roles
→ Convener / authorized administrators
```

This organizational ownership should be reflected in RBAC scopes.

---

# 116. Public Data Generation

Public pages should not directly query the database.

Preferred:

```text id="r6j4z0"
Database
   ↓
Service
   ↓
Public DTO
   ↓
API
   ↓
Next.js
```

This ensures internal fields do not accidentally leak.

---

# 117. Database Schema Rule

The database schema should represent the **domain**, not the UI.

For example, do not create:

```text
homepage_section_1
homepage_section_2
homepage_section_3
```

unless a genuine CMS requirement exists.

Instead create meaningful domain entities such as:

```text
Announcement
News
Sponsor
Sport
Venue
Match
```

---

# 118. Avoiding Over-Normalization

Not every piece of information requires a table.

A new table should be introduced when:

- It has independent identity.
- It has multiple relationships.
- It has its own lifecycle.
- It needs independent querying.
- It represents a meaningful domain concept.

Simple attributes should remain fields.

---

# 119. Avoiding Under-Normalization

Conversely, critical relational concepts should not be packed into arbitrary JSON fields.

For example, do not store the entire tournament structure as:

```text
tournament.configuration = {
   "everything": "inside one JSON blob"
}
```

Core entities such as:

- Rounds.
- Matches.
- Teams.
- Results.

should remain relational.

JSON may be used for genuinely sport-specific configuration where appropriate.

---

# 120. Sport-Specific Extensions

Some sports require data that does not apply universally.

The architecture should support:

```text id="7o8m2k"
Common Competition Model
          +
Sport-Specific Data
```

For example:

```text
Common:
Match
Result
Participant

Football-specific:
Goals
Cards

Basketball-specific:
Periods

Athletics-specific:
Performance
Attempt
Timing
Distance
```

The exact extension mechanism will be determined once the final sport list is confirmed.

---

# 121. Athletics

Athletics may differ substantially from team-based sports.

It may involve:

```text
Event
 ↓
Athlete
 ↓
Performance
```

rather than:

```text
Team A vs Team B
```

Therefore athletics should not be forced into an inappropriate two-team Match model.

The final athletics schema is TBD.

---

# 122. Chess

Chess may use:

- Individual participants.
- Swiss rounds.
- Round-robin structures.
- Board pairings.
- Individual results.

Therefore the tournament model must support individual competitors.

The exact schema depends on the final Chess format.

---

# 123. E-Sports / Other Sports

Potential future sports such as:

- E-Sports.
- Hockey.
- Squash.
- Pool.
- Weightlifting.

must not require major schema redesign if added.

However, the system should not implement unnecessary sport-specific complexity until those sports are confirmed.

---

# 124. Database Environment Strategy

At minimum:

```text id="z2x0b9"
Development DB
Testing DB
Production DB
```

Production data should never be casually copied into development.

---

# 125. Production Data Access

Only authorized application processes and administrators should have production database access.

Developers should preferably interact with production through:

- Application APIs.
- Controlled administrative tooling.
- Approved database access procedures.

---

# 126. Database Monitoring

Production monitoring should include:

- Connection health.
- Query failures.
- Database availability.
- Storage usage.
- Backup status.
- Slow queries where practical.

---

# 127. Slow Query Awareness

As the event progresses, frequently used queries should be monitored.

Examples:

```text
Live matches
Today's schedule
Results
Standings
Audit logs
```

Indexes should be adjusted based on observed query behavior.

---

# 128. Schema Evolution

Schema changes must account for existing event data.

For production migrations:

```text id="b3f4z6"
New Schema
   ↓
Backward-Compatible Migration
   ↓
Application Update
```

Destructive migrations should receive additional review.

---

# 129. Production Migration Rule

Never casually run:

```text
DROP TABLE
```

or equivalent destructive operations against production.

Any destructive migration must be deliberate, backed up and reviewed.

---

# 130. Database Documentation Rule

Whenever a developer introduces a new database entity, they should document:

- Why it exists.
- What it represents.
- Its owner/domain.
- Relationships.
- Important constraints.
- Whether it is authoritative or derived.

---

# 131. Authoritative Data Hierarchy

The competition system should follow:

```text id="y2n9sd"
Score Events / Official Input
             ↓
          Result
             ↓
      Standings / Ranking
             ↓
       Public Display
```

Public pages should never become the source of truth.

---

# 132. Data Consistency Principle

If the same fact is required in multiple places, it should preferably have one authoritative representation.

Bad:

```text
Homepage score
Schedule score
Results score
Leaderboard score
```

each stored independently.

Good:

```text
             Match Result
             /    |    \
            /     |     \
      Homepage Schedule Results
                    |
                 Standings
```

---

# 133. Critical Data

The following are considered high-integrity:

- Match scores.
- Score events.
- Official results.
- Tournament progression.
- Standings.
- Institute ranking.
- User roles.
- Permissions.
- Sessions.
- Audit records.

These require stronger controls than ordinary content.

---

# 134. Low-Risk Content

Examples:

- Draft news.
- Draft sponsor descriptions.
- Draft gallery descriptions.

These can use simpler workflows.

---

# 135. Database Security Invariants

The following must always hold:

1. Foreign keys must remain valid.
2. Protected resources require authorization.
3. UUIDs must not be treated as authorization.
4. Critical actions must be auditable.
5. Production secrets must not be stored in Git.
6. Public APIs must not expose private fields.
7. Published results must not be arbitrarily modified.
8. Sessions must be revocable.
9. Critical competition changes should be transactional.
10. Derived data must be recoverable from authoritative data where practical.

---

# 136. Initial Entity Inventory

The expected initial database entities are:

```text
Event

User
Role
Permission
UserRole
RolePermission
Session

Department
Task
Assignment

Institute
Participant
Team
TeamMembership

Sport
Tournament
TournamentParticipant
Round
Fixture
Match
MatchParticipant
ScoreEvent
Result
Standing
Bracket

Venue
Official
MatchOfficial

News
Announcement
Media
Gallery
GalleryMedia
Sponsor

ImportJob
AuditLog
SystemSetting
```

This is the **logical entity inventory**, not a promise that every item will become an independent physical table exactly as written.

---

# 137. Entities Requiring Further Design

The following require additional domain-specific decisions before final Prisma implementation:

- TournamentParticipant.
- MatchParticipant.
- Sport-specific scoring.
- Athletics performance model.
- Chess pairing/model.
- Bracket advancement.
- Standing calculation.
- Overall ranking calculation.
- Media storage.
- Official management.
- Hospitality-specific operational data.

---

# 138. Final Database Architecture

The database can be summarized as:

```text id="1v7j9c"
                         EVENT
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
    IDENTITY          PARTICIPATION        CONTENT
       │                   │                   │
 Users / Roles        Institutes          News
 Sessions             Teams              Media
 Permissions          Participants        Gallery
 Audit                Membership          Sponsors
       │                   │
       │                COMPETITION
       │                   │
       │              Sports / Tournaments
       │                      │
       │                    Rounds
       │                      │
       │                   Fixtures
       │                      │
       │                    Matches
       │                   /      \
       │             Score Events  Results
       │                            │
       │                     Standings/Ranking
       │
   OPERATIONS
       │
 Departments
 Tasks
 Assignments
 Hospitality
```

---

# 139. Design Objective

The database should make the following possible:

> **One authoritative piece of competition data can power the public website, organizer dashboards, live scoring, results, standings, rankings and operational tools without maintaining disconnected copies of the same information.**

---

# 140. Next Step

The next database-related artifact should be:

```text
schema.prisma
```

but it should **not** be written immediately.

Before implementing the Prisma schema, the following documents should be finalized:

```text
PRD.md
     ↓
ARCHITECTURE.md
     ↓
DATABASE.md
     ↓
RBAC.md
     ↓
API_SPEC.md
```

Then the Prisma schema can be generated from the combined decisions.

---

# 141. Database Status

**Status:** Approved logical baseline

**Confirmed:**

- PostgreSQL.
- Prisma.
- UUID identifiers.
- Event-based architecture.
- Database-backed sessions.
- RBAC entities.
- Competition entities.
- Audit logging.
- Participant import pipeline.
- Derived standings/ranking model.
- Transactional critical operations.
- Public/private data separation.

**TBD:**

- Final participant fields.
- Final sports.
- Tournament formats.
- Sport-specific scoring models.
- Athletics model.
- Chess model.
- Overall ranking formula.
- Final media storage.
- Official data model.
- Hospitality-specific tables.
- Exact retention policies.
- Exact indexing after query analysis.
- Final Prisma implementation details.

---

# 142. Relationship to Other Documents

```text
PRD.md
    │
    └── Product Requirements
            │
            ▼
ARCHITECTURE.md
    │
    └── System Architecture
            │
            ▼
DATABASE.md
    │
    └── Data Architecture
            │
            ├──────────────┐
            ▼              ▼
        RBAC.md       API_SPEC.md
            │              │
            └──────┬───────┘
                   ▼
             schema.prisma
```

`DATABASE.md` is therefore the authoritative **logical database design**, while `schema.prisma` will be the authoritative **implementation schema**.
