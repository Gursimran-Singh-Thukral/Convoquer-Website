# Convoquer'26 Digital Platform — System Architecture

**Project:** Convoquer'26 Digital Platform  
**Institute:** Indian Institute of Technology Jammu  
**Event:** Convoquer'26  
**Event Dates:** 1–4 October 2026  
**Architecture Version:** 1.0  
**Status:** Approved Baseline Architecture  
**Repository:** `convoquer26`

---

# 1. Purpose

This document defines the technical architecture of the Convoquer'26 Digital Platform.

The Product Requirements Document (`PRD.md`) defines **what the system must provide**.

This document defines **how the system is structured to provide it**.

The architecture is designed around the following requirements:

- Professional public-facing website.
- Centralized competition management.
- Live scoring.
- Direct result entry.
- Tournament and fixture management.
- Granular organizer permissions.
- IIT Jammu Google authentication.
- Secure server-side sessions.
- Strong object-level authorization.
- Auditability of critical operations.
- Mobile-first operational interfaces.
- Maintainability by a team of beginner developers.
- Deployment on an IIT Jammu-provided VM.
- Cloudflare protection.
- Automated code quality checks.
- Phased development with a September 2026 feature-freeze deadline.

---

# 2. Architectural Principles

## 2.1 The Client Is Untrusted

The browser must never be considered an authority.

The client may request:

```text
"Change this score."
"Open this match."
"Give me this user."
"I am a Sports Coordinator."
```

The server must independently verify every request.

```text
Client
  ↓
Authentication
  ↓
Session Validation
  ↓
Authorization
  ↓
Scope Validation
  ↓
Business Rules
  ↓
Database Operation
```

Hiding a button in the frontend is **not** a security mechanism.

---

## 2.2 Server Is the Source of Truth

All authoritative information must be maintained by the backend.

Examples:

- Match state
- Scores
- Results
- Standings
- User permissions
- Tournament configuration
- Official schedules

The frontend is a presentation and interaction layer.

---

## 2.3 Least Privilege

Users must receive only the permissions required for their responsibilities.

Authorization is determined through:

```text
User
  +
Roles
  +
Permissions
  +
Scope
  +
Assignments
```

---

## 2.4 Data Integrity Over Convenience

Competition data is considered high-integrity data.

A slightly inconvenient workflow is preferable to a workflow that permits accidental or unauthorized changes to official results.

---

## 2.5 Audit Critical Operations

Important actions must be attributable to an individual authenticated user.

The system should be capable of answering:

```text
Who?
What?
When?
Where?
On which resource?
What was the previous state?
What is the new state?
Why?
Through which session?
```

---

## 2.6 Prefer Simplicity

The system should not introduce unnecessary infrastructure.

The initial architecture should remain:

```text
One Repository
One Client Application
One Server Application
One Primary Database
One Deployment Environment
```

Additional infrastructure should only be introduced when a demonstrated requirement exists.

---

# 3. System Overview

The platform consists of two primary user experiences:

```text
                    CONVOQUER'26
                         │
            ┌────────────┴────────────┐
            │                         │
      PUBLIC EXPERIENCE         ORGANIZER EXPERIENCE
            │                         │
      Public Website             Role Dashboard
            │                         │
            └────────────┬────────────┘
                         │
                    Same Platform
                         │
                    Backend API
                         │
                     Database
```

Authenticated organizers can use the public website normally.

The Organizer Dashboard is an additional experience rather than a separate website.

---

# 4. High-Level Deployment Architecture

Production architecture:

```text
                         INTERNET
                            │
                            ▼
                       CLOUDFLARE
                 ┌──────────┼──────────┐
                 │          │          │
                DNS        TLS       WAF/
                                      DDoS/
                                      Bot Protection
                            │
                            ▼
                    IIT JAMMU VM
                            │
                 ┌──────────┴──────────┐
                 │                     │
              CLIENT                 SERVER
             Next.js                NestJS
                 │                     │
                 │               ┌─────┴─────┐
                 │               │           │
                 │             REST       WebSocket
                 │               │           │
                 │               └─────┬─────┘
                 │                     │
                 │                  Prisma
                 │                     │
                 │                 PostgreSQL
                 │
                 └──────── HTTPS/API ──┘
```

File/media storage may be hosted separately depending on final infrastructure availability.

---

# 5. Repository Architecture

The project will use a **single Git repository** with separate client and server applications.

```text
convoquer26/
│
├── client/
│
├── server/
│
├── docs/
│
├── .github/
│
├── .editorconfig
├── .gitignore
├── README.md
└── package.json
```

The initial project intentionally does not use a complex shared-package monorepo structure.

---

# 6. Client Application

## 6.1 Technology

The client will use:

- Next.js
- TypeScript
- Tailwind CSS

The client is responsible for:

- Public website
- Organizer dashboards
- Forms
- User interactions
- Data presentation
- Responsive layouts
- Live score display
- Live scoring interface
- Client-side validation where useful
- WebSocket connection management

The client is **not responsible for enforcing authorization**.

---

# 7. Proposed Client Structure

```text
client/
│
├── public/
│
├── src/
│   ├── app/
│   │
│   ├── components/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── sports/
│   │   ├── tournaments/
│   │   ├── matches/
│   │   ├── scoring/
│   │   ├── results/
│   │   ├── standings/
│   │   ├── teams/
│   │   ├── venues/
│   │   ├── media/
│   │   ├── sponsors/
│   │   ├── announcements/
│   │   └── organizer/
│   │
│   ├── layouts/
│   │
│   ├── hooks/
│   │
│   ├── services/
│   │
│   ├── lib/
│   │
│   ├── types/
│   │
│   └── styles/
│
├── .env.example
├── package.json
└── ...
```

This structure may be refined during implementation.

---

# 8. Server Application

## 8.1 Technology

The backend will use:

- Node.js
- TypeScript
- NestJS
- Prisma
- PostgreSQL

The backend contains all authoritative application logic.

---

# 9. Proposed Server Structure

```text
server/
│
├── src/
│   │
│   ├── modules/
│   │   │
│   │   ├── auth/
│   │   ├── users/
│   │   ├── rbac/
│   │   ├── organizations/
│   │   ├── sports/
│   │   ├── tournaments/
│   │   ├── teams/
│   │   ├── players/
│   │   ├── fixtures/
│   │   ├── matches/
│   │   ├── scoring/
│   │   ├── results/
│   │   ├── standings/
│   │   ├── venues/
│   │   ├── officials/
│   │   ├── assignments/
│   │   ├── tasks/
│   │   ├── hospitality/
│   │   ├── media/
│   │   ├── announcements/
│   │   ├── news/
│   │   ├── sponsors/
│   │   ├── imports/
│   │   └── audit/
│   │
│   ├── common/
│   ├── config/
│   ├── database/
│   └── main.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/
│
├── .env.example
├── package.json
└── ...
```

---

# 10. Backend Layering

The backend should not directly couple HTTP controllers to database queries.

The preferred request flow is:

```text
HTTP/WebSocket Request
        │
        ▼
Controller / Gateway
        │
        ▼
Authentication
        │
        ▼
Authorization
        │
        ▼
Validation
        │
        ▼
Service / Domain Logic
        │
        ▼
Repository / Prisma
        │
        ▼
PostgreSQL
```

For important operations:

```text
Service
   │
   ├── Business Validation
   ├── Database Transaction
   ├── Audit Log
   └── Realtime Event
```

---

# 11. Module Boundaries

The backend should be organized around business domains rather than generic technical categories.

For example:

```text
matches/
    controller
    service
    gateway
    dto
    domain logic
```

rather than:

```text
controllers/
services/
repositories/
```

with every domain mixed together.

This makes the system easier for developers to understand and maintain.

---

# 12. Public and Organizer APIs

The backend will conceptually expose two classes of functionality.

## Public

Examples:

```text
GET sports
GET tournaments
GET schedule
GET matches
GET live scores
GET results
GET standings
GET teams
GET venues
GET announcements
GET news
GET sponsors
```

## Protected

Examples:

```text
POST match
PATCH match
POST score event
POST result
PATCH result
POST tournament
PATCH tournament
POST assignment
PATCH assignment
POST announcement
POST media
```

Protected endpoints require authentication and appropriate authorization.

---

# 13. API Design Principles

APIs should:

- Use consistent naming.
- Return predictable response structures.
- Validate inputs.
- Never expose internal database structures unnecessarily.
- Never trust client-supplied authorization claims.
- Use UUIDs for persistent resource identifiers.
- Return appropriate HTTP status codes.
- Avoid leaking sensitive implementation details in errors.

API versioning strategy is TBD.

---

# 14. Authentication Architecture

Authentication uses:

> **Google OAuth**

The intended flow is:

```text
User
  │
  ▼
Google Login
  │
  ▼
Google Authentication
  │
  ▼
Verified Google Identity
  │
  ▼
Check Email Domain
  │
  ▼
Find/Create User
  │
  ▼
Check Application Authorization
  │
  ▼
Create Session
  │
  ▼
Set Secure Session Cookie
```

---

# 15. Institutional Email Restriction

Organizer authentication is restricted to IIT Jammu institutional accounts.

Expected account format:

```text
student_id@iitjammu.ac.in
```

The exact Google OAuth configuration and domain verification mechanism will be finalized during implementation.

The backend must verify the authenticated identity rather than trusting a client-provided email address.

---

# 16. Authentication vs Authorization

These are separate concepts.

### Authentication

> Who are you?

Handled through Google OAuth.

### Authorization

> What are you allowed to do?

Handled by the application's RBAC system.

An authenticated IIT Jammu account does not automatically become an organizer.

---

# 17. User Authorization

The backend determines whether a user is authorized through:

```text
User
 │
 ├── Roles
 │
 ├── Permissions
 │
 ├── Department
 │
 └── Assignments
```

Example:

```text
User
 └── Sports Coordinator
       └── Sport: Football
```

This does not authorize the user to modify Cricket.

---

# 18. Session Architecture

The platform will use **database-backed opaque sessions**.

The browser should receive a random session identifier through a secure cookie.

Conceptually:

```text
Browser
   │
   │ Secure HttpOnly Cookie
   ▼
NestJS
   │
   ▼
Session Store
   │
   ▼
PostgreSQL
```

The session identifier itself should not contain authorization information.

---

# 19. Why Opaque Sessions

The application should not rely on a long-lived self-contained JWT as the sole authority for organizer access.

A database-backed session provides:

- Immediate revocation.
- Centralized session visibility.
- Session auditing.
- Server-side expiration.
- Ability to terminate individual sessions.
- Better control over suspicious session activity.

---

# 20. Session Record

A session should conceptually contain:

```text
Session
├── id
├── user_id
├── token_hash
├── created_at
├── last_seen_at
├── expires_at
├── revoked_at
├── revocation_reason
├── ip_address
├── user_agent
├── device_metadata
└── last_rotation_at
```

The exact schema will be defined in `DATABASE.md`.

---

# 21. Session Security

Sessions should use:

- Secure cookies.
- HttpOnly cookies.
- Appropriate SameSite policy.
- Server-side expiry.
- Revocation.
- Rotation where appropriate.
- Secure random session identifiers.

The application must not expose session secrets through APIs.

---

# 22. Copied Session Credential Protection

The system should be designed so that obtaining a session credential alone does not bypass all security controls.

Additional signals may include:

- IP address.
- User agent.
- Session metadata.
- Session age.
- Activity anomalies.
- Explicit revocation.

However, IP address should be treated as a **security signal**, not an immutable identity.

Users can legitimately change networks.

The exact session-binding policy is TBD and must balance security with usability.

---

# 23. Logout

Logout should invalidate the active server-side session.

The browser cookie must also be cleared.

The invalidated session should no longer authorize requests.

---

# 24. RBAC Architecture

Authorization is implemented through:

```text
Role
  ↓
Permission
  ↓
Scope
  ↓
Resource
```

A user may possess multiple roles.

---

# 25. Permission Model

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

# 26. Permission Scope

Supported conceptual scopes:

```text
GLOBAL
DEPARTMENT
SPORT
ASSIGNED
OWN
PUBLIC
```

Example:

```text
Football Coordinator

Permission:
match.update

Scope:
SPORT = Football
```

A request against a Cricket match must therefore fail authorization.

---

# 27. Authorization Pipeline

Every protected request should follow:

```text
Request
  ↓
Session validation
  ↓
User lookup
  ↓
Permission evaluation
  ↓
Scope evaluation
  ↓
Resource lookup
  ↓
Resource-level authorization
  ↓
Business-rule validation
  ↓
Operation
```

---

# 28. Object-Level Authorization

The platform must prevent IDOR/BOLA-style vulnerabilities.

For example, knowing:

```text
/matches/<UUID>
```

does not grant permission to modify that match.

The backend must check:

```text
Does user have match.update?
       AND
Does user's scope include this match?
       AND
Is the requested state transition valid?
```

---

# 29. Multiple Roles

Users may have multiple roles.

Example:

```text
User
├── Sports Coordinator
└── Media Team
```

The effective permission set is determined by all applicable roles and scopes.

Explicit deny mechanisms may be introduced if required by the final authorization model.

---

# 30. Convener Authority

The Convener has global authority.

The Convener may perform critical overrides.

However:

> **No action is invisible merely because the user is the Convener.**

Critical actions remain auditable.

---

# 31. Co-Convener Authority

Co-Conveners have operational authority comparable to the Convener.

Each Co-Convener must have an independent account.

The system must never represent three Co-Conveners as a single shared account.

Every action must be attributable to the specific individual.

---

# 32. Assignments

Roles determine broad capabilities.

Assignments determine operational responsibility.

Example:

```text
User
 ├── Role: Volunteer
 ├── Department: Hospitality
 └── Assignment:
       Venue: Basketball Court
       Time: 09:00–13:00
       Task: Participant Assistance
```

Assignments are therefore an important authorization/context mechanism.

---

# 33. Competition Architecture

The competition engine is structured as:

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
Score Events
  ↓
Result
  ↓
Standings / Bracket
```

---

# 34. Event

The top-level event entity represents:

```text
Convoquer'26
```

The architecture should allow future editions without requiring a complete redesign.

Potential future model:

```text
Event
├── Convoquer'26
├── Convoquer'27
└── Convoquer'28
```

Multi-edition support beyond the foundational model is future scope.

---

# 35. Sport

A Sport represents a discipline such as:

- Football
- Cricket
- Basketball
- Volleyball
- Badminton
- Table Tennis
- Athletics
- Chess

Additional sports should be configurable.

---

# 36. Tournament

A tournament represents a competition structure within a sport.

Potential formats:

```text
KNOCKOUT
ROUND_ROBIN
LEAGUE
SWISS
GROUP_KNOCKOUT
```

The final set of formats is TBD.

---

# 37. Tournament Configuration

A tournament may contain:

- Format
- Participants
- Seeding
- Number of rounds
- Qualification rules
- Points system
- Tiebreakers
- Match rules

Tournament configuration must be validated server-side.

---

# 38. Seeding

The system should support seeded competitions.

The system may support constraints designed to prevent selected strong teams from meeting before a specified stage.

However:

> Seeding must be explicitly configured and traceable.

The system must not contain hidden or undocumented manipulation.

The final seeding rules are TBD.

---

# 39. Rounds

A tournament consists of rounds.

Examples:

```text
Group Stage
Quarter Final
Semi Final
Final
```

For Swiss systems:

```text
Round 1
Round 2
Round 3
...
```

---

# 40. Fixture

A fixture represents a scheduled competition encounter.

It contains or references:

- Match
- Round
- Participants
- Venue
- Date
- Time
- Officials
- Status

---

# 41. Match

A Match is one of the central entities of the platform.

Conceptually:

```text
Match
├── UUID
├── Sport
├── Tournament
├── Round
├── Venue
├── Scheduled Time
├── Participants
├── Officials
├── Status
├── Score
├── Score Events
├── Result
└── Audit History
```

---

# 42. Match State Machine

Proposed state machine:

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

Not every match must pass through every state in exactly the same way.

The server controls valid transitions.

---

# 43. State Transition Security

Example:

```text
Volunteer
   ✗ LIVE → COMPLETED

Score Operator
   ✓ LIVE → COMPLETED

Sports Coordinator
   ✓ RESULT_PENDING → APPROVED

Convener
   ✓ Critical override
```

The exact role-to-transition matrix will be defined in `RBAC.md`.

---

# 44. Live Scoring Architecture

Live scoring uses a real-time architecture.

```text
Score Operator
      │
      ▼
Next.js Scoring Interface
      │
      │ HTTPS
      ▼
NestJS API
      │
      ├── Authentication
      ├── Authorization
      ├── Validation
      ├── Match State Validation
      │
      ▼
Competition Service
      │
      ▼
PostgreSQL Transaction
      │
      ├───────────────► Audit Log
      │
      ▼
Realtime Gateway
      │
      ├── Public Clients
      ├── Organizer Clients
      └── Other Relevant Clients
```

---

# 45. Score Events

Where appropriate, scores should be represented as events rather than only storing the latest total.

Conceptually:

```text
Match
 │
 ├── Score Event 1
 ├── Score Event 2
 ├── Score Event 3
 └── ...
```

This can provide:

- Better auditability.
- Match history.
- Event reconstruction.
- More reliable statistics.

The exact event model varies by sport.

---

# 46. Sport-Specific Scoring

The competition engine must not assume that every sport has a simple:

```text
Team A = X
Team B = Y
```

structure.

Examples:

```text
Football
→ Goals / cards / match events

Basketball
→ Period scores

Volleyball
→ Set scores

Badminton
→ Game scores

Chess
→ Board / round result

Athletics
→ Individual performance
```

The architecture should support sport-specific scoring modules while retaining a common match/result abstraction.

---

# 47. Direct Result Entry

Some competitions may not require live scoring.

The platform therefore supports:

```text
Authorized User
      ↓
Enter Result
      ↓
Validate
      ↓
Submit
      ↓
Approval
      ↓
Publish
```

Direct result entry must use the same security and audit principles as live scoring.

---

# 48. Result Architecture

A Result represents the official outcome of a match/event.

Potential lifecycle:

```text
DRAFT
 ↓
SUBMITTED
 ↓
APPROVED
 ↓
PUBLISHED
```

Rejected/corrected states may be added.

---

# 49. Result Integrity

A result must not be directly modified through arbitrary client-side requests.

The backend must validate:

- User permission.
- Match state.
- Sport-specific result rules.
- Participant validity.
- Result completeness.
- Tournament rules.
- Previous result state.

---

# 50. Standings

Standings should be generated from authoritative competition data.

The system should avoid maintaining manually duplicated standings wherever possible.

Example:

```text
Approved Results
      ↓
Standings Calculation
      ↓
Current Standings
```

The exact calculation rules are sport-specific and TBD.

---

# 51. Overall Institute Ranking

The platform should support an overall ranking system.

Conceptually:

```text
Sport Results
      ↓
Sport Points / Medals
      ↓
Institute Total
      ↓
Overall Ranking
```

The official ranking formula remains TBD.

The architecture should make the calculation configurable.

---

# 52. Teams and Players

The platform separates:

```text
Institute
    ↓
Team
    ↓
Players / Participants
```

The exact player/team model will be defined in `DATABASE.md`.

---

# 53. Participant Import

Participant data will initially be supplied through an Excel file.

The import pipeline is:

```text
Excel File
    ↓
Upload
    ↓
Schema Validation
    ↓
Data Validation
    ↓
Duplicate Detection
    ↓
Preview
    ↓
Import Confirmation
    ↓
Database Transaction
    ↓
Import Audit Record
```

---

# 54. Import Safety

An invalid Excel file must not partially corrupt production data.

The import system should support transactional or staged imports.

Errors should be presented before final import.

Potential issues:

- Missing required fields.
- Invalid formats.
- Duplicate participants.
- Invalid institute.
- Invalid sport.
- Invalid team.
- Unknown values.

---

# 55. Hospitality Data Architecture

The competition system can provide operational information to Hospitality.

Conceptually:

```text
Participants
    +
Teams
    +
Schedules
    +
Matches
    +
Venues
        ↓
Operational Distribution
        ↓
Hospitality Dashboard
```

Potential outputs:

- Expected participants per institute.
- Expected participants per sport.
- Participants expected at venues.
- Match-based participant movement.
- Refreshment planning estimates.

These calculations are operational estimates, not authoritative attendance records unless explicitly defined.

---

# 56. Task and Assignment Architecture

Operational work is represented using:

```text
Task
  ↓
Assignment
  ↓
User
```

An assignment may include:

- User
- Department
- Venue
- Date
- Start time
- End time
- Task type
- Description
- Status

Proposed states:

```text
ASSIGNED
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
```

---

# 57. Public / Internal Data Boundary

The backend must distinguish between:

```text
PUBLIC
```

and:

```text
INTERNAL
```

data.

Examples of internal data:

- Audit logs.
- Sessions.
- Internal assignments.
- Sensitive participant information.
- Internal organizer communications.
- Private sponsorship information.

These must never be exposed through public API responses.

---

# 58. Media Architecture

Media consists of:

```text
Images
Videos
Documents
Logos
Posters
Gallery Albums
Livestream Metadata
```

Binary media should not be stored directly inside PostgreSQL.

The database should store metadata and references to the actual files.

Storage provider is TBD.

---

# 59. File Storage

Possible architecture:

```text
Application
   │
   ├── Metadata → PostgreSQL
   │
   └── File → Object/File Storage
```

Storage choice will depend on:

- VM storage capacity.
- Network bandwidth.
- Expected gallery size.
- Video requirements.
- Backup strategy.

---

# 60. Real-Time Architecture

WebSockets will be used for real-time functionality.

Potential events:

```text
match.score.updated
match.status.updated
match.result.updated
result.published
standings.updated
announcement.created
```

Event names are provisional.

---

# 61. Real-Time Security

WebSocket connections must be authenticated where required.

Authorization must apply to protected real-time channels.

The server must not broadcast internal data to public clients.

Public clients should receive only public events.

---

# 62. Real-Time Data Flow

Example:

```text
Score Operator
      │
      ▼
POST /match/{uuid}/score
      │
      ▼
Authorization
      │
      ▼
Score Validation
      │
      ▼
Database Transaction
      │
      ├── Audit Log
      │
      ▼
Realtime Event
      │
      ▼
WebSocket Clients
```

The WebSocket message itself must not be treated as the authoritative database update.

The database operation occurs first.

---

# 63. Offline / Poor Connectivity Strategy

The event may contain locations where connectivity is temporarily unreliable.

The scoring interface should therefore support temporary local state where practical.

Conceptually:

```text
Score Operator
      ↓
Local State
      ↓
Internet Available?
  ├── YES → Server
  └── NO  → Local Queue
                ↓
             Reconnect
                ↓
             Synchronize
```

The server remains authoritative.

Advanced distributed conflict resolution is not part of the initial release.

---

# 64. Database Architecture

PostgreSQL is the primary database.

The database will be relational because the domain contains strong relationships between:

- Users.
- Roles.
- Permissions.
- Institutes.
- Teams.
- Players.
- Sports.
- Tournaments.
- Matches.
- Results.
- Venues.
- Assignments.
- Audit records.

---

# 65. Prisma

Prisma will be used as the ORM/database access layer.

Responsibilities include:

- Schema representation.
- Database migrations.
- Type-safe queries.
- Relationships.
- Transactions.
- Development tooling.

Raw SQL may be used where genuinely necessary and should be documented.

---

# 66. Conceptual Database Domains

The database is conceptually divided into:

```text
IDENTITY
├── users
├── roles
├── permissions
├── user_roles
├── role_permissions
└── sessions

ORGANIZATION
├── departments
├── assignments
└── tasks

EVENT
├── events
├── sports
├── tournaments
├── rounds
├── venues
└── officials

COMPETITION
├── institutes
├── teams
├── players
├── fixtures
├── matches
├── score_events
├── results
├── standings
└── brackets

CONTENT
├── news
├── announcements
├── media
├── galleries
└── sponsors

SYSTEM
├── audit_logs
├── import_jobs
└── system_settings
```

This is a conceptual organization and not the final Prisma schema.

---

# 67. Database IDs

Persistent entities should use random UUID identifiers.

Avoid publicly exposed sequential IDs:

```text
/matches/1
/matches/2
/matches/3
```

Prefer:

```text
/matches/<random-uuid>
```

Human-readable identifiers may exist separately.

Example:

```text
Internal ID:
550e8400-e29b-41d4-a716-446655440000

Human Match Number:
FB-SF-02
```

---

# 68. UUID Security Principle

UUIDs provide non-predictable identifiers but are **not an authorization mechanism**.

The application must still perform:

```text
Authentication
+
Authorization
+
Scope Validation
+
Object-Level Authorization
```

for protected resources.

---

# 69. Database Constraints

Database-level constraints should be used wherever possible to protect data integrity.

Potential constraints include:

- Unique institutional email.
- Unique role names.
- Unique sport names within an event.
- Valid foreign keys.
- Required relationships.
- Valid state values.
- Unique session identifiers.
- Unique import identifiers.

Application validation and database constraints should complement one another.

---

# 70. Transactions

Critical multi-step operations should use database transactions.

Examples:

### Result publication

```text
Update result
+
Update match state
+
Create audit record
+
Trigger relevant update
```

### Participant import

```text
Validate
+
Insert/update participants
+
Insert import record
```

### Critical score update

```text
Validate
+
Update score state
+
Record event
+
Audit
```

A partial operation should not leave the database in an invalid intermediate state.

---

# 71. Audit Architecture

Audit logging is a first-class system component.

The audit system should capture important actions.

Example:

```text
AuditLog
├── id
├── actor_user_id
├── session_id
├── action
├── resource_type
├── resource_id
├── timestamp
├── previous_state
├── new_state
├── reason
├── ip_address
└── metadata
```

Exact schema will be defined separately.

---

# 72. Auditing Critical Competition Changes

Examples:

```text
MATCH_SCORE_UPDATED
RESULT_SUBMITTED
RESULT_APPROVED
RESULT_OVERRIDDEN
TEAM_DISQUALIFIED
TOURNAMENT_UPDATED
SCHEDULE_CHANGED
PERMISSION_GRANTED
ROLE_CHANGED
SESSION_REVOKED
```

Critical actions should never silently disappear from the audit trail.

---

# 73. Deletion Strategy

Critical competition information should generally not be hard-deleted.

Where practical:

```text
ACTIVE
  ↓
ARCHIVED
```

should be preferred.

Hard deletion should be restricted to data where deletion is genuinely appropriate.

---

# 74. Security Architecture

The complete request security pipeline is:

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
Object-Level Authorization
   ↓
Input Validation
   ↓
Business Rules
   ↓
Database Transaction
   ↓
Audit
```

---

# 75. Cloudflare

Cloudflare will sit in front of the production application.

Expected responsibilities:

- DNS.
- TLS/HTTPS.
- Edge protection.
- DDoS mitigation.
- Bot protection.
- WAF capabilities where configured.

Application-level security remains mandatory.

Cloudflare is not a replacement for:

- Authentication.
- Authorization.
- Database security.
- Input validation.
- Audit logging.

---

# 76. Rate Limiting

Application-level rate limiting is **not a current project requirement**.

The external Cloudflare layer will provide the primary traffic/bot-abuse protection.

However, individual endpoints may still implement protective controls where required for correctness or resource protection.

Such controls must not be introduced merely as a blanket rate-limiting system without a demonstrated requirement.

---

# 77. CSRF

CSRF protection must be considered because browser-based authenticated sessions are used.

The final mechanism depends on the exact cookie and API architecture.

Possible protections include:

- SameSite cookies.
- CSRF tokens where required.
- Origin checking.
- Proper CORS configuration.

The final implementation must be documented before production.

---

# 78. CORS

CORS should be explicitly configured.

The server should not use unrestricted:

```text
Access-Control-Allow-Origin: *
```

for authenticated APIs.

Only trusted origins should be allowed.

---

# 79. Secrets

Secrets must never be committed to Git.

Examples:

```text
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SESSION_SECRET
```

Production secrets must be supplied through secure environment configuration.

`.env.example` may contain placeholders but never actual secrets.

---

# 80. Error Handling

Production APIs should return useful but non-sensitive errors.

The application must not expose:

- Database stack traces.
- Secret values.
- Internal filesystem paths.
- SQL queries.
- Session tokens.
- Authentication provider secrets.

Development environments may use more detailed debugging.

---

# 81. Logging

Application logs should provide enough information to diagnose production issues.

Potential categories:

```text
INFO
WARN
ERROR
SECURITY
AUDIT
```

Sensitive information should not be unnecessarily logged.

Audit logs and application logs serve different purposes.

---

# 82. Audit Logs vs Application Logs

### Application Log

Used for:

> "The server encountered an error."

### Audit Log

Used for:

> "User X changed Match Y's score from A to B."

Audit logs are therefore business/security records and should be treated more carefully.

---

# 83. Frontend Authorization

The frontend may use permissions to determine:

- Which menu items to display.
- Which buttons to show.
- Which dashboard sections to render.

However:

> Frontend permission checks are only for user experience.

The backend must repeat the authorization decision.

---

# 84. API Response Security

API responses must use explicit DTOs/serializers.

The application should not blindly return entire database objects.

For example:

```text
User database object
      ↓
Public User DTO
```

Only explicitly permitted fields should be exposed.

This is especially important for:

- Participant information.
- Organizer information.
- Session information.
- Audit logs.
- Sponsor contacts.

---

# 85. Performance Architecture

The initial system is expected to have a moderate number of users.

Therefore the architecture should prioritize:

- Efficient database queries.
- Appropriate indexes.
- Caching of stable public content.
- Optimized media.
- Efficient real-time connections.
- Avoiding unnecessary polling.
- Pagination for large datasets.

A distributed microservice architecture is not required.

---

# 86. Caching

Caching may be used for relatively stable public information:

- Sports.
- Venues.
- Rules.
- Sponsors.
- Published news.

Highly dynamic competition data should have shorter cache lifetimes or bypass caching where appropriate.

Live scores should not rely on stale caches.

---

# 87. Database Indexing

Indexes should be introduced for frequently queried fields.

Likely examples:

```text
user.email
session.user_id
session.expires_at
match.sport_id
match.tournament_id
match.venue_id
match.scheduled_at
result.match_id
team.institute_id
audit_log.resource_id
```

The final index strategy will be derived from actual queries.

---

# 88. Pagination

Large collections should be paginated.

Potential examples:

- Audit logs.
- Participants.
- Teams.
- Media.
- News.
- Matches.

The API should not return an unbounded number of records.

---

# 89. Accessibility

The client should follow accessible web-development practices.

Requirements include:

- Semantic HTML.
- Keyboard accessibility.
- Accessible form labels.
- Adequate contrast.
- Meaningful focus states.
- Screen-reader-compatible controls.
- Reduced-motion consideration.

---

# 90. Responsive Design

The public platform must support:

- Desktop.
- Laptop.
- Tablet.
- Mobile.

The organizer platform should prioritize mobile operation for:

- Volunteers.
- Sports Coordinators.
- Score operators.
- Media staff.

The live-scoring interface should be optimized primarily for phones.

---

# 91. Testing Architecture

Testing should occur at multiple levels.

```text
Unit Tests
     ↓
Integration Tests
     ↓
API Tests
     ↓
End-to-End Tests
     ↓
Manual Acceptance Testing
```

---

# 92. Unit Testing

Unit tests should cover business logic such as:

- Tournament calculations.
- Standings.
- Score validation.
- State transitions.
- Permission evaluation.
- Ranking calculations.

---

# 93. Integration Testing

Integration tests should verify interactions between:

- NestJS.
- Prisma.
- PostgreSQL.
- Authentication.
- Competition services.
- Audit system.

---

# 94. End-to-End Testing

Playwright will be used for important user journeys.

Examples:

```text
Public visitor
 → Find sport
 → Open schedule
 → Open match
 → View result
```

Organizer:

```text
Google Login
 → Dashboard
 → Open assigned match
 → Update score
 → Submit result
```

Security:

```text
Unauthorized user
 → Attempt protected operation
 → Request rejected
```

---

# 95. CI Architecture

GitHub Actions will run automated checks.

Proposed pipeline:

```text
Pull Request
     │
     ├── Install dependencies
     ├── Format check
     ├── Lint
     ├── Type check
     ├── Unit tests
     ├── Integration tests
     └── Build
            │
            ▼
       Pass / Fail
```

The exact CI pipeline may be expanded later.

---

# 96. Formatting

Prettier will be used as the project's automated formatting standard.

Developers should not manually debate:

- Indentation.
- Spaces.
- Line breaks.
- Quote styles.
- Trailing commas.

The formatter establishes the standard.

---

# 97. EditorConfig

`.editorconfig` should define basic editor behavior such as:

- Character encoding.
- Line endings.
- Indentation.
- Final newline.
- Trailing whitespace.

This ensures consistency across editors.

---

# 98. ESLint

ESLint will enforce project-level JavaScript/TypeScript coding rules.

Rules should focus on:

- Correctness.
- Maintainability.
- Common bugs.
- Consistent patterns.

The configuration should avoid excessive rules that slow down beginner developers without providing meaningful value.

---

# 99. Git Workflow

The project uses GitHub for collaboration.

Recommended structure:

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

Direct pushes to protected branches should be restricted.

---

# 100. Pull Requests

A Pull Request should contain:

- What was changed.
- Why it was changed.
- Testing performed.
- Screenshots where UI changes are involved.
- Known limitations.

Automated checks must pass before merging.

---

# 101. Branch Protection

The main production branch should be protected.

Recommended requirements:

- Pull Request required.
- CI checks required.
- Review required.
- Direct push restricted.
- Force push restricted.

Exact GitHub configuration is an implementation task.

---

# 102. Deployment Architecture

Production deployment will initially target the IIT Jammu-provided VM.

Conceptually:

```text
Cloudflare
    ↓
VM
    │
    ├── Client
    ├── Server
    └── PostgreSQL
```

The final process manager/reverse-proxy arrangement is TBD.

---

# 103. Environment Separation

At minimum:

```text
Development
Testing
Production
```

should be logically separated.

Production credentials must never be used casually during local development.

---

# 104. Environment Variables

Both applications should have `.env.example` files documenting required configuration.

Examples:

```text
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SESSION_SECRET
PUBLIC_API_URL
```

Actual production values must remain outside Git.

---

# 105. Database Migrations

Database schema changes must use Prisma migrations.

Developers should not manually modify the production database schema without a controlled migration.

Migration workflow:

```text
Schema Change
    ↓
Prisma Migration
    ↓
Test
    ↓
Review
    ↓
Apply
```

---

# 106. Database Backups

Production PostgreSQL requires a backup strategy.

The final backup configuration must specify:

- Frequency.
- Retention.
- Storage location.
- Encryption.
- Restoration procedure.

A backup strategy must include restoration testing.

---

# 107. Disaster Recovery

Potential failure scenarios include:

- Application crash.
- Database corruption.
- VM failure.
- Accidental data modification.
- Credential compromise.
- Network failure.

The recovery strategy should prioritize restoration of:

1. Database.
2. Application.
3. Media.
4. Configuration.

---

# 108. Monitoring

Production should provide monitoring for:

- Application availability.
- Server health.
- Database health.
- Error rates.
- Authentication failures.
- Critical application failures.

The exact monitoring solution is TBD.

---

# 109. Security Incident Response

If suspicious activity is detected, authorized administrators should be able to:

```text
Identify User
     ↓
Inspect Sessions
     ↓
Revoke Sessions
     ↓
Inspect Audit Logs
     ↓
Determine Affected Resources
     ↓
Correct / Restore Data
```

Critical security events should be documented.

---

# 110. Data Flow — Public Match View

```text
Visitor
  │
  ▼
Next.js
  │
  ▼
GET Match
  │
  ▼
NestJS
  │
  ▼
Public Authorization
  │
  ▼
Competition Service
  │
  ▼
PostgreSQL
  │
  ▼
Public Match DTO
  │
  ▼
Next.js
```

---

# 111. Data Flow — Organizer Score Update

```text
Score Operator
       │
       ▼
Next.js
       │
       ▼
API Request
       │
       ▼
Session Validation
       │
       ▼
Permission Check
       │
       ▼
Match Scope Check
       │
       ▼
Score Validation
       │
       ▼
Match State Validation
       │
       ▼
Database Transaction
       │
       ├──────────────► Audit Log
       │
       ▼
Realtime Gateway
       │
       ▼
Connected Clients
```

---

# 112. Data Flow — Result Approval

```text
Result Submitted
       │
       ▼
RESULT_PENDING
       │
       ▼
Authorized Sports Authority
       │
       ▼
Validate Result
       │
       ▼
Approve
       │
       ├──────────────► Audit
       │
       ▼
APPROVED
       │
       ▼
Publish
       │
       ▼
PUBLIC RESULT
       │
       ▼
Standings / Ranking Update
```

---

# 113. Data Flow — Participant Import

```text
Excel
  ↓
Upload
  ↓
File Validation
  ↓
Schema Validation
  ↓
Data Validation
  ↓
Duplicate Detection
  ↓
Preview
  ↓
Authorized Confirmation
  ↓
Transaction
  ↓
Database
  ↓
Import Audit Log
```

---

# 114. Data Flow — Organizer Authentication

```text
Organizer
    ↓
Google Login
    ↓
Google
    ↓
Verified Identity
    ↓
Backend
    ↓
Institutional Domain Check
    ↓
Application User Lookup
    ↓
Role / Permission Lookup
    ↓
Create Session
    ↓
Secure Cookie
    ↓
Organizer Dashboard
```

---

# 115. Data Flow — Public Live Score

```text
Score Operator
      ↓
Score Update
      ↓
Backend Validation
      ↓
Database
      ↓
Realtime Event
      ↓
WebSocket
      ↓
Public Browser
      ↓
Updated Score
```

The public browser never directly modifies the score.

---

# 116. Data Flow — Hospitality

```text
Participant Data
      +
Teams
      +
Match Schedule
      +
Venues
      ↓
Competition Data
      ↓
Operational Calculation
      ↓
Hospitality Dashboard
      ↓
Expected Distribution
      ↓
Refreshment / Assignment Planning
```

---

# 117. Scalability

The expected event scale does not require a distributed microservice architecture.

The initial system should be a modular monolith.

```text
One Backend
 ├── Auth
 ├── RBAC
 ├── Competition
 ├── Media
 ├── Operations
 └── Audit
```

This provides clear module boundaries without introducing unnecessary deployment complexity.

---

# 118. Why Not Microservices

Microservices would introduce:

- More deployments.
- More networking.
- More infrastructure.
- More debugging complexity.
- More DevOps requirements.
- Greater learning burden for the development team.

The current event scale does not justify that complexity.

---

# 119. Modular Monolith

The preferred backend architecture is therefore:

> **Modular Monolith**

Each domain is logically separated but deployed as one application.

This allows the system to remain simple while preserving future architectural flexibility.

---

# 120. Future Scalability

If future editions grow substantially, individual modules can potentially be separated later.

For example:

```text
Current:

NestJS
 ├── Competition
 ├── Media
 └── Operations

Future:

Competition Service
Media Service
Operations Service
```

No such split should occur unless actual requirements justify it.

---

# 121. Architecture Decision Records

Major architectural decisions should be documented as ADRs.

Initial ADR list:

```text
ADR-001 — Next.js for Client
ADR-002 — NestJS for Server
ADR-003 — PostgreSQL
ADR-004 — Prisma
ADR-005 — Google OAuth
ADR-006 — Database-backed Sessions
ADR-007 — WebSockets
ADR-008 — Modular Monolith
ADR-009 — UUID Identifiers
ADR-010 — Cloudflare
ADR-011 — /client + /server Repository Structure
```

ADRs may be stored under:

```text
docs/adr/
```

---

# 122. Architecture Invariants

The following rules should be treated as architectural invariants.

## Security

1. The client is untrusted.
2. Authorization is server-side.
3. UUIDs are not authorization.
4. Protected resources require object-level authorization.
5. Sessions are server-controlled.
6. Critical operations are auditable.
7. Production secrets never enter Git.

## Competition

8. The database is authoritative.
9. Scores are validated server-side.
10. Results require controlled state transitions.
11. Public results originate from approved data.
12. Standings derive from authoritative competition data.

## Development

13. Formatting is automated.
14. CI must pass before merging.
15. Main branches are protected.
16. Database schema changes use migrations.
17. Architectural complexity must be justified.

---

# 123. Security Threat Model — Initial

The platform should explicitly consider:

### Threat: Stolen Session

Mitigations:

- Secure cookies.
- HttpOnly.
- Session expiry.
- Revocation.
- Session monitoring.
- Security signals.

### Threat: IDOR/BOLA

Mitigations:

- UUIDs.
- Object-level authorization.
- Scope checks.

### Threat: Unauthorized Score Change

Mitigations:

- Authentication.
- RBAC.
- Sport scope.
- Match state validation.
- Audit logging.

### Threat: Malicious Client

Mitigations:

- Server-side validation.
- Server-side authorization.
- DTOs.
- Database constraints.

### Threat: Bot Traffic

Mitigations:

- Cloudflare.
- WAF/bot protection where configured.
- Application safeguards for expensive operations.

### Threat: Database Exposure

Mitigations:

- Private database access.
- Credentials outside Git.
- Least-privilege database account.
- Network controls.

---

# 124. Security Is Not Absolute

The system should aim for professional security and a minimized attack surface.

However:

> No software system can honestly guarantee that it is impossible to hack.

The engineering objective is to ensure that:

- A leaked identifier does not grant access.
- A malicious client cannot bypass backend authorization.
- A stolen session can be revoked.
- Critical actions are traceable.
- Data corruption is minimized.
- Unauthorized changes are detectable.
- Recovery is possible.

---

# 125. Development Constraints

The architecture must account for:

- Approximately 6–7 beginner developers.
- Project lead with primary architectural responsibility.
- Limited development time.
- Mid-semester examinations from 18–23 September.
- Feature freeze target of 10–12 September.
- Production deployment before Convoquer'26.
- Mobile-heavy operational usage.

Therefore, architecture should favor:

```text
Clarity
+
Maintainability
+
Security
+
Practicality
```

over unnecessary technical sophistication.

---

# 126. Architecture and Team Learning

The project is also a learning environment.

Developers should understand the system in layers:

```text
HTML / React / Next.js
        ↓
API
        ↓
NestJS
        ↓
Database
        ↓
Authentication
        ↓
Authorization
        ↓
Deployment
```

Documentation should accompany implementation.

---

# 127. Documentation Structure

The repository should eventually contain:

```text
docs/
│
├── PRD.md
├── ARCHITECTURE.md
├── DATABASE.md
├── API_SPEC.md
├── RBAC.md
├── DEVELOPMENT_ROADMAP.md
├── CONTRIBUTING.md
├── DEPLOYMENT.md
├── SECURITY.md
│
└── adr/
    ├── ADR-001.md
    ├── ADR-002.md
    └── ...
```

Not all documents need to be written immediately.

---

# 128. Implementation Order

The architecture should be implemented in approximately this order:

```text
1. Repository
       ↓
2. Client foundation
       ↓
3. Server foundation
       ↓
4. Database foundation
       ↓
5. Authentication
       ↓
6. Sessions
       ↓
7. RBAC
       ↓
8. Core competition entities
       ↓
9. Match engine
       ↓
10. Results / standings
       ↓
11. Real-time scoring
       ↓
12. Organizer dashboards
       ↓
13. Media / operations
       ↓
14. Security hardening
       ↓
15. Testing
       ↓
16. Deployment
```

---

# 129. Architecture Completion Criteria

The architecture is considered implemented when:

- Client and server are independently structured.
- Public website communicates with the backend.
- Authentication works through Google.
- Server-side sessions work.
- RBAC is enforced server-side.
- Object-level authorization works.
- Competition data is stored relationally.
- Match state transitions are validated.
- Live scoring updates are persisted and broadcast.
- Results are auditable.
- Critical actions are logged.
- Participant imports are validated.
- CI passes.
- Production deployment is reproducible.
- Backups exist.
- Security checks have been performed.

---

# 130. Final Architecture

The resulting platform can be summarized as:

```text
                         INTERNET
                            │
                            ▼
                       CLOUDFLARE
                            │
                            ▼
                    IIT JAMMU VM
                            │
              ┌─────────────┴─────────────┐
              │                           │
           /client                     /server
              │                           │
           Next.js                     NestJS
              │                           │
              │                ┌──────────┼──────────┐
              │                │          │          │
              │              Auth       RBAC     Competition
              │                │          │          │
              │                └──────────┼──────────┘
              │                           │
              │                       Services
              │                           │
              │                    ┌──────┴──────┐
              │                    │             │
              │                  REST        WebSocket
              │                    │             │
              │                    └──────┬──────┘
              │                           │
              │                        Prisma
              │                           │
              │                       PostgreSQL
              │                           │
              │                    ┌──────┼──────┐
              │                    │      │      │
              │                 Sessions Audit Competition
              │
              └──────────── HTTPS / API ────────────┘
```

---

# 131. Architectural Statement

The Convoquer'26 Digital Platform will be implemented as a **secure modular monolith** consisting of a Next.js client and NestJS server backed by PostgreSQL through Prisma.

The platform will use Google OAuth for institutional authentication, database-backed opaque sessions for server-controlled authentication state, granular RBAC with scope and assignment restrictions, UUID-based persistent identifiers, WebSockets for real-time competition updates, Cloudflare as the external traffic-protection layer, and comprehensive auditing for critical operations.

The architecture deliberately prioritizes:

> **Security → Data Integrity → Maintainability → Developer Experience → Performance → Future Extensibility**

The system should remain simple enough for the current development team to understand and maintain while being sufficiently robust to serve as the official digital infrastructure for Convoquer'26.

---

# 132. Status of Unresolved Architectural Decisions

The following remain intentionally open:

- Exact Next.js version.
- Exact NestJS version.
- Exact PostgreSQL version.
- Exact Prisma version.
- WebSocket implementation details.
- Exact Google OAuth configuration.
- Session-binding/anomaly policy.
- File-storage provider.
- Production reverse proxy.
- Process manager/container strategy.
- Monitoring solution.
- Backup implementation.
- Exact API versioning.
- Exact sport-specific score schemas.
- Exact tournament algorithms.
- Exact ranking formulas.

These should be resolved through implementation-specific decisions and ADRs rather than silently assumed.

---

# 133. Relationship to Other Documents

This document should be read together with:

```text
PRD.md
    ↓
What the system must do

ARCHITECTURE.md
    ↓
How the system is structured

DATABASE.md
    ↓
How information is stored

API_SPEC.md
    ↓
How client and server communicate

RBAC.md
    ↓
Who can do what

DEVELOPMENT_ROADMAP.md
    ↓
How the team will build it

CONTRIBUTING.md
    ↓
How developers work on the repository

SECURITY.md
    ↓
Detailed security requirements
```

These documents collectively form the technical source of truth for the Convoquer'26 Digital Platform.
