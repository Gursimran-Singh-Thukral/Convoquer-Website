# Convoquer'26 Digital Platform — Deployment Guide

**Project:** Convoquer'26 Digital Platform  
**Institute:** Indian Institute of Technology Jammu  
**Frontend:** Next.js + TypeScript  
**Backend:** NestJS + TypeScript  
**Database:** PostgreSQL  
**ORM:** Prisma  
**Infrastructure:** Institute/Project VM  
**Edge/CDN:** Cloudflare  
**Domain:** Convoquer'26 official domain  
**Authentication:** Google OAuth  
**Repository:** GitHub  
**Deployment Model:** Production + Staging  
**Document Version:** 1.0  
**Status:** Approved Deployment Baseline

---

# 1. Purpose

This document defines how the Convoquer'26 Digital Platform will be deployed, operated, updated, backed up and recovered.

The deployment architecture must prioritize:

```text
Security
Reliability
Data Integrity
Recoverability
Availability
Observability
Maintainability
```

The website will be used during a live sports event.

Therefore:

> **A deployment failure during the event can become an operational failure for the entire competition.**

Production infrastructure must consequently be prepared and tested before the event.

---

# 2. Deployment Philosophy

The project follows:

```text
Development
     ↓
Testing
     ↓
Staging
     ↓
Production
```

Production should never be treated as a development environment.

---

# 3. Production Architecture

The target architecture is:

```text
                         INTERNET
                            │
                            ▼
                       CLOUDFLARE
                            │
                     HTTPS / TLS
                            │
                            ▼
                    Reverse Proxy
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
        Next.js Client              NestJS Server
              │                           │
              │                           ▼
              │                      Prisma ORM
              │                           │
              │                           ▼
              │                       PostgreSQL
              │
              │
              └──────── WebSocket ────────┘
```

---

# 4.1 VM

The VM will host the production application.

Expected services:

```text
Next.js
NestJS
PostgreSQL
Reverse Proxy
Process Manager
```

The exact VM specifications are TBD.

---

# 4.2 Cloudflare

Cloudflare will sit in front of the production application.

Cloudflare may provide:

```text
DNS
TLS
CDN
Caching where appropriate
DDoS/bot protection
Edge security
Traffic filtering
```

Cloudflare is an infrastructure security layer.

It does **not** replace:

```text
Authentication
Authorization
RBAC
Session Validation
Input Validation
Database Security
Score Integrity
```

These remain application responsibilities.

---

# 5. Domain

The official Convoquer'26 domain will point to Cloudflare.

Conceptually:

```text
Domain
   ↓
Cloudflare DNS
   ↓
Production VM
```

The final domain name is TBD.

---

# 6. HTTPS

Production traffic must use HTTPS.

HTTP should redirect to HTTPS where appropriate.

The application must not expose sensitive authentication or session information over unencrypted HTTP.

---

# 7. TLS

TLS termination may occur at Cloudflare and/or the reverse proxy depending on the final configuration.

The chosen configuration must maintain secure end-to-end communication.

---

# 8. Reverse Proxy

The production VM should use a reverse proxy.

Recommended conceptual structure:

```text
Internet
   ↓
Cloudflare
   ↓
Reverse Proxy
   ├── /
   │    ↓
   │  Next.js
   │
   └── /api
        ↓
      NestJS
```

WebSocket traffic must also be correctly proxied.

---

# 9. Frontend Deployment

The frontend resides in:

```text
/client
```

The production frontend should be built using the project's production build process.

Conceptually:

```text
Source Code
    ↓
Install Dependencies
    ↓
Build
    ↓
Next.js Production Application
    ↓
Process Manager
```

---

# 10. Backend Deployment

The backend resides in:

```text
/server
```

Conceptually:

```text
Source Code
    ↓
Install Dependencies
    ↓
Build TypeScript
    ↓
NestJS Production Application
    ↓
Process Manager
```

---

# 11. Process Management

The production applications must not rely on a developer's terminal remaining open.

A process manager should restart applications after:

```text
Crash
Server Restart
Process Failure
```

The exact process manager is TBD.

Possible choices include:

```text
PM2
systemd
```

The final choice should be documented before production deployment.

---

# 12. PostgreSQL

PostgreSQL should run separately from the public web-facing services.

Recommended:

```text
Internet
   ↓
Cloudflare
   ↓
Application
   ↓
PostgreSQL
```

PostgreSQL must not be publicly exposed to the internet.

---

# 13. Database Network Security

The PostgreSQL port should only be accessible from the required application environment.

Do not expose PostgreSQL directly through:

```text
0.0.0.0
```

without an explicit and justified security design.

---

# 14. Database Credentials

Production database credentials must:

```text
Be stored as secrets
Never be committed to Git
Never appear in frontend code
Never be logged
```

---

# 15. Production Environment Variables

Production configuration must be supplied through environment variables or an approved secret-management mechanism.

Examples:

```text
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SESSION_SECRET
APPLICATION_URL
API_URL
```

The exact list will be defined during implementation.

---

# 16. Client Environment Variables

Any environment variable exposed to the browser must be assumed to be public.

Never expose:

```text
Database Credentials
OAuth Client Secret
Session Secret
Private API Keys
```

through frontend environment variables.

---

# 17. Server Environment Variables

Sensitive configuration belongs only on the server.

Examples:

```text
DATABASE_URL
GOOGLE_CLIENT_SECRET
SESSION_SECRET
```

must never be bundled into the client.

---

# 18. Environment Separation

At minimum:

```text
Development
Staging
Production
```

must have separate configuration.

---

# 19. Database Separation

Development and staging should not use the production database.

Recommended:

```text
Development → Development DB
Staging     → Staging DB
Production  → Production DB
```

---

# 20. Staging Environment

A staging environment should closely resemble production.

It should be used for:

```text
Release Testing
Database Migration Testing
Authentication Testing
E2E Testing
Performance Testing
Final Acceptance Testing
```

---

# 21. Staging Data

Staging should use synthetic/test data.

Do not casually copy sensitive production information into staging.

---

# 22. Google OAuth

Google OAuth must have separate configuration for staging and production where required.

The allowed redirect URLs must exactly match the deployed environments.

---

# 23. Authentication Domain

The final authentication configuration must ensure that only the approved IIT Jammu identity policy can access organizer functionality.

The exact Google Workspace configuration remains dependent on confirmation from the institute.

---

# 24. Session Management

Production session management must follow `SECURITY.md`.

The server must validate sessions against server-side session state.

The session database should be treated as security-sensitive.

---

# 25. Session Database

Production session records may contain information such as:

```text
Session ID
User ID
IP Address
User Agent
Created At
Expires At
Revoked At
```

The exact schema is defined in `DATABASE.md`.

---

# 26. Session Secret

Any cryptographic session secret must:

```text
Be production-only
Be sufficiently random
Never be committed
Never be logged
Be rotated according to the security policy
```

---

# 27. Authentication Failure

Authentication failures must not expose sensitive implementation details.

Avoid returning:

```text
Database Error
OAuth Secret
Internal Stack Trace
```

to the public user.

---

# 28. Application Logging

Production logging should provide enough information to diagnose issues without exposing sensitive data.

Useful information may include:

```text
Timestamp
Severity
Service
Request Identifier
Relevant Resource ID
Error Type
```

---

# 29. Sensitive Logging

Never log:

```text
Passwords
OAuth Secrets
Session Tokens
Access Tokens
Database Credentials
Private Keys
```

---

# 30. Log Management

Production logs should have appropriate retention and rotation.

The exact logging system is TBD.

At minimum, logs must not be allowed to fill the VM's disk indefinitely.

---

# 31. Health Checks

The backend should expose an appropriate health-check mechanism.

Conceptually:

```text
GET /health
```

The exact endpoint and response structure will be defined during implementation.

---

# 32. Health Check Requirements

The health system should be capable of identifying problems such as:

```text
Application Down
Database Unavailable
Critical Dependency Failure
```

without exposing sensitive internal information.

---

# 33. Application Startup

Production startup should fail safely if critical configuration is missing.

For example:

```text
Missing DATABASE_URL
Missing SESSION_SECRET
Missing OAuth configuration
```

should not result in a partially functional insecure application.

---

# 34. Database Migration Strategy

Production database changes must use controlled Prisma migrations.

Workflow:

```text
Schema Change
      ↓
Migration Created
      ↓
Local Testing
      ↓
Staging Testing
      ↓
Backup
      ↓
Production Migration
      ↓
Verification
```

---

# 35. Migration Rule

Never use destructive development commands against production.

Especially avoid:

```text
prisma migrate reset
```

against production.

---

# 36. Migration Backups

Before a significant production database migration:

```text
Backup
 ↓
Verify Backup
 ↓
Migration
 ↓
Smoke Test
```

---

# 37. Destructive Migrations

Destructive migrations require additional review.

Examples:

```text
Deleting Columns
Deleting Tables
Changing Important Constraints
Changing Relationships
```

Do not perform these casually during the event.

---

# 38. Database Backup Strategy

Production PostgreSQL must have backups.

At minimum:

```text
Scheduled Backup
+
Pre-Migration Backup
+
Pre-Event Verified Backup
```

The exact backup frequency is TBD based on available infrastructure.

---

# 39. Backup Storage

Backups should not exist only on the same VM as the production database.

If the VM fails completely, a local-only backup may be lost.

Use a separate backup destination where available.

---

# 40. Backup Encryption

Production backups should be protected appropriately.

Sensitive database backups must not be publicly accessible.

---

# 41. Backup Verification

A backup is not considered reliable until restoration has been tested.

Process:

```text
Backup
 ↓
Restore to Test Environment
 ↓
Verify Database
 ↓
Record Result
```

---

# 42. Recovery Strategy

If production database failure occurs:

```text
Identify Failure
 ↓
Stop Further Damage
 ↓
Determine Recovery Point
 ↓
Restore Backup
 ↓
Run Migrations if Required
 ↓
Verify Data
 ↓
Start Application
 ↓
Smoke Test
```

---

# 43. Recovery Point Objective

The acceptable maximum amount of lost competition data must be defined before the event.

Example:

```text
RPO = TBD
```

The final value depends on backup frequency and infrastructure capabilities.

---

# 44. Recovery Time Objective

The maximum acceptable time to restore the platform must also be defined.

```text
RTO = TBD
```

This should be decided before the event.

---

# 45. Deployment Pipeline

The preferred deployment flow is:

```text
Developer
   ↓
GitHub
   ↓
Pull Request
   ↓
CI
   ↓
Merge
   ↓
Staging
   ↓
Acceptance Testing
   ↓
Production
```

---

# 46. CI Requirements

Before deployment, CI should verify:

```text
Formatting
Linting
Type Checking
Unit Tests
Integration Tests
Build
```

Relevant E2E tests should also run before production release.

---

# 47. Automated Deployment

Where practical, production deployment should be automated through GitHub Actions or an equivalent controlled deployment mechanism.

The exact implementation is TBD.

---

# 48. Manual Approval

Production deployment should require an intentional release action.

Recommended:

```text
Staging Passed
      ↓
Release Approved
      ↓
Production Deployment
```

This reduces accidental production deployments.

---

# 49. Production Deployment Process

Conceptually:

```text
Select Release
      ↓
Verify CI
      ↓
Verify Staging
      ↓
Backup Database if required
      ↓
Deploy
      ↓
Run Migration if required
      ↓
Health Check
      ↓
Smoke Test
      ↓
Release Confirmed
```

---

# 50. Versioned Releases

Production deployments should correspond to a known Git commit/tag.

Example:

```text
v1.0.0
```

or an equivalent project version.

This makes rollback possible.

---

# 51. Rollback

A production deployment must have a rollback strategy.

Conceptually:

```text
Current Release
      ↓
Problem
      ↓
Identify Previous Stable Release
      ↓
Rollback Application
      ↓
Verify
```

Database rollback must be handled separately and carefully.

---

# 52. Database Rollback

Application rollback does not automatically mean database rollback is safe.

Example:

```text
Application v2
 ↓
Database migration
 ↓
Application problem
 ↓
Rollback application to v1
```

If the database schema is no longer compatible with v1, the application rollback can make things worse.

Therefore:

> Database migrations must be designed with deployment compatibility in mind.

---

# 53. Backward-Compatible Migrations

Where practical:

```text
Add
 ↓
Deploy Compatible Application
 ↓
Migrate Data
 ↓
Remove Old Structure Later
```

is preferable to destructive one-step migrations.

---

# 54. Zero/Minimal Downtime

The project should aim for minimal downtime during deployments.

For a small single-VM deployment, this may initially mean:

```text
Prepare Release
 ↓
Deploy Quickly
 ↓
Restart Application
 ↓
Health Check
```

The exact strategy depends on the final infrastructure.

---

# 55. Event-Time Deployment Freeze

During the actual Convoquer'26 event:

> **Production changes should be minimized.**

Avoid unnecessary:

```text
Feature Deployments
Database Changes
Architecture Changes
Dependency Upgrades
```

during live competition.

---

# 56. Emergency Production Changes

Only genuine emergencies should justify production changes during the event.

Examples:

```text
Critical Security Vulnerability
Score Integrity Failure
Authentication Failure
Production Crash
Critical Data Bug
```

---

# 57. Emergency Deployment

Emergency deployment should follow:

```text
Identify
 ↓
Assess
 ↓
Fix
 ↓
Test
 ↓
Review
 ↓
Deploy
 ↓
Smoke Test
 ↓
Monitor
 ↓
Document
```

---

# 58. Production Freeze

A production freeze should begin before the event.

The exact freeze date should be established after final testing.

Recommended concept:

```text
Final Release
      ↓
Full Testing
      ↓
Production Freeze
      ↓
Convoquer'26
```

---

# 59. Dependency Updates

Do not update major dependencies immediately before or during the event unless necessary.

Examples:

```text
Next.js
NestJS
Prisma
Node.js
PostgreSQL
```

should be stabilized before the production freeze.

---

# 60. VM Security

The VM must be hardened appropriately.

At minimum:

```text
SSH Access Restricted
Firewall Configured
Unused Services Disabled
Regular Security Updates
Strong Authentication
Limited User Privileges
```

---

# 61. SSH

SSH should not be unnecessarily exposed to unrestricted access.

Where practical:

```text
SSH Keys
+
Restricted Access
```

should be used.

---

# 62. Root Access

Application processes should not run unnecessarily as root.

Use a dedicated application user where practical.

---

# 63. Firewall

Only required ports should be exposed.

Typical public services:

```text
80
443
```

SSH should be restricted according to the VM's administrative requirements.

PostgreSQL should not be publicly exposed.

---

# 64. Cloudflare Origin Protection

Where practical, the origin VM should be configured so that normal web traffic reaches it through Cloudflare rather than directly exposing the origin unnecessarily.

The exact implementation depends on the final Cloudflare configuration.

---

# 65. DDoS/Bot Protection

Cloudflare will be used as an infrastructure layer to help mitigate unwanted automated traffic and attacks.

However:

```text
Cloudflare
    ≠
Application Security
```

The application must continue enforcing its own authentication, authorization and validation.

---

# 66. Caching

Public static content may be cached where appropriate.

Dynamic competition data should not be cached incorrectly.

Particular care is required for:

```text
Live Scores
Results
Standings
Authenticated Dashboards
```

---

# 67. Live Score Caching

Live scores must not be served from stale CDN cache.

The live-score architecture should use the appropriate realtime mechanism and cache-control behavior.

---

# 68. WebSocket Deployment

The reverse proxy must support WebSocket connections.

The production environment must be tested for:

```text
Connection
Reconnection
Authentication
Event Delivery
Disconnect
Multiple Clients
```

---

# 69. WebSocket Authentication

WebSocket connections must not automatically be considered trusted merely because they connected successfully.

Authorization must remain enforced.

---

# 70. Static Assets

Static assets should be served efficiently.

Examples:

```text
Images
Fonts
CSS
JavaScript
Public Media
```

---

# 71. Image Optimization

Large images should be optimized before production.

Do not unnecessarily serve multi-megabyte images to mobile users.

---

# 72. Environment Verification

Before production release, verify:

```text
Production Domain
Google OAuth
Database
Session Configuration
Cloudflare
WebSockets
Frontend API URL
Server API
```

---

# 73. Production Configuration Checklist

```text
[ ] Domain configured
[ ] DNS configured
[ ] Cloudflare configured
[ ] HTTPS verified
[ ] VM secured
[ ] Reverse proxy configured
[ ] Client deployed
[ ] Server deployed
[ ] PostgreSQL configured
[ ] Database migrated
[ ] Environment variables configured
[ ] Google OAuth configured
[ ] Session configuration verified
[ ] WebSockets verified
[ ] Health checks verified
[ ] Backups configured
[ ] Backup restoration tested
```

---

# 74. Staging Checklist

```text
[ ] Staging domain works
[ ] HTTPS works
[ ] Authentication works
[ ] Sessions work
[ ] RBAC works
[ ] Database works
[ ] Fixtures work
[ ] Live scores work
[ ] Results work
[ ] Standings work
[ ] Organizer dashboards work
[ ] Public pages work
[ ] WebSockets work
```

---

# 75. Production Smoke Test

Immediately after production deployment:

```text
[ ] Homepage
[ ] Public sports page
[ ] Schedule
[ ] Results
[ ] Leaderboard
[ ] Google Login
[ ] Organizer Dashboard
[ ] Match access
[ ] Score update
[ ] Public live score
[ ] Result workflow
[ ] Logout
```

---

# 76. Event-Day Monitoring

During Convoquer'26, the team should monitor:

```text
Application Health
Database Health
Authentication
API Errors
WebSocket Connectivity
Server Resources
Disk Space
```

---

# 77. Event-Day Operations

A designated technical team should know:

```text
Who is responsible for the server?
Who can deploy?
Who can access the database?
Who handles authentication issues?
Who handles scoring issues?
Who handles frontend issues?
Who handles network/infrastructure issues?
```

The exact personnel assignments will be defined separately.

---

# 78. Operational Separation

Not every organizer should have production infrastructure access.

Production access should be limited to authorized technical personnel.

---

# 79. Database Access

Direct production database access should be restricted.

Normal operations should occur through the application.

Direct database access should be reserved for:

```text
Maintenance
Recovery
Approved Administrative Operations
Emergency Response
```

---

# 80. Production Credentials

Production credentials should not be shared casually through:

```text
WhatsApp
Discord
Email
GitHub Issues
Plain Text Documents
```

Use an appropriate secure mechanism.

---

# 81. Credential Rotation

After the event, sensitive temporary credentials should be reviewed and rotated where appropriate.

---

# 82. Incident Response

If a serious production issue occurs:

```text
Detect
 ↓
Classify
 ↓
Contain
 ↓
Recover
 ↓
Verify
 ↓
Document
```

---

# 83. Security Incident

If there is evidence of:

```text
Unauthorized Access
Credential Theft
Database Compromise
Session Theft
Score Manipulation
```

treat it as a security incident.

Do not silently modify logs or destroy evidence.

---

# 84. Data Integrity Incident

If scores/results appear corrupted:

```text
Stop Further Updates if Necessary
 ↓
Identify Last Known Good State
 ↓
Inspect Audit Logs
 ↓
Determine Cause
 ↓
Recover/Correct
 ↓
Verify
```

---

# 85. Audit Logs During Incident

Audit logs should help determine:

```text
Who
What
When
Which Resource
```

was involved.

---

# 86. Disaster Scenarios

Before the event, consider:

```text
VM Failure
Database Failure
Application Crash
Cloudflare Configuration Error
DNS Failure
Certificate Problem
Authentication Failure
Network Failure
Accidental Deployment
Data Corruption
Credential Compromise
```

---

# 87. Disaster Recovery Drill

At least one recovery drill should be performed before the event.

Example:

```text
Simulated Database Failure
 ↓
Restore Backup
 ↓
Run Application
 ↓
Verify Results
 ↓
Verify Authentication
 ↓
Verify Public Website
```

---

# 88. Documentation During Deployment

Every production deployment should record:

```text
Release Version
Git Commit
Deployment Time
Database Migration
Person Responsible
Result
```

---

# 89. Deployment Log

A simple deployment record should exist.

Example:

```text
Release: v1.0.0
Commit: <commit-hash>
Date: <date>
Deployed By: <person>
Migration: Yes/No
Smoke Test: Passed
Notes: <notes>
```

---

# 90. Final Pre-Event Deployment

The final release should follow:

```text
Code Complete
 ↓
Testing Complete
 ↓
Security Review
 ↓
Staging Deployment
 ↓
Full Competition Simulation
 ↓
Backup Verification
 ↓
Production Deployment
 ↓
Smoke Test
 ↓
Production Freeze
```

---

# 91. Final Production Readiness Checklist

## Infrastructure

```text
[ ] VM ready
[ ] Firewall configured
[ ] SSH secured
[ ] Reverse proxy ready
[ ] Cloudflare configured
[ ] Domain configured
[ ] HTTPS verified
```

## Application

```text
[ ] Client builds
[ ] Server builds
[ ] API works
[ ] WebSockets work
[ ] Authentication works
[ ] Sessions work
[ ] RBAC works
```

## Competition

```text
[ ] Sports configured
[ ] Teams imported
[ ] Participants imported
[ ] Fixtures configured
[ ] Venues configured
[ ] Schedule verified
[ ] Live scoring verified
[ ] Results verified
[ ] Standings verified
```

## Database

```text
[ ] Production database ready
[ ] Migrations applied
[ ] Constraints verified
[ ] Backup created
[ ] Backup restoration tested
```

## Operations

```text
[ ] Monitoring ready
[ ] Logs accessible
[ ] Incident procedure known
[ ] Rollback procedure known
[ ] Recovery procedure known
[ ] Responsible technical personnel assigned
```

---

# 92. Event-Day Golden Rules

### Rule 1

> **Do not deploy unnecessary changes during live competition.**

### Rule 2

> **Do not modify production data directly unless absolutely necessary and authorized.**

### Rule 3

> **Always know which release is currently running.**

### Rule 4

> **Never expose production credentials.**

### Rule 5

> **Backups must exist before critical operations.**

### Rule 6

> **A successful deployment is not complete until the smoke test passes.**

### Rule 7

> **Cloudflare protects the edge; the application must still protect itself.**

### Rule 8

> **Database recovery must be tested before the event, not during it.**

### Rule 9

> **During the event, stability is more valuable than new features.**

### Rule 10

> **Every production change must be traceable to Git.**

---

# 93. Deployment Flow Summary

```text
                         GITHUB
                            │
                            ▼
                       Pull Request
                            │
                            ▼
                           CI
                            │
                    ┌───────┴───────┐
                    ▼               ▼
                 Tests            Build
                    │               │
                    └───────┬───────┘
                            ▼
                         Staging
                            │
                            ▼
                     Acceptance Test
                            │
                            ▼
                       Release
                            │
                            ▼
                        Cloudflare
                            │
                            ▼
                      Reverse Proxy
                       /          \
                      /            \
                     ▼              ▼
                 Next.js          NestJS
                                    │
                                    ▼
                                 Prisma
                                    │
                                    ▼
                               PostgreSQL
```

---

# 94. Relationship to Other Documents

```text
PRD.md
   │
   ▼
ARCHITECTURE.md
   │
   ├── DATABASE.md
   ├── RBAC.md
   ├── API_SPEC.md
   └── SECURITY.md
            │
            ▼
      DEVELOPMENT.md
            │
            ├── GIT_WORKFLOW.md
            ├── CODE_STYLE.md
            └── TESTING.md
                    │
                    ▼
              DEPLOYMENT.md
                    │
                    ▼
          IMPLEMENTATION_PLAN.md
```

---

# 95. Status

**Approved Deployment Baseline**

Confirmed:

- VM-based deployment.
- Cloudflare edge layer.
- HTTPS.
- Reverse proxy.
- Next.js client.
- NestJS server.
- PostgreSQL.
- Prisma migrations.
- Environment separation.
- Staging environment.
- Production environment.
- Google OAuth.
- Server-side session management.
- WebSocket support.
- GitHub-based deployment workflow.
- Automated CI checks.
- Production backups.
- Backup restoration testing.
- Rollback planning.
- Production monitoring.
- Event-time deployment freeze.
- Emergency deployment procedure.
- Production smoke testing.
- Disaster recovery planning.

TBD:

- Final VM specifications.
- Operating system.
- Exact domain.
- Exact Cloudflare configuration.
- Reverse proxy choice.
- Process manager.
- CI/CD implementation.
- Staging infrastructure.
- Backup provider.
- Backup frequency.
- RPO.
- RTO.
- Monitoring stack.
- Log management stack.
- Exact production deployment mechanism.
- Final Google Workspace/OAuth configuration.

---

# 96. Final Principle

> **Deploying Convoquer'26 is not finished when the website opens. It is finished when the system is verified, recoverable, secure, and ready to survive the event.**
