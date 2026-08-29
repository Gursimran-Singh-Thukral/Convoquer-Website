# Convoquer'26 Digital Platform — Implementation Plan

**Project:** Convoquer'26 Digital Platform  
**Institute:** Indian Institute of Technology Jammu  
**Event:** Convoquer'26  
**Event Dates:** 1–4 October 2026  
**Development Team:** 6–7 Developers + Project Lead  
**Development Model:** Phased Development  
**Repository:** GitHub  
**Frontend:** Next.js + TypeScript  
**Backend:** NestJS + TypeScript  
**Database:** PostgreSQL + Prisma  
**Deployment:** VM + Cloudflare  
**Target Feature Completion:** 10–12 September 2026  
**Target Testing/Handoff:** Around 20 September 2026  
**Document Version:** 1.0  
**Status:** Approved Implementation Baseline

---

# 1. Purpose

This document converts the project's requirements and architecture into an executable development plan.

It defines:

```text
What to build
When to build it
What depends on what
Who should work on it
What must be completed first
What can be postponed
What constitutes completion
```

The project will be developed incrementally rather than attempting to build the entire platform simultaneously.

---

# 2. Primary Objective

The primary objective is to deliver a professional, secure and operational digital platform for Convoquer'26 capable of supporting:

```text
Public Event Website
+
Participant/Team Information
+
Sports & Fixtures
+
Live Scores
+
Results
+
Standings
+
Organizer Platform
+
Role-Based Access Control
+
Secure Authentication
+
Realtime Updates
```

---

# 3. Development Constraints

The implementation plan must account for:

### Team

```text
6–7 developers
+
Project Lead
```

Most developers are first-time web developers.

### Academic Constraint

The project lead has mid-semester examinations around:

```text
18–23 September
```

Therefore, the project must reach a stable state before this period.

### Target

Internal feature completion should be targeted for:

```text
10–12 September
```

with broader testing/handoff around:

```text
20 September
```

---

# 4. Development Philosophy

The project follows:

> **Build the minimum complete system first, then expand it.**

The team must avoid spending excessive time polishing secondary features while critical competition functionality remains incomplete.

Priority:

```text
Security
 ↓
Core Data
 ↓
Competition Logic
 ↓
Live Scoring
 ↓
Public Website
 ↓
Organizer Platform
 ↓
Testing
 ↓
Polish
```

---

# 5. Priority Levels

Every feature will have a priority.

## P0 — Critical

Must exist before production.

```text
Authentication
Sessions
Users
RBAC
Database
Sports
Teams
Participants
Fixtures
Matches
Live Scores
Results
Standings
Audit Logs
Organizer Platform
Public Competition Information
```

---

## P1 — Important

Should be completed if the schedule permits.

```text
Player Statistics
Team Statistics
Institute Ranking
Medal Tally
Notifications
News/Updates
Gallery
Advanced Organizer Features
```

---

## P2 — Optional

Can be postponed without affecting the core competition.

```text
Advanced Analytics
Advanced Visualizations
Additional Convenience Features
Nonessential Integrations
Experimental Features
```

---

# 6. Critical Path

The main dependency chain is:

```text
Project Setup
      ↓
Database
      ↓
Authentication
      ↓
Users
      ↓
RBAC
      ↓
Sports
      ↓
Teams
      ↓
Participants
      ↓
Fixtures
      ↓
Matches
      ↓
Live Scores
      ↓
Results
      ↓
Standings
      ↓
Organizer Platform
      ↓
Public Realtime Integration
      ↓
Testing
      ↓
Deployment
```

This dependency chain should guide development order.

---

# 7. Parallel Development

Not everything needs to be sequential.

After the foundation is ready:

```text
                    Foundation
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     Public UI      Competition    Organizer UI
          │             │             │
          │             ▼             │
          │         Live Scores       │
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                   Integration
                        ↓
                     Testing
```

---

# 8. Phase Overview

```text
Phase 0   — Project Setup
Phase 1   — Learning & Onboarding
Phase 2   — Database Foundation
Phase 3   — Authentication & Sessions
Phase 4   — RBAC & Authorization
Phase 5   — Core Competition Data
Phase 6   — Teams & Participants
Phase 7   — Fixtures & Scheduling
Phase 8   — Public Website Foundation
Phase 9   — Live Scoring
Phase 10  — Results & Standings
Phase 11  — Organizer Platform
Phase 12  — Realtime Integration
Phase 13  — Secondary Features
Phase 14  — Security Hardening
Phase 15  — Testing
Phase 16  — Deployment
Phase 17  — Final Event Preparation
```

---

# 9. Phase 0 — Project Setup

## Objective

Create the repository and development environment.

---

## Tasks

```text
Create GitHub repository
Create /client
Create /server
Create /docs
Configure .gitignore
Configure EditorConfig
Configure Prettier
Configure ESLint
Configure TypeScript
Configure Git hooks
Configure GitHub Actions
Create README.md
```

---

## Repository Structure

Target:

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
├── package.json
└── README.md
```

---

## Definition of Done

```text
[ ] Repository exists
[ ] Team has repository access
[ ] Client runs
[ ] Server runs
[ ] Database connection works locally
[ ] Formatting works
[ ] ESLint works
[ ] TypeScript works
[ ] GitHub Actions runs
[ ] Basic README exists
```

---

# 10. Phase 1 — Learning & Onboarding

Because most developers are beginners, learning happens alongside development.

Developers should not attempt to learn the entire stack before contributing.

---

## Learning Sequence

```text
Git/GitHub
 ↓
JavaScript Fundamentals
 ↓
TypeScript
 ↓
React
 ↓
Next.js
 ↓
Node.js
 ↓
NestJS
 ↓
REST APIs
 ↓
PostgreSQL
 ↓
Prisma
 ↓
Authentication
 ↓
Testing
```

---

## Learning Principle

Each developer should learn the minimum required for their current task.

Example:

```text
Frontend Developer
→ Learn React/Next.js first

Backend Developer
→ Learn TypeScript/NestJS first

Database Developer
→ Learn PostgreSQL/Prisma first
```

---

# 11. Phase 2 — Database Foundation

## Objective

Implement the database described in `DATABASE.md`.

---

## Core Entities

Expected initial entities include:

```text
User
Session
Role
Permission
Sport
Team
Participant
Match
ScoreEvent
Result
AuditLog
Venue
```

Additional entities will be added as required.

---

## Tasks

```text
Configure PostgreSQL
Configure Prisma
Create schema
Create migrations
Create seed system
Create development data
Create database utility layer
```

---

## Definition of Done

```text
[ ] Database starts
[ ] Prisma connects
[ ] Migrations work
[ ] Seed works
[ ] Relationships work
[ ] Constraints work
[ ] Basic queries work
```

---

# 12. Phase 3 — Authentication & Sessions

## Objective

Create secure authentication for organizer users.

---

## Authentication

Primary authentication mechanism:

```text
Google Login
```

Approved organizer identity:

```text
@iitjammu.ac.in
```

subject to final institute confirmation.

---

## Tasks

```text
Google OAuth
User creation
User lookup
Session creation
Session validation
Logout
Session revocation
Session expiry
```

---

## Session Security

Implement server-side session management.

Session records should support appropriate contextual information such as:

```text
Session ID
User ID
IP Address
User Agent
Created At
Expires At
Revoked At
```

The final session-binding behavior follows `SECURITY.md`.

---

## Definition of Done

```text
[ ] Google login works
[ ] Unauthorized identity rejected
[ ] User created correctly
[ ] Session created
[ ] Session validated
[ ] Logout works
[ ] Revoked session rejected
[ ] Expired session rejected
```

---

# 13. Phase 4 — RBAC & Authorization

## Objective

Implement the project's permission system.

---

## Role Structure

Expected organizational hierarchy:

```text
Convener
    ↓
Co-Conveners
    ↓
Team Heads
    ↓
Sports Coordinators
    ↓
Volunteers
```

Additional functional roles include:

```text
Organizers
Media
Design
Web
Management
```

A user may have multiple roles.

---

## Tasks

```text
Role model
Permission model
Role-permission mapping
User-role mapping
Authorization guards
Resource-level authorization
Sport-level authorization
Audit integration
```

---

## Critical Requirement

Authorization must be enforced by the backend.

Frontend hiding a button is not sufficient.

---

## Definition of Done

```text
[ ] Roles work
[ ] Permissions work
[ ] Multiple roles work
[ ] Sport scope works
[ ] Unauthorized operations rejected
[ ] Authorization tests pass
```

---

# 14. Phase 5 — Core Competition Data

## Objective

Create the competition data model.

---

## Sports

Initial confirmed/expected sports:

```text
Cricket
Football
Basketball
Volleyball
Badminton
Table Tennis
Athletics
Chess
```

Potential additional sports:

```text
E-Sports
Hockey
Squash
Pool
Weightlifting
```

Only confirmed sports should be made production-critical.

---

## Tasks

```text
Sport management
Venue management
Team management
Participant management
Competition categories
Gender/category configuration where required
```

---

# 15. Phase 6 — Teams & Participants

## Objective

Import and manage participating teams and athletes.

---

## Registration Source

Registration data will primarily originate from an Excel file.

Workflow:

```text
Excel
 ↓
Validation
 ↓
Preview/Processing
 ↓
Database
```

---

## Participant Data

Potential fields include:

```text
Name
Photograph
College
Roll Number
Gender
Date of Birth
Contact Number
```

Final fields remain subject to confirmation.

---

## Tasks

```text
Excel parser
Validation
Duplicate detection
Import
Participant records
Team records
Institute association
```

---

## Definition of Done

```text
[ ] Excel can be processed
[ ] Invalid rows identified
[ ] Duplicate participants handled
[ ] Teams created
[ ] Participants associated with teams
[ ] Imported data visible
```

---

# 16. Phase 7 — Fixtures & Scheduling

## Objective

Create the competition schedule.

---

## Required Features

```text
Fixtures
Match Schedule
Venues
Match Times
Teams
Knockout Brackets
```

---

## Competition Formats

Different sports may use different formats.

Potential formats:

```text
League
Round Robin
Knockout
Swiss
Group + Knockout
```

Chess may use Swiss or Round Robin depending on final decision.

---

## Tasks

```text
Competition format model
Fixture creation
Schedule management
Venue assignment
Team assignment
Bracket generation
Schedule display
```

---

## Definition of Done

```text
[ ] Matches can be created
[ ] Teams can be assigned
[ ] Venue can be assigned
[ ] Time can be assigned
[ ] Fixtures displayed publicly
[ ] Organizer can manage fixtures
```

---

# 17. Phase 8 — Public Website Foundation

## Objective

Build the public-facing Convoquer'26 website.

---

## Public Pages

Initial target:

```text
Home
About Convoquer
Sports
Schedule
Results
Teams
Leaderboard
Registration
Rules & Regulations
Venues
Sponsors
Gallery
News/Updates
Contact
FAQ
```

---

## Public Navigation

The website should prioritize:

```text
Home
Sports
Schedule
Live Scores
Results
Leaderboard
Teams
```

during the event.

---

## Visual Direction

The design should be:

```text
Professional
Modern
Sports-focused
Fast
Mobile-first
Consistent with IIT Jammu branding
```

The official IIT Jammu website should be used as a branding reference.

---

# 18. Phase 9 — Live Scoring

## Objective

Implement realtime score updates.

This is one of the highest-priority features.

---

## Supported Operations

Depending on sport:

```text
Start Match
Update Score
Add Score Event
Correct Score
Pause Match
Resume Match
End Match
```

Exact sport-specific operations will depend on the final competition rules.

---

## Score Architecture

```text
Score Operator
      ↓
Frontend
      ↓
NestJS
      ↓
Authorization
      ↓
Validation
      ↓
Database
      ↓
Audit Log
      ↓
Realtime Event
      ↓
Public Clients
```

---

## Critical Security Requirement

A score update must never depend solely on the frontend.

Every update must be:

```text
Authenticated
Authorized
Validated
Persisted
Audited
```

---

## Definition of Done

```text
[ ] Authorized user can update score
[ ] Unauthorized user cannot
[ ] Score is persisted
[ ] Score update is audited
[ ] Public display updates
[ ] Multiple clients receive update
[ ] Reconnection works
```

---

# 19. Phase 10 — Results & Standings

## Objective

Convert completed matches into official results.

---

## Result Workflow

```text
Match
 ↓
Complete
 ↓
Result Generated
 ↓
Authorized Review
 ↓
Approval
 ↓
Publish
 ↓
Standings Update
```

---

## Required Features

```text
Results
Point Table
Knockout Brackets
Medal Tally
Overall Institute Ranking
```

---

## Optional

```text
Player Statistics
Team Statistics
Advanced Analytics
```

---

## Definition of Done

```text
[ ] Match can be completed
[ ] Result generated
[ ] Result can be reviewed
[ ] Authorized result approval works
[ ] Published result appears publicly
[ ] Standings update correctly
[ ] Audit record created
```

---

# 20. Phase 11 — Organizer Platform

## Objective

Create role-specific dashboards.

The organizer platform must follow:

> **Each user should see sufficient information and permissions — neither more nor less than necessary.**

---

# 21. Organizer Dashboard Architecture

```text
Authenticated User
        ↓
Role Detection
        ↓
Permission Resolution
        ↓
Dashboard
        ↓
Scoped Data
```

---

# 22. Convener Dashboard

The Convener has the broadest authority.

Potential capabilities:

```text
View Entire Competition
Manage Competition
Manage Users
Manage Roles
Manage Sports
Manage Teams
Manage Fixtures
Manage Results
Manage Scores
View Audit Logs
Override Authorized Operations
```

All sensitive operations remain traceable.

---

# 23. Co-Convener Dashboard

Co-Conveners have broad operational authority.

Potential capabilities:

```text
Competition Management
Operational Oversight
Sports Oversight
Result Oversight
Score Oversight
Team Oversight
```

Actions should remain auditable.

---

# 24. Hospitality & Security Head

Potential capabilities:

```text
Institute Participation Overview
Participant Count
Team Location
Match Location
Match Schedule
Refreshment Planning
Volunteer Assignment
Operational Attendance Information
```

Example:

```text
Basketball Team
 ↓
Basketball Match
 ↓
Basketball Venue
```

This information can help hospitality teams plan refreshments and movement.

---

# 25. Management Head

Potential capabilities may include:

```text
Administrative Information
Operational Monitoring
Team/Volunteer Information
Competition Status
```

Final permissions remain TBD.

---

# 26. Media Head

Potential capabilities:

```text
Match Information
Live Match Status
Results
Teams
Player Information
Media Assignments
Livestream Information
Gallery Management
```

---

# 27. Design Head

Potential capabilities:

```text
Content Assets
Event Branding
Gallery Assets
Design-related Content
```

Final permissions remain TBD.

---

# 28. Sponsorship Head

Potential capabilities:

```text
Sponsors
Sponsor Information
Sponsor Assets
Sponsor Placement
```

Final permissions remain TBD.

---

# 29. Overall Sports Coordinator

Potential capabilities:

```text
All Sports
Fixtures
Matches
Scores
Results
Sport Coordinators
Competition Status
```

---

# 30. Sports Coordinator

Sports Coordinators are permanently assigned to their respective sport.

They should primarily access:

```text
Their Sport
Their Matches
Their Teams
Their Fixtures
Their Scores
Their Results
```

They should not automatically receive access to other sports.

---

# 31. Volunteer

Volunteer capabilities should depend on assignment.

Potential access:

```text
Assigned Tasks
Assigned Venue
Assigned Match
Relevant Schedule
Operational Instructions
```

Volunteers should not receive unnecessary competition administration privileges.

---

# 32. Web Team

The Web Team should have technical access required for maintaining the website.

This should not automatically grant unrestricted competition-data privileges.

---

# 33. Management

Management-related access should follow the final organizational requirements.

Permissions remain subject to confirmation.

---

# 34. Public View for Organizers

Authenticated organizers should still be able to access the public website.

The organizer interface should contain a clear:

```text
View Public Website
```

or equivalent navigation option.

This prevents the organizer platform from becoming a separate isolated website.

---

# 35. Phase 12 — Realtime Integration

## Objective

Connect backend realtime events to public and organizer interfaces.

---

## Realtime Events

Potential events:

```text
SCORE_UPDATED
MATCH_STARTED
MATCH_PAUSED
MATCH_COMPLETED
RESULT_PUBLISHED
STANDINGS_UPDATED
```

---

## Architecture

```text
Database
 ↓
Backend Event
 ↓
WebSocket
 ↓
Connected Clients
```

---

## Requirements

```text
[ ] Authentication handled
[ ] Authorization handled
[ ] Connection works
[ ] Reconnection works
[ ] Duplicate events handled
[ ] State remains consistent
```

---

# 36. Phase 13 — Secondary Features

Only begin these after P0 functionality is stable.

---

## Player Statistics

Potential:

```text
Appearances
Points
Goals
Wickets
Runs
Wins
Other sport-specific statistics
```

---

## Team Statistics

Potential:

```text
Matches
Wins
Losses
Draws
Points
Goals
Other sport-specific statistics
```

---

## Institute Ranking

Aggregate performance across sports.

Exact calculation must be confirmed before implementation.

---

## Medal Tally

Display:

```text
Gold
Silver
Bronze
Total
```

Exact medal rules depend on event structure.

---

## News

Organizers should be able to publish:

```text
Announcements
Match Updates
Event Updates
```

---

## Gallery

Media/Design teams should be able to manage event media.

---

# 37. Phase 14 — Security Hardening

Security should not be postponed until the very end.

However, after the major functionality exists, conduct a dedicated security pass.

---

## Authentication

Test:

```text
Google OAuth
Allowed Domain
Invalid Account
Session Expiry
Logout
Session Revocation
```

---

## Authorization

Test:

```text
Role
Permission
Resource
Sport Scope
Multiple Roles
```

---

## Session Security

Test:

```text
Session Theft
Session Reuse
IP Context
User-Agent Context
Revocation
Expiration
```

The final behavior must follow `SECURITY.md`.

---

## Score Security

Test:

```text
Unauthorized Score Update
Unauthorized Result Update
Wrong Sport
Wrong Match
Completed Match
Duplicate Event
Concurrent Update
```

---

## Database Security

Verify:

```text
Database Not Publicly Accessible
Credentials Not Exposed
Migrations Controlled
Backups Protected
```

---

# 38. Phase 15 — Testing

Testing follows `TESTING.md`.

---

## Unit Tests

Focus on:

```text
Business Rules
Score Calculation
Standings
Permissions
Validation
Tournament Logic
```

---

## Integration Tests

Focus on:

```text
Authentication
Database
RBAC
Scores
Results
Imports
Audit
```

---

## E2E Tests

Critical flows:

```text
Login
 ↓
Dashboard
 ↓
Find Match
 ↓
Update Score
 ↓
Public Live Score
 ↓
Complete Match
 ↓
Publish Result
 ↓
Leaderboard
```

---

# 39. Full Competition Simulation

Before production:

```text
Create Test Institutes
 ↓
Create Teams
 ↓
Create Participants
 ↓
Create Fixtures
 ↓
Run Matches
 ↓
Update Live Scores
 ↓
Complete Matches
 ↓
Publish Results
 ↓
Verify Standings
```

This should involve multiple sports.

---

# 40. Mobile Testing

Priority devices:

```text
Android Phones
iPhones where practical
Tablet
Desktop
```

Special attention:

```text
Organizer Dashboard
Score Entry
Live Score
Schedule
Results
```

---

# 41. Phase 16 — Deployment

Follow `DEPLOYMENT.md`.

---

## Deployment Sequence

```text
Local
 ↓
CI
 ↓
Staging
 ↓
Testing
 ↓
Production
```

---

## Production Components

```text
Cloudflare
 ↓
Reverse Proxy
 ↓
Next.js
 ↓
NestJS
 ↓
Prisma
 ↓
PostgreSQL
```

---

# 42. Production Freeze

Once the final release is verified:

```text
Production Freeze
```

should begin before the competition.

After the freeze:

```text
No unnecessary features
No unnecessary dependency updates
No unnecessary schema changes
```

---

# 43. Phase 17 — Final Event Preparation

Before 1 October:

```text
Final Database
Final Teams
Final Participants
Final Sports
Final Venues
Final Fixtures
Final Schedules
Final Organizer Accounts
Final Permissions
Final Sponsors
Final Content
```

must be verified.

---

# 44. Timeline

The project should work backward from the event.

```text
29 Aug
 │
 ├── Foundation
 │
 ├── Database
 │
 ├── Authentication
 │
 ├── RBAC
 │
 ├── Competition Core
 │
 ├── Public Website
 │
 ├── Live Scores
 │
 ├── Results
 │
 └── Organizer Platform
 │
10–12 Sep
 │
 ▼
Feature Complete / Internal Stabilization
 │
 ├── Testing
 ├── Bug Fixing
 ├── Security
 └── Staging
 │
~20 Sep
 │
 ▼
Testing / Handoff Target
 │
18–23 Sep
 │
 ▼
Project Lead Mid-Sem Exams
 │
 ▼
Final Stabilization
 │
1 Oct
 │
▼
CONVOQUER'26
```

---

# 45. Critical Scheduling Rule

The project should **not** depend on the project lead being available every day after the internal feature-complete target.

Therefore, by approximately 10–12 September:

```text
Architecture
Core Features
Deployment
Testing Infrastructure
```

should be sufficiently stable that the team can continue fixing non-critical issues independently.

---

# 46. Team Structure

Recommended structure:

```text
                    PROJECT LEAD
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       Backend        Frontend       Infrastructure
          │              │              │
          └──────────────┼──────────────┘
                         │
                      Testing
```

Developers should collaborate rather than become isolated owners of entire systems.

---

# 47. Suggested Developer Allocation

## Developer 1 — Authentication & Security

```text
Google OAuth
Sessions
Authentication
Security
```

---

## Developer 2 — Database & Backend

```text
Prisma
Database
Core Services
Database Integration
```

---

## Developer 3 — Public Frontend

```text
Home
Sports
Schedule
Teams
Results
Leaderboard
```

---

## Developer 4 — Teams & Participants

```text
Teams
Participants
Excel Import
Registration Data
```

---

## Developer 5 — Sports & Fixtures

```text
Sports
Venues
Fixtures
Schedules
Brackets
```

---

## Developer 6 — Live Scoring & Results

```text
Live Scores
Matches
Results
Standings
Realtime
```

---

## Developer 7 — Organizer Platform & QA

```text
Dashboards
Role-based UI
Organizer Workflows
Testing
Regression
```

The exact assignment should be adjusted after assessing each developer's strengths.

---

# 48. Project Lead Responsibilities

The project lead should primarily own:

```text
Architecture
Security
Code Review
Integration
Critical Backend Logic
Database Review
RBAC Review
Deployment
Technical Decisions
Team Coordination
```

The project lead should avoid becoming the only person capable of modifying the codebase.

---

# 49. Knowledge Distribution

At least two developers should understand each critical subsystem.

Critical systems:

```text
Authentication
Database
RBAC
Scoring
Deployment
```

Avoid:

```text
Only Developer X knows authentication.
```

Instead:

```text
Developer X
+
Developer Y
```

should understand it.

---

# 50. Task Breakdown

Every large feature should be divided into small issues.

Bad:

```text
Build Organizer Platform
```

Good:

```text
Create Organizer Layout
Create User Dashboard API
Create Permission Guard
Create Role Navigation
Create Sports Coordinator View
Create Volunteer View
Create Convener View
Add Dashboard Tests
```

---

# 51. GitHub Issues

Every implementation task should become a GitHub Issue.

Example:

```text
Issue #124
Title:
Implement Match Creation API

Description:
Create endpoint for authorized users to create matches.

Acceptance Criteria:
- DTO validation
- Authorization
- Database persistence
- Audit log
- Tests
```

---

# 52. Branching

Use the workflow defined in `GIT_WORKFLOW.md`.

Conceptually:

```text
main
 │
 ├── feature/authentication
 ├── feature/matches
 ├── feature/live-scoring
 └── feature/dashboard
```

---

# 53. Pull Requests

Every meaningful feature should go through:

```text
Branch
 ↓
Commit
 ↓
Push
 ↓
Pull Request
 ↓
CI
 ↓
Review
 ↓
Merge
```

---

# 54. Definition of Done

A feature is not considered complete merely because the UI works.

A feature is done when:

```text
[ ] Implementation complete
[ ] TypeScript passes
[ ] ESLint passes
[ ] Formatting passes
[ ] Tests added
[ ] Tests pass
[ ] Authorization checked
[ ] Security considered
[ ] Database changes documented
[ ] PR reviewed
[ ] Merged
```

---

# 55. Definition of Done — P0

For P0 features additionally:

```text
[ ] Integration test
[ ] Negative security test
[ ] E2E test where appropriate
[ ] Manual test
[ ] Mobile test where applicable
```

---

# 56. Feature Freeze Criteria

The project enters feature freeze when:

```text
All P0 Features
+
Critical P1 Features
+
Deployment
+
Testing Infrastructure
```

are working.

After this point, new features should require explicit approval.

---

# 57. Scope Control

If a feature begins consuming too much time:

```text
Evaluate
 ↓
Classify P0/P1/P2
 ↓
Postpone if non-critical
```

Do not allow P2 features to delay P0 functionality.

---

# 58. TBD Requirements

Several event requirements remain TBD.

Examples:

```text
Exact number of participating institutes
Final sports list
Competition formats
Participant fields
Medical facilities
Parking
Transportation
Final organizer permissions
Final competition rules
Final ranking calculation
```

These must not block the development of systems that can be designed independently.

---

# 59. Configuration Over Hardcoding

Where requirements are likely to change, prefer configurable data.

For example:

```text
Sport
 ↓
Competition Format
 ↓
Points System
 ↓
Rules
```

should not require rewriting application code for every minor rule change.

---

# 60. Handling Finalized Requirements

When a TBD requirement becomes final:

```text
Requirement Confirmed
 ↓
Update PRD
 ↓
Update Relevant Technical Document
 ↓
Create GitHub Issue
 ↓
Implement
 ↓
Test
```

---

# 61. Daily Development Routine

Recommended:

```text
Start
 ↓
Check GitHub Issues
 ↓
Select Task
 ↓
Create Branch
 ↓
Implement
 ↓
Run Checks
 ↓
Commit
 ↓
Push
 ↓
PR
```

---

# 62. Weekly Review

At regular intervals review:

```text
Completed
In Progress
Blocked
At Risk
```

The project lead should identify blockers early.

---

# 63. Blocker Rule

If a developer is blocked for an extended period:

```text
Do not silently wait.
```

Ask for help, pair with another developer, or reduce the task scope.

---

# 64. Pair Programming

Pair programming should be encouraged for:

```text
Authentication
RBAC
Database
Live Scoring
Complex Tournament Logic
Security
```

This also helps transfer knowledge to newer developers.

---

# 65. Code Review Priorities

Reviewers should prioritize:

```text
1. Security
2. Correctness
3. Data Integrity
4. Architecture
5. Maintainability
6. Performance
7. Formatting
```

Formatting should primarily be automated.

---

# 66. Performance Priority

Do not prematurely optimize.

First ensure:

```text
Correct
Secure
Maintainable
```

Then optimize measured bottlenecks.

---

# 67. Critical Performance Areas

The most important performance areas are:

```text
Public Live Scores
Results
Leaderboard
Database Queries
WebSocket Connections
Large Participant Imports
```

---

# 68. Database Query Discipline

Developers should avoid unnecessary:

```text
Repeated Queries
N+1 Queries
Huge Unfiltered Queries
Unnecessary Joins
```

---

# 69. Frontend Performance

The public website should prioritize:

```text
Fast Initial Load
Mobile Performance
Optimized Images
Efficient API Requests
Limited Unnecessary Re-renders
```

---

# 70. Event-Day Architecture

During the actual event:

```text
Public Users
      │
      ▼
Cloudflare
      │
      ▼
Frontend
      │
      ▼
Backend
      │
 ┌────┴─────┐
 ▼          ▼
Database   WebSocket
             │
             ▼
        Live Clients
```

---

# 71. Event-Day Operational Priority

During live competition:

```text
Score Integrity
>
Availability
>
Correct Results
>
Performance
>
Visual Polish
```

---

# 72. Emergency Priority

If something breaks during the event:

```text
1. Protect Data
2. Stop Incorrect Updates
3. Restore Correct State
4. Restore Service
5. Verify
6. Document
```

---

# 73. Post-Event

After Convoquer'26:

```text
Freeze Event Data
 ↓
Generate Reports
 ↓
Backup Database
 ↓
Archive Logs
 ↓
Document Incidents
 ↓
Review System
```

---

# 74. Post-Event Improvements

Only after the competition should the team consider:

```text
Advanced Analytics
Performance Improvements
UI Improvements
Additional Features
Architecture Refactoring
```

---

# 75. Master Milestone Table

| Milestone               | Target         | Priority |
| ----------------------- | -------------- | -------- |
| Repository Setup        | Immediate      | P0       |
| Development Environment | Immediate      | P0       |
| Database Foundation     | Early          | P0       |
| Authentication          | Early          | P0       |
| Sessions                | Early          | P0       |
| RBAC                    | Early          | P0       |
| Sports                  | Early          | P0       |
| Teams                   | Early          | P0       |
| Participants            | Early          | P0       |
| Fixtures                | Early          | P0       |
| Public Website          | Early/Mid      | P0       |
| Live Scoring            | Mid            | P0       |
| Results                 | Mid            | P0       |
| Standings               | Mid            | P0       |
| Organizer Platform      | Mid/Late       | P0       |
| Realtime                | Mid/Late       | P0       |
| Security Hardening      | Before Freeze  | P0       |
| Testing                 | Before Freeze  | P0       |
| Staging                 | Before Freeze  | P0       |
| Production              | Before Event   | P0       |
| Secondary Features      | As Time Allows | P1       |
| Advanced Features       | Optional       | P2       |

---

# 76. Risk Management

## Risk: Developers are inexperienced

Mitigation:

```text
Small tasks
Pair programming
Code review
Learning alongside development
Documentation
```

---

## Risk: Project Lead becomes bottleneck

Mitigation:

```text
Delegate ownership
Document decisions
Cross-train developers
Use PR reviews
```

---

## Risk: Requirements change

Mitigation:

```text
Configurable systems
TBD tracking
Prioritization
Feature freeze
```

---

## Risk: Live score failure

Mitigation:

```text
Integration tests
E2E tests
Realtime testing
Manual rehearsal
Fallback operational procedure
```

---

## Risk: Database corruption

Mitigation:

```text
Transactions
Constraints
Audit logs
Backups
Recovery testing
```

---

## Risk: Unauthorized score modification

Mitigation:

```text
Authentication
RBAC
Sport scope
Server-side validation
Audit logs
Security testing
```

---

## Risk: Deployment failure

Mitigation:

```text
Staging
CI
Backups
Rollback plan
Production smoke tests
```

---

# 77. Fallback Strategy

If time becomes insufficient, preserve:

```text
Authentication
Database
Sports
Teams
Fixtures
Live Scores
Results
Standings
Organizer Access
Public Website
Security
```

Postpone:

```text
Advanced Statistics
Advanced Analytics
Gallery Automation
Advanced Notifications
Experimental Features
```

---

# 78. Absolute Minimum Viable Platform

If development time becomes severely constrained, the platform must still support:

```text
Public Website
+
Sports
+
Teams
+
Schedule
+
Live Scores
+
Results
+
Leaderboard
+
Authentication
+
Organizer Dashboard
+
RBAC
+
Secure Database
```

---

# 79. Final Release Candidate

The final release candidate should be frozen after:

```text
Feature Complete
 ↓
Security Review
 ↓
Full Test Suite
 ↓
Competition Simulation
 ↓
Staging
 ↓
Manual QA
 ↓
Production Deployment
 ↓
Smoke Test
```

---

# 80. Final Pre-Event Checklist

```text
[ ] All confirmed sports entered
[ ] All participating institutes entered
[ ] Teams imported
[ ] Participants imported
[ ] Fixtures created
[ ] Venues verified
[ ] Schedules verified
[ ] Organizer accounts created
[ ] Roles assigned
[ ] Sports Coordinators assigned
[ ] Volunteers assigned
[ ] Public content verified
[ ] Sponsors verified
[ ] Rules published
[ ] Emergency information published
[ ] Live scoring tested
[ ] Results tested
[ ] Standings tested
[ ] Backups verified
[ ] Recovery tested
[ ] Production tested
```

---

# 81. Final Technical Checklist

```text
[ ] Client builds
[ ] Server builds
[ ] Database migrations work
[ ] CI passes
[ ] Formatting passes
[ ] ESLint passes
[ ] TypeScript passes
[ ] Unit tests pass
[ ] Integration tests pass
[ ] E2E tests pass
[ ] Authentication works
[ ] Sessions work
[ ] RBAC works
[ ] Audit logging works
[ ] WebSockets work
[ ] Live scoring works
[ ] Results work
[ ] Standings work
[ ] Cloudflare works
[ ] HTTPS works
[ ] Backups work
[ ] Restore tested
```

---

# 82. Final Event-Day Checklist

```text
[ ] Server healthy
[ ] Database healthy
[ ] Cloudflare healthy
[ ] Authentication healthy
[ ] WebSockets healthy
[ ] Public website accessible
[ ] Organizer accounts accessible
[ ] Backup available
[ ] Technical personnel available
[ ] Emergency procedure available
```

---

# 83. Documentation Completion

The project's core documentation set is:

```text
PRD.md
ARCHITECTURE.md
DATABASE.md
RBAC.md
API_SPEC.md
SECURITY.md
DEVELOPMENT.md
GIT_WORKFLOW.md
CODE_STYLE.md
TESTING.md
DEPLOYMENT.md
IMPLEMENTATION_PLAN.md
```

These documents together form the technical blueprint of the platform.

---

# 84. Documentation Rule

When an architectural or security decision changes:

```text
Code
+
Relevant Documentation
```

must be updated.

Documentation must not become disconnected from the implementation.

---

# 85. Success Criteria

The project is successful if, before Convoquer'26:

```text
Users can securely authenticate.
Organizers receive correct permissions.
Sports can be configured.
Teams and participants can be managed.
Fixtures can be created.
Matches can be conducted.
Scores can be updated live.
Results can be published.
Standings update correctly.
The public can view competition information.
Critical operations are audited.
The platform survives realistic event usage.
The system can be recovered after failure.
```

---

# 86. Final Principle

> **Build the foundation first. Build critical competition functionality second. Polish third.**

The project should never sacrifice:

```text
Security
Data Integrity
Competition Integrity
Reliability
```

for:

```text
Animations
Extra Features
Visual Complexity
Experimental Technology
```

The ultimate goal is not merely to create a beautiful website.

It is to create a **reliable digital competition platform that can actually be trusted during Convoquer'26.**

---

# 87. Status

**Approved Implementation Baseline**

The following are considered established:

```text
Phased Development
Priority-Based Development
P0/P1/P2 Classification
Small GitHub Tasks
Git-Based Collaboration
Automated CI
Code Review
Layered Testing
Security-First Development
Staging Before Production
Production Freeze
Event-Day Stability
```

The following remain TBD:

```text
Exact final sports list
Competition formats
Final participant fields
Final organizer permissions
Final ranking calculations
Final infrastructure specifications
Final monitoring stack
Final backup configuration
Final event operational procedures
```

When these are confirmed, they should be incorporated into the appropriate project documentation before implementation of the affected feature.
