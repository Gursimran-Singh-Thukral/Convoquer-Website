# Convoquer'26 Digital Platform

Official digital platform for **Convoquer'26**, the annual sports fest of the **Indian Institute of Technology Jammu**.

Convoquer brings together colleges and institutes from across the region to compete across multiple sporting events.

This project aims to replace the traditional, largely manual event-information and scoring workflow with a centralized, secure and realtime digital platform.

---

## About the Project

The Convoquer'26 Digital Platform consists of two major parts:

### Public Website

The public-facing platform will provide participants, students, visitors and spectators with access to:

- Event information
- Sports
- Teams
- Fixtures
- Match schedules
- Live scores
- Results
- Point tables
- Knockout brackets
- Leaderboards
- Institute rankings
- Medal tally
- Venues
- Rules & Regulations
- Sponsors
- News & Updates
- Gallery
- FAQs
- Contact information

### Organizer Platform

The organizer platform will provide role-specific tools for managing the event.

Different users will receive different capabilities based on their assigned roles and permissions.

The platform will support roles and teams such as:

- Convener
- Co-Conveners
- Team Heads
- Sports Coordinators
- Volunteers
- Media Team
- Design Team
- Web Team
- Management

A user may have multiple roles where required.

---

# Core Objectives

The platform is being designed around the following principles:

```text
Security
Reliability
Competition Integrity
Data Integrity
Realtime Information
Role-Based Access
Maintainability
Mobile Usability
Professional Design
```

The system must ensure that sensitive operations such as score and result modification are properly authenticated, authorized and auditable.

---

# Technology Stack

The current planned technology stack is:

| Area                      | Technology     |
| ------------------------- | -------------- |
| Frontend                  | Next.js        |
| Frontend Language         | TypeScript     |
| Backend                   | NestJS         |
| Backend Language          | TypeScript     |
| Database                  | PostgreSQL     |
| ORM                       | Prisma         |
| Authentication            | Google OAuth   |
| Realtime Communication    | WebSockets     |
| Version Control           | Git            |
| Repository                | GitHub         |
| CI                        | GitHub Actions |
| Edge / Security Layer     | Cloudflare     |
| Production Infrastructure | VM             |

The exact versions and some infrastructure choices will be finalized during development.

---

# Repository Structure

```text
convoquer26/
│
├── client/
│   └── Frontend application
│
├── server/
│   └── Backend application
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── RBAC.md
│   ├── API_SPEC.md
│   ├── SECURITY.md
│   ├── DEVELOPMENT.md
│   ├── GIT_WORKFLOW.md
│   ├── CODE_STYLE.md
│   ├── TESTING.md
│   ├── DEPLOYMENT.md
│   └── IMPLEMENTATION_PLAN.md
│
├── .github/
│   └── GitHub configuration and workflows
│
├── .editorconfig
├── .gitignore
└── README.md
```

---

# Documentation

The `docs/` directory contains the project's technical documentation.

## Product Requirements

### `PRD.md`

Defines:

- Product vision
- Functional requirements
- User types
- Public website requirements
- Organizer platform requirements
- Competition requirements
- Event requirements

---

## Architecture

### `ARCHITECTURE.md`

Defines:

- System architecture
- Client/server separation
- Major components
- Communication between components
- Deployment architecture
- Architectural decisions

---

## Database

### `DATABASE.md`

Defines:

- Database entities
- Relationships
- Constraints
- Identifiers
- Data integrity rules
- Database design principles

---

## RBAC

### `RBAC.md`

Defines:

- Roles
- Permissions
- Role hierarchy
- Resource-level access
- Sport-level access
- Organizer capabilities

---

## API

### `API_SPEC.md`

Defines:

- Backend API structure
- Endpoints
- Request/response contracts
- Authentication requirements
- Authorization requirements

---

## Security

### `SECURITY.md`

Defines:

- Authentication security
- Session management
- Authorization
- Score integrity
- Result integrity
- Database security
- Audit logging
- Security principles

---

## Development

### `DEVELOPMENT.md`

Defines:

- Development methodology
- Development environment
- Project conventions
- Feature development process
- Engineering practices

---

## Git Workflow

### `GIT_WORKFLOW.md`

Defines:

- Branching strategy
- Commit conventions
- Pull requests
- Code reviews
- GitHub workflow

---

## Code Style

### `CODE_STYLE.md`

Defines:

- Formatting
- Naming
- File organization
- TypeScript conventions
- General coding standards

Automated tooling will enforce as many of these rules as possible.

---

## Testing

### `TESTING.md`

Defines:

- Unit testing
- Integration testing
- E2E testing
- Security testing
- Realtime testing
- Competition simulation
- Release testing

---

## Deployment

### `DEPLOYMENT.md`

Defines:

- Staging
- Production
- VM deployment
- Cloudflare
- PostgreSQL deployment
- Backups
- Recovery
- Production operations

---

## Implementation Plan

### `IMPLEMENTATION_PLAN.md`

Defines:

- Development phases
- Priorities
- Task allocation
- Milestones
- Team responsibilities
- Development timeline
- Definition of Done

---

# Development Philosophy

This project is being developed by a team of developers with varying levels of web-development experience.

The development process therefore emphasizes:

```text
Learn
 ↓
Implement
 ↓
Test
 ↓
Review
 ↓
Merge
```

Developers are expected to understand the code they contribute rather than simply copying implementations.

---

# Development Workflow

The standard workflow is:

```text
GitHub Issue
     ↓
Create Branch
     ↓
Implement Feature
     ↓
Run Local Checks
     ↓
Commit
     ↓
Push
     ↓
Pull Request
     ↓
CI
     ↓
Code Review
     ↓
Merge
```

No developer should directly push unreviewed feature code into the protected production branch.

Refer to `docs/GIT_WORKFLOW.md` for the complete workflow.

---

# Code Quality

The project uses automated tooling to maintain consistent code quality.

The development environment will enforce:

```text
Formatting
Linting
Type Checking
Testing
```

Developers should not spend time manually correcting formatting that can be handled automatically by the project's tooling.

Refer to:

```text
docs/CODE_STYLE.md
```

for the project's coding standards.

---

# Security

Security is a first-class requirement of the project.

Particular attention is given to:

```text
Authentication
Session Management
Authorization
RBAC
Database Security
Score Integrity
Result Integrity
Audit Logging
```

The frontend must never be treated as a security boundary.

All sensitive operations must be validated by the backend.

Refer to:

```text
docs/SECURITY.md
```

---

# Competition Integrity

The platform will be responsible for handling important competition information.

Therefore:

```text
Score
 ↓
Validation
 ↓
Authorization
 ↓
Database
 ↓
Audit
 ↓
Realtime Update
```

must be treated as a critical workflow.

Changes to scores and official results must be appropriately traceable.

---

# Realtime Features

The platform is intended to provide realtime competition information.

This includes:

- Live scores
- Match status
- Results
- Standings where applicable
- Other important competition updates

Realtime communication will primarily use WebSockets.

---

# Environments

The project is expected to maintain separate environments:

```text
Development
     ↓
Staging
     ↓
Production
```

Development and staging data must not be confused with production competition data.

---

# Production

The production platform is expected to use:

```text
Internet
    ↓
Cloudflare
    ↓
Reverse Proxy
    ↓
Next.js / NestJS
    ↓
PostgreSQL
```

The exact infrastructure configuration will be finalized during implementation.

Refer to:

```text
docs/DEPLOYMENT.md
```

---

# Getting Started

The complete development environment is being established during **Phase 0**.

Once the initial setup is complete, developers will be able to start the project locally using the instructions provided here.

> **Do not invent local setup procedures. Follow the repository's documented setup instructions.**

The README will be updated as the project setup becomes finalized.

---

# Development Phases

The project is being developed in phases.

```text
Phase 0
Project Setup

Phase 1
Learning & Onboarding

Phase 2
Database Foundation

Phase 3
Authentication & Sessions

Phase 4
RBAC & Authorization

Phase 5
Core Competition Data

Phase 6
Teams & Participants

Phase 7
Fixtures & Scheduling

Phase 8
Public Website

Phase 9
Live Scoring

Phase 10
Results & Standings

Phase 11
Organizer Platform

Phase 12
Realtime Integration

Phase 13
Secondary Features

Phase 14
Security Hardening

Phase 15
Testing

Phase 16
Deployment

Phase 17
Final Event Preparation
```

The complete implementation strategy is available in:

```text
docs/IMPLEMENTATION_PLAN.md
```

---

# Current Development Status

## Phase 0 — Project Setup

**Status:** In Progress

Current progress:

```text
[✓] GitHub Repository
[✓] Initial Project Structure
[ ] README
[ ] .gitignore
[ ] .editorconfig
[ ] Root Package Configuration
[ ] Client Setup
[ ] Server Setup
[ ] Prettier
[ ] ESLint
[ ] Git Hooks
[ ] Environment Configuration
[ ] PostgreSQL
[ ] Prisma
[ ] Testing Infrastructure
[ ] GitHub Actions
[ ] Complete Setup Verification
```

The checklist should be updated as Phase 0 progresses.

---

# Contribution Guidelines

Before contributing:

1. Read `docs/DEVELOPMENT.md`.
2. Read `docs/GIT_WORKFLOW.md`.
3. Read `docs/CODE_STYLE.md`.
4. Read the relevant technical documentation.
5. Create or select the appropriate GitHub Issue.
6. Create a feature branch.
7. Implement the assigned task.
8. Run the required checks.
9. Open a Pull Request.
10. Address review comments.
11. Merge only after the required checks pass.

---

# Pull Requests

Every Pull Request should clearly explain:

```text
What changed?
Why was it changed?
How was it tested?
Does it affect the database?
Does it affect authentication?
Does it affect authorization?
Does it affect live scoring?
```

Large unrelated changes should not be bundled into the same Pull Request.

---

# Issues

GitHub Issues should represent actionable work.

Prefer:

```text
Implement Match Creation API
```

over:

```text
Work on Backend
```

A good issue should contain:

```text
Description
Requirements
Acceptance Criteria
Dependencies
Relevant Documentation
```

---

# Definition of Done

A feature is considered complete when:

```text
[ ] Implementation complete
[ ] TypeScript passes
[ ] ESLint passes
[ ] Formatting passes
[ ] Tests added where required
[ ] Tests pass
[ ] Authorization considered
[ ] Security considered
[ ] Database changes documented
[ ] Code reviewed
[ ] Pull Request merged
```

Critical functionality may require additional testing.

---

# Team

The project is being developed by a student team under the leadership of the project lead.

The team structure and responsibilities are defined in:

```text
docs/IMPLEMENTATION_PLAN.md
```

The goal is to ensure that knowledge is shared and no critical subsystem depends entirely on a single developer.

---

# Important Rules

### 1. Do not bypass the architecture

If a feature appears difficult, discuss the architecture before introducing a shortcut.

### 2. Do not bypass authorization

Never rely on frontend UI restrictions as the security mechanism.

### 3. Do not modify production data casually

Production competition data is critical.

### 4. Do not commit secrets

Never commit:

```text
Passwords
API Keys
OAuth Secrets
Session Secrets
Database Credentials
Private Keys
```

### 5. Do not ignore failing tests

A failing test should be understood and resolved rather than bypassed.

### 6. Keep documentation synchronized

When an architectural decision changes, update the relevant documentation.

### 7. Prefer simple solutions

Do not introduce unnecessary technologies or complexity.

---

# Project Goal

The goal of this project is not simply to create a visually attractive event website.

It is to build a reliable digital platform capable of supporting the actual operation of Convoquer'26.

The final system should provide:

```text
A Professional Public Website
+
Secure Organizer Platform
+
Reliable Competition Management
+
Realtime Scores
+
Accurate Results
+
Strong Data Integrity
+
Auditable Administrative Operations
```

---

# Convoquer'26

**Indian Institute of Technology Jammu**

**1–4 October 2026**

---

> **Build it properly. Test it thoroughly. Keep the competition data trustworthy.**
