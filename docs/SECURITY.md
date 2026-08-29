# Convoquer'26 Digital Platform — Security Specification

**Project:** Convoquer'26 Digital Platform  
**Institute:** Indian Institute of Technology Jammu  
**Event:** Convoquer'26  
**Backend:** NestJS  
**Frontend:** Next.js  
**Database:** PostgreSQL  
**ORM:** Prisma  
**Authentication:** Google OAuth  
**Session Model:** Database-backed sessions  
**Infrastructure Protection:** Cloudflare  
**Document Version:** 1.0  
**Status:** Approved Security Baseline

---

# 1. Purpose

This document defines the security architecture and security requirements for the Convoquer'26 Digital Platform.

The platform will handle:

- Organizer accounts.
- Institutional authentication.
- Participant information.
- Team information.
- Competition fixtures.
- Live scores.
- Results.
- Standings.
- Institute rankings.
- Organizer operations.
- Media.
- Sponsor information.
- Internal communications.
- Administrative functions.

The security architecture must protect these resources against:

- Unauthorized access.
- Session theft.
- Account compromise.
- Privilege escalation.
- Score manipulation.
- Result manipulation.
- Database compromise.
- API abuse.
- Data leakage.
- Malicious uploads.
- Cross-site attacks.
- Accidental organizer misuse.

---

# 2. Security Philosophy

The platform follows:

> **Never trust the client.**

Anything received from the frontend must be considered untrusted.

```text
Client
   ↓
Untrusted Request
   ↓
Authentication
   ↓
Authorization
   ↓
Validation
   ↓
Business Rules
   ↓
Database Transaction
```

The frontend is responsible for presentation.

The backend is responsible for security.

---

# 3. Security Objectives

The platform must provide:

1. Strong organizer authentication.
2. Secure session management.
3. Server-side authorization.
4. Least-privilege access.
5. Object-level authorization.
6. Protection against score manipulation.
7. Protection against result manipulation.
8. Protection against session theft.
9. Protection against database compromise.
10. Complete auditing of critical actions.
11. Secure handling of personal information.
12. Secure file imports.
13. Secure WebSocket communication.
14. Secure production deployment.
15. Recoverability after security incidents.

---

# 4. Threat Model

The system should assume that an attacker may:

```text
- Inspect frontend JavaScript.
- Inspect API requests.
- Modify requests.
- Call APIs directly.
- Guess resource identifiers.
- Obtain publicly visible UUIDs.
- Attempt session theft.
- Copy authentication cookies.
- Attempt privilege escalation.
- Submit malicious input.
- Upload malicious files.
- Attempt SQL injection.
- Attempt XSS.
- Attempt CSRF.
- Attempt WebSocket abuse.
- Attempt database access.
- Attempt to manipulate scores.
- Attempt to manipulate results.
```

The system must remain secure even when the attacker has complete knowledge of the frontend implementation.

---

# 5. Security Boundary

The production architecture is:

```text
Internet
   ↓
Cloudflare
   ↓
Reverse Proxy / Web Server
   ↓
Next.js / NestJS
   ↓
Application Services
   ↓
Prisma
   ↓
PostgreSQL
```

PostgreSQL must never be publicly accessible.

---

# 6. Trust Boundaries

Important trust boundaries include:

```text
Browser → Server
Google → Authentication System
Cloudflare → Application
Application → Database
Application → File Storage
WebSocket Client → WebSocket Server
Developer → Production Environment
```

Each boundary must validate incoming information.

---

# 7. Authentication

Organizer authentication will use Google OAuth.

Only eligible IIT Jammu institutional accounts may access the organizer platform.

Required domain:

```text
@iitjammu.ac.in
```

Example:

```text
2026uma0220@iitjammu.ac.in
```

---

# 8. Email Verification

The frontend must never determine whether an email belongs to IIT Jammu.

The backend must validate the identity received through the OAuth provider.

The backend must verify:

```text
Provider Identity
        ↓
Verified Email
        ↓
Institutional Domain
        ↓
Application User
```

---

# 9. Google OAuth Security

The OAuth implementation must:

- Use the official OAuth flow.
- Validate OAuth state.
- Validate callback parameters.
- Verify the authenticated identity.
- Never expose OAuth client secrets to the browser.
- Never store unnecessary OAuth credentials.
- Use HTTPS in production.

---

# 10. Authentication Does Not Equal Authorization

A valid IIT Jammu account does not automatically become an organizer.

Example:

```text
Google Authentication
        ↓
Valid IIT Jammu Account
        ↓
Application User
        ↓
Organizer Role?
        ↓
YES / NO
```

Only users with appropriate roles can access organizer functionality.

---

# 11. Session Architecture

The platform will use database-backed sessions.

Conceptually:

```text
Browser
   │
   │ Secure Cookie
   ▼
Session Identifier
   │
   ▼
Server
   │
   ▼
Session Database Record
   │
   ├── User
   ├── Created At
   ├── Last Used
   ├── Expiry
   ├── IP Information
   ├── User Agent Information
   └── Revocation State
```

The exact schema is defined in `DATABASE.md`.

---

# 12. Session Cookie

The session cookie must use appropriate security attributes:

```text
HttpOnly
Secure
SameSite
```

The exact `SameSite` configuration depends on the final deployment architecture.

---

# 13. HttpOnly

Session cookies should be `HttpOnly`.

This prevents normal client-side JavaScript from directly reading the session credential.

---

# 14. Secure

Production authentication cookies must use:

```text
Secure
```

so browsers send them only over HTTPS.

---

# 15. SameSite

The application should use an appropriate SameSite policy to reduce CSRF risk.

The final setting must be tested against the Google authentication flow and production domain architecture.

---

# 16. Session Expiration

Sessions must have expiration rules.

The system should distinguish between:

```text
Absolute Session Lifetime
Idle Session Lifetime
```

The final values should be determined during implementation/testing.

---

# 17. Session Revocation

A session must be revocable server-side.

Possible causes:

```text
User logout
Administrator revocation
User suspension
Security incident
Credential compromise
Role removal
```

---

# 18. Multiple Sessions

A user may have multiple legitimate sessions.

Example:

```text
Laptop
Mobile
Office Computer
```

Each session should have an independent server-side record.

---

# 19. Session Visibility

Authorized administrators may view active sessions where permitted.

Possible information:

```text
Session ID / Internal Identifier
Created At
Last Activity
IP Address
User Agent
Approximate Device Information
Expiry
Status
```

Raw authentication credentials must never be displayed.

---

# 20. Session Token Storage

Raw session credentials should not be stored in the database if avoidable.

The database should store an appropriate secure representation such as a cryptographic hash.

Conceptually:

```text
Browser
   ↓
Session Secret
   ↓
Hash
   ↓
Database
```

If the database is compromised, raw session credentials should not be immediately usable.

---

# 21. Session Theft

The platform must assume that an attacker may obtain a valid session credential.

Protection therefore cannot rely solely on possession of the credential.

Every request should additionally be evaluated against:

```text
Session Status
User Status
Current Authorization
Resource Scope
```

---

# 22. IP Address Tracking

Session records should contain IP information.

This is useful for:

- Audit.
- Security investigations.
- Detecting unusual session changes.
- Detecting potentially stolen sessions.

---

# 23. IP Binding Policy

A session should **not** be permanently invalidated merely because its IP address changes.

Legitimate causes include:

```text
Mobile networks
VPNs
Institutional networks
ISP changes
Network switching
```

Instead, significant changes may trigger additional security checks or session revocation.

---

# 24. Suspicious Session Change

Example:

```text
Session created
IP = A

Later request
IP = B
```

The system may record:

```text
IP_CHANGED
```

and evaluate the change based on the security policy.

A major anomaly may result in:

```text
Re-authentication
or
Session Revocation
```

---

# 25. Session User-Agent Tracking

The server should record the user agent or an appropriate device fingerprint signal.

This can help identify:

```text
Browser change
Device change
Suspicious session reuse
```

It must not be treated as perfect proof of device identity.

---

# 26. Copied Session Credential

If an attacker copies a session credential and uses it elsewhere:

```text
Attacker
   ↓
Copied Credential
   ↓
Server
   ↓
Session Validation
   ↓
Anomaly Detection / Authorization
```

The system should be able to revoke the compromised session.

The security architecture should not assume that a session credential can never be stolen.

---

# 27. Session Fixation

The application must prevent session fixation.

A new authenticated session must be established after successful authentication.

The pre-authentication state must not become the authenticated session.

---

# 28. Logout

Logout must invalidate the current server-side session.

Deleting a browser cookie alone is insufficient.

Correct:

```text
Browser
 ↓
Logout
 ↓
Server
 ↓
Session Revoked
 ↓
Cookie Invalidated
```

---

# 29. Logout From All Devices

Authorized users/administrators may revoke all active sessions where appropriate.

Example:

```text
POST /users/:id/sessions/revoke-all
```

---

# 30. Authorization

Authorization is defined in `RBAC.md`.

The server must evaluate:

```text
Authentication
+
Role
+
Permission
+
Scope
+
Resource
+
Business Rules
```

---

# 31. Default Deny

If authorization cannot be established:

```text
DENY
```

The server must never assume permission.

---

# 32. Object-Level Authorization

Possessing a valid permission is not enough.

Example:

```text
Football Sports Coordinator
```

must not be able to modify:

```text
Cricket Match
```

simply because they possess:

```text
score.update
```

---

# 33. UUID Security

Database resources should use random UUID identifiers.

Example:

```text
550e8400-e29b-41d4-a716-446655440000
```

UUIDs reduce predictable sequential enumeration.

However:

> UUIDs are identifiers, not authorization.

Knowing a UUID must never grant access.

---

# 34. UUID Access Example

```text
Attacker
 ↓
Obtains Match UUID
 ↓
PATCH /matches/<uuid>/score
 ↓
Authentication
 ↓
Permission
 ↓
Sport Scope
 ↓
Resource Authorization
 ↓
DENY
```

---

# 35. API Security

Every protected API must perform:

```text
Session Validation
Authorization
Input Validation
Resource Authorization
Business Rule Validation
```

---

# 36. Direct API Access

Security must not depend on the official frontend.

An attacker may use:

```text
curl
Postman
Python
Browser DevTools
Custom Scripts
```

The server must respond securely regardless of the client.

---

# 37. Frontend Security Checks

Frontend authorization checks are for UX only.

Example:

```text
if (!canUpdateScore) {
    hideButton();
}
```

is useful.

But the backend must independently enforce:

```text
score.update
```

---

# 38. Privilege Escalation

Users must not be able to modify their own:

```text
Role
Permissions
Department
Sport Scope
Administrative Status
```

unless the action is explicitly authorized.

---

# 39. Role Assignment Security

Role assignment is highly privileged.

A user may only assign roles they are authorized to delegate.

No ordinary user should be able to make themselves:

```text
CONVENER
```

or equivalent.

---

# 40. Horizontal Privilege Escalation

The system must prevent users from accessing another user's resources.

Example:

```text
Volunteer A
```

must not be able to access:

```text
Volunteer B's private assignment data
```

unless authorized.

---

# 41. Vertical Privilege Escalation

The system must prevent lower-level users from invoking higher-level operations.

Example:

```text
Volunteer
```

must not be able to call:

```text
POST /results/:id/override
```

successfully.

---

# 42. Score Integrity

Score manipulation is one of the highest-priority security concerns.

The server must never accept an arbitrary final score without validation.

---

# 43. Live Score Flow

```text
Sports Coordinator
       ↓
Score Event
       ↓
Authentication
       ↓
Authorization
       ↓
Sport Scope
       ↓
Match State
       ↓
Score Validation
       ↓
Database Transaction
       ↓
Audit
       ↓
Realtime Broadcast
```

---

# 44. Score Event Validation

The backend must validate:

- Match exists.
- Match is active.
- User has authority.
- User has correct sport scope.
- Event type is valid.
- Participant belongs to the match.
- Score transition is valid.
- Event is not duplicated.
- Match state allows the event.

---

# 45. Score Transactions

Score modifications must use database transactions where multiple records are modified.

Example:

```text
BEGIN
 ↓
Insert Score Event
 ↓
Update Current Score
 ↓
Update Match State
 ↓
Create Audit Log
 ↓
COMMIT
```

If any step fails:

```text
ROLLBACK
```

---

# 46. Duplicate Score Prevention

The system must prevent accidental duplicate score events caused by:

```text
Double-click
Network retry
Browser retry
WebSocket retry
Client bug
```

Idempotency keys or unique event identifiers should be used where appropriate.

---

# 47. Concurrency

Two operators must not be able to accidentally overwrite each other's score changes.

Where necessary, use:

```text
Transactions
Optimistic Concurrency
Version Numbers
Database Constraints
```

---

# 48. Result Integrity

Result submission and result approval must be separate operations.

```text
Result Submitted
       ↓
Pending Approval
       ↓
Authorized Approval
       ↓
Official Result
```

---

# 49. Result Override

Result overrides are highly sensitive.

They must:

- Require elevated permission.
- Validate the replacement result.
- Require a reason.
- Be audited.
- Trigger necessary standings/ranking recalculation.
- Trigger appropriate realtime updates.

---

# 50. Published Data

Once results are officially published:

```text
PUBLISHED
```

normal editing should not silently overwrite them.

Corrections should use a controlled process.

---

# 51. Standings Integrity

Standings must be derived from authoritative results.

The client must never be able to submit:

```text
Team A = 100 points
```

and have the server accept it as the official standings value.

---

# 52. Ranking Integrity

Overall institute ranking must be calculated from authoritative competition data according to the official formula.

The formula should be implemented server-side.

---

# 53. Database Security

PostgreSQL must not be exposed directly to the public Internet.

Only the backend should access the production database.

---

# 54. Database Credentials

Database credentials must never be:

```text
Committed to Git
Hard-coded
Included in frontend code
Included in API responses
Included in screenshots
```

---

# 55. Environment Variables

Secrets should be stored using environment variables or an appropriate secrets-management mechanism.

Examples:

```text
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SESSION_SECRET
```

The exact variables depend on the implementation.

---

# 56. `.env` Security

Local environment files containing secrets must not be committed.

The repository should include:

```text
.env.example
```

containing placeholders only.

Example:

```text
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

# 57. Git Security

Never commit:

```text
.env
Private Keys
OAuth Secrets
Database Passwords
Production Credentials
Session Secrets
API Keys
```

---

# 58. Secret Rotation

The project should support secret rotation.

At minimum:

- Google OAuth credentials.
- Session secrets.
- Database credentials.

Rotation procedures should be documented before production deployment.

---

# 59. Database User Permissions

The application database account should receive only the privileges required by the application.

Do not use a PostgreSQL superuser as the application's normal runtime account.

---

# 60. Database Network Access

Production PostgreSQL should accept connections only from trusted application infrastructure.

---

# 61. SQL Injection

Prisma's parameterized query mechanisms should be used.

Raw SQL should only be used when necessary and must be safely parameterized.

---

# 62. Database Constraints

Important integrity rules should be enforced at the database level where practical.

Examples:

```text
Unique email
Unique role assignment where appropriate
Foreign key relationships
Valid status relationships
Unique score event identifiers
```

Application validation alone is insufficient for critical invariants.

---

# 63. XSS Protection

The application must protect against Cross-Site Scripting.

Potential attack locations include:

```text
News
Announcements
Team names
Participant names
Sponsor descriptions
Media metadata
User-generated content
```

---

# 64. Output Encoding

User-controlled text must be safely rendered.

HTML should not be rendered from untrusted content unless it has been appropriately sanitized.

---

# 65. Rich Text

If rich text is supported:

```text
Input
 ↓
Sanitization
 ↓
Safe Storage / Representation
 ↓
Safe Rendering
```

Never directly render arbitrary HTML submitted by users.

---

# 66. CSRF Protection

Because authentication uses cookies, state-changing requests must be protected against CSRF.

Possible protections include:

```text
SameSite cookies
Origin checking
CSRF tokens
```

The final combination depends on the authentication implementation.

---

# 67. CORS

Production CORS configuration must explicitly allow only trusted origins.

Avoid:

```text
Access-Control-Allow-Origin: *
```

for authenticated APIs.

---

# 68. Security Headers

The production web application should configure appropriate security headers.

Relevant headers may include:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Strict-Transport-Security
Permissions-Policy
```

The exact policy must be tested against Next.js and required third-party resources.

---

# 69. Content Security Policy

A Content Security Policy should be introduced carefully.

It should restrict:

```text
Scripts
Frames
Images
Connections
Styles
```

to trusted sources.

Google authentication and media providers must be considered when designing the final policy.

---

# 70. HTTPS

Production must use HTTPS.

HTTP should redirect to HTTPS where appropriate.

---

# 71. HSTS

After confirming the production HTTPS configuration, HTTP Strict Transport Security may be enabled.

---

# 72. WebSocket Security

WebSocket connections must not bypass normal authorization principles.

For organizer WebSocket connections:

```text
Authentication
 ↓
Session Validation
 ↓
Authorization
 ↓
Subscription
```

---

# 73. Public WebSocket Channels

Public live-score channels may be readable without authentication if their data is already public.

Write operations must never be exposed through an unauthenticated public channel.

---

# 74. WebSocket Message Validation

All incoming WebSocket messages must be validated.

The server must not trust:

```text
event type
match ID
score
user ID
role
```

provided by the client.

---

# 75. WebSocket Subscription Security

A user should only subscribe to channels they are authorized to access.

Public channels are an exception because their information is intentionally public.

---

# 76. Realtime Event Integrity

The server generates authoritative events.

Clients must not be able to broadcast:

```text
match.score.updated
result.approved
```

to other clients.

---

# 77. File Upload Security

Uploaded files must be treated as untrusted.

The server must validate:

```text
File Size
File Type
MIME Type
File Content
Extension
Authorization
```

---

# 78. Participant Excel Import

Participant imports require elevated permissions.

Recommended workflow:

```text
Upload
 ↓
Parse
 ↓
Validate
 ↓
Preview
 ↓
Authorized Confirmation
 ↓
Transactional Import
 ↓
Audit
```

---

# 79. Malicious Spreadsheet Handling

Excel files may contain malicious or unexpected content.

The application must not:

- Execute spreadsheet macros.
- Trust formulas as server-side instructions.
- Execute embedded scripts.
- Treat cell contents as HTML.

Imported values must be treated as data.

---

# 80. File Storage

Uploaded files should not automatically be stored inside executable application directories.

Storage should be isolated appropriately.

---

# 81. File Access Authorization

Private organizer files must require authorization.

Public media may be served publicly only after explicit publication.

---

# 82. Path Traversal

Uploaded filenames must never directly determine filesystem paths.

Avoid:

```text
/uploads/<user-provided-filename>
```

without safe normalization/storage handling.

---

# 83. Content-Disposition

Where appropriate, downloaded files should use safe content-disposition headers.

---

# 84. API Input Validation

Every API request must validate incoming data.

Validation should include:

```text
Type
Length
Format
Allowed Values
Relationships
Business Rules
Authorization Scope
```

---

# 85. Request Size

Reasonable request-size limits should be configured.

Particularly for:

```text
File uploads
Bulk imports
Large JSON payloads
Rich content
```

---

# 86. Error Handling

Production errors must not expose:

```text
Stack traces
SQL queries
Environment variables
Filesystem paths
Secrets
Internal architecture details
```

---

# 87. Error Messages

Errors should provide enough information for legitimate users without helping attackers.

Bad:

```text
PostgreSQL error: relation public.users does not exist
```

Good:

```text
An internal error occurred.
```

The detailed error is logged server-side.

---

# 88. Logging

The application should maintain structured logs.

Useful fields include:

```text
Timestamp
Request ID
User ID
Route
HTTP Method
Status
Duration
Relevant Resource ID
```

Sensitive data must not be logged unnecessarily.

---

# 89. Security Logging

Security-relevant events should be logged.

Examples:

```text
Login Success
Login Failure
Session Created
Session Revoked
User Suspended
Role Assigned
Role Revoked
Permission Change
Unauthorized Request
Result Override
Critical Score Change
Participant Import
```

---

# 90. Audit Logs vs Application Logs

These are different.

Application logs:

```text
Operational debugging
```

Audit logs:

```text
Accountability for important actions
```

Critical business actions must be recorded in the audit system.

---

# 91. Audit Log Integrity

Audit logs must be append-oriented.

Ordinary users must never be able to:

```text
Edit Audit
Delete Audit
```

---

# 92. Audit Record

A critical action should record:

```text
Actor
Action
Resource Type
Resource ID
Previous State
New State
Timestamp
Session
IP
Reason
```

Sensitive information should only be recorded where necessary.

---

# 93. Score Audit Example

```text
Actor:
Sports Coordinator

Action:
SCORE_UPDATED

Match:
<UUID>

Previous Score:
2–1

New Score:
3–1

Timestamp:
<timestamp>

Session:
<session identifier>

IP:
<IP>

Reason:
<optional>
```

---

# 94. Result Override Audit

```text
Actor:
Co-Convener

Action:
RESULT_OVERRIDE

Result:
<UUID>

Previous:
Team A — 2
Team B — 1

New:
Team A — 1
Team B — 2

Reason:
Official verification.

Timestamp:
<timestamp>
```

---

# 95. Sensitive Personal Data

Participant data may include:

```text
Name
Photograph
Institute
Roll Number
Gender
DOB
Contact Number
```

Not every organizer needs access to every field.

The API must return only fields required for the requester's role.

---

# 96. Data Minimization

The system should follow:

> Collect and expose only what is required.

If a department only needs:

```text
Name
Institute
Sport
Venue
```

it should not automatically receive:

```text
DOB
Contact Number
```

---

# 97. Public Participant Information

The public website should only display participant information explicitly approved for public display.

---

# 98. Organizer Data Isolation

Department-specific dashboards must expose only the information required by that department.

Examples:

```text
Hospitality
→ Participant logistics

Media
→ Media content

Sports
→ Competition information

Management
→ Scheduling and operations

Web
→ Technical information
```

---

# 99. Account Suspension

Suspending a user should:

1. Change the account state.
2. Revoke active sessions where appropriate.
3. Prevent new authenticated operations.
4. Record an audit entry.

---

# 100. Deactivation

Deactivated users should not be able to authenticate into organizer functionality.

Historical audit records should remain attributable to the original user.

---

# 101. Account Recovery

Account recovery should rely on the institutional Google account.

The application should not introduce an independent password-reset system unless explicitly required.

---

# 102. Brute Force Protection

Application-level rate limiting is not part of the initial application security requirement.

Infrastructure-level protection such as Cloudflare may be used to mitigate automated attacks.

Authentication and authorization must remain independent of this protection.

---

# 103. Cloudflare

Cloudflare may provide:

```text
DDoS Protection
Bot Mitigation
Traffic Filtering
TLS Termination
WAF Capabilities
```

The exact Cloudflare configuration will be finalized during deployment.

---

# 104. Cloudflare Is Not an Authorization Layer

Even if Cloudflare allows a request:

```text
Application
   ↓
Authentication
   ↓
Authorization
```

must still occur.

---

# 105. Database Backups

Production database backups should be configured before the event.

Backups should be:

- Automated.
- Protected.
- Access-controlled.
- Tested.

---

# 106. Backup Encryption

Backups should be encrypted at rest where supported by the chosen infrastructure.

---

# 107. Backup Testing

A backup that has never been restored is not considered verified.

At least one restoration test should be performed before the event.

---

# 108. Recovery

The team should know:

```text
Where the backup is.
How to restore it.
Who is authorized to restore it.
How to redeploy the application.
How to rotate credentials.
```

---

# 109. Incident Response

If a security incident occurs:

```text
Detect
 ↓
Contain
 ↓
Revoke Sessions
 ↓
Disable Compromised Account
 ↓
Preserve Logs
 ↓
Investigate
 ↓
Correct
 ↓
Rotate Secrets
 ↓
Restore if Necessary
 ↓
Verify
```

---

# 110. Suspected Session Compromise

If a session is suspected to be compromised:

1. Revoke the session.
2. Investigate associated activity.
3. Review IP/device information.
4. Review audit logs.
5. Re-authenticate the legitimate user.
6. Escalate if necessary.

---

# 111. Suspected Organizer Account Compromise

If an organizer account is compromised:

```text
Suspend User
 ↓
Revoke All Sessions
 ↓
Review Audit Logs
 ↓
Review Critical Actions
 ↓
Rotate Relevant Credentials
 ↓
Restore Correct Data
```

---

# 112. Score Manipulation Incident

If unauthorized score modification is detected:

```text
Identify Match
 ↓
Identify Actor
 ↓
Review Audit
 ↓
Freeze Further Modification if Necessary
 ↓
Verify Official Score
 ↓
Correct Result
 ↓
Recalculate Standings
 ↓
Publish Correction
```

---

# 113. Database Compromise

If database credentials are suspected to be compromised:

1. Restrict database access.
2. Rotate credentials.
3. Revoke affected sessions if necessary.
4. Inspect database activity.
5. Verify data integrity.
6. Review application logs.
7. Restore from backup if required.

---

# 114. Developer Security

All developers must follow repository security rules.

Developers must not:

```text
Commit secrets
Share production credentials
Directly modify production database without authorization
Disable security checks to "make it work"
Bypass RBAC for convenience
Commit debug authentication mechanisms
```

---

# 115. Development vs Production

Development and production environments must be separated.

Example:

```text
Development
PostgreSQL
OAuth
Secrets
```

must not automatically point to production resources.

---

# 116. Production Database Access

Production database access should be limited to authorized personnel.

Developers should generally use:

```text
Local Database
Staging Database
```

for development.

---

# 117. Debug Mode

Debug functionality must not remain enabled in production.

---

# 118. Test Accounts

Test accounts must never have real production privileges.

---

# 119. Dependency Security

Dependencies should be kept reasonably up to date.

Before production deployment:

```text
Dependency Audit
 ↓
Review Critical Vulnerabilities
 ↓
Update Where Appropriate
 ↓
Retest
```

---

# 120. GitHub Security

The repository should use:

```text
Protected Main Branch
Pull Requests
Code Review
Environment Secrets
```

where practical.

---

# 121. Branch Protection

Production code should not depend on direct unreviewed pushes to the main branch.

Recommended workflow:

```text
Feature Branch
 ↓
Pull Request
 ↓
Review
 ↓
Automated Checks
 ↓
Merge
```

---

# 122. Automated Security Checks

CI should eventually perform:

```text
Lint
Formatting
Type Checking
Tests
Build
Dependency Audit
```

The exact tools are defined in the development workflow documentation.

---

# 123. Code Formatting

A standardized formatter must be used across the project.

The repository should automatically check:

```text
Indentation
Spacing
Line Breaks
Quotes
Trailing Commas
Formatting
```

Developers should not manually debate formatting.

---

# 124. Security Testing

Security tests must include:

```text
Unauthorized API Access
Wrong Role
Wrong Sport Scope
Wrong Resource
Revoked Session
Expired Session
Suspended User
Invalid UUID
Tampered Request
Duplicate Score Event
Unauthorized Result Approval
Unauthorized Role Assignment
```

---

# 125. API Security Testing Example

```text
User A
 ↓
Valid Session
 ↓
score.update
 ↓
Football
 ↓
Cricket Match
 ↓
403 Forbidden
```

---

# 126. Session Security Testing

Test:

```text
Valid Session → ALLOW

Revoked Session → DENY

Expired Session → DENY

Suspended User → DENY

Copied Credential + Suspicious Context → Security Response

Logout → Session Invalidated
```

---

# 127. UUID Testing

Test:

```text
Known UUID
+
Unauthorized User
=
DENY
```

This test is mandatory.

---

# 128. Role Escalation Testing

Test attempts such as:

```text
Volunteer → Convener
Sports Coordinator → Co-Convener
Media Member → Media Head
```

through:

- API requests.
- Modified frontend state.
- Direct database IDs.
- Crafted JSON payloads.

All unauthorized attempts must fail.

---

# 129. Score Integrity Testing

Test:

```text
Unauthorized score update
Invalid score
Duplicate score event
Wrong participant
Wrong match
Wrong sport
Completed match modification
Concurrent score updates
```

---

# 130. Result Integrity Testing

Test:

```text
Unauthorized submission
Unauthorized approval
Unauthorized override
Invalid result
Duplicate submission
Override without reason
Override with stale version
```

---

# 131. WebSocket Testing

Test:

```text
Unauthorized subscription
Unauthorized message
Fake score event
Fake result event
Invalid match ID
Malformed payload
Disconnected client
Reconnection
```

---

# 132. Import Security Testing

Test:

```text
Invalid file
Oversized file
Wrong extension
Malformed spreadsheet
Duplicate participants
Missing required fields
Unauthorized import
Partial import failure
Repeated import
```

---

# 133. Security Checklist — Authentication

```text
[ ] Google OAuth implemented securely
[ ] IIT Jammu domain verified server-side
[ ] OAuth state validated
[ ] HTTPS enabled
[ ] Secure cookie configured
[ ] HttpOnly configured
[ ] SameSite configured
[ ] Session stored server-side
[ ] Session revocation implemented
[ ] Session expiration implemented
```

---

# 134. Security Checklist — Authorization

```text
[ ] Default deny
[ ] Server-side RBAC
[ ] Permission checks
[ ] Scope checks
[ ] Object-level authorization
[ ] Multiple-role support
[ ] Role revocation
[ ] User suspension
[ ] No client-trusted roles
[ ] No client-trusted permissions
```

---

# 135. Security Checklist — Competition

```text
[ ] Score validation
[ ] Score transactions
[ ] Duplicate event protection
[ ] Concurrency protection
[ ] Result approval
[ ] Result override authorization
[ ] Result audit
[ ] Standings derived server-side
[ ] Ranking derived server-side
[ ] Published result protection
```

---

# 136. Security Checklist — Database

```text
[ ] PostgreSQL not publicly accessible
[ ] Strong credentials
[ ] Secrets not committed
[ ] Database least privilege
[ ] Foreign keys
[ ] Unique constraints
[ ] Transactions
[ ] Backups
[ ] Restore test
```

---

# 137. Security Checklist — API

```text
[ ] DTO validation
[ ] Authentication guards
[ ] Authorization guards
[ ] Scope validation
[ ] Error sanitization
[ ] CORS configuration
[ ] CSRF protection
[ ] Secure headers
[ ] Request size limits
[ ] File validation
```

---

# 138. Security Checklist — Deployment

```text
[ ] HTTPS
[ ] Cloudflare configured
[ ] Production secrets configured securely
[ ] Debug mode disabled
[ ] Database firewall configured
[ ] Backups configured
[ ] Logs available
[ ] Monitoring available
[ ] Rollback procedure tested
```

---

# 139. Minimum Security Requirements for V1

Before production, the following are mandatory:

### Authentication

- Google OAuth.
- IIT Jammu account verification.
- Secure sessions.

### Authorization

- Server-side RBAC.
- Permission checks.
- Scope checks.
- Object-level authorization.

### Competition

- Secure score updates.
- Result approval.
- Transactional critical operations.
- Audit logging.

### Infrastructure

- HTTPS.
- Protected PostgreSQL.
- Secure secrets.
- Cloudflare/infrastructure protection.

### Data

- DTO-based responses.
- Sensitive-field filtering.
- Secure imports.

### Recovery

- Database backup.
- Restore procedure.
- Session revocation procedure.

---

# 140. Recommended Hardening

If development time permits:

```text
Content Security Policy
Advanced session anomaly detection
Automated dependency scanning
Automated security tests
Database activity monitoring
Enhanced audit dashboards
Security incident alerts
Automated backup verification
```

These should not delay the mandatory security requirements.

---

# 141. Security Priority Levels

## P0 — Mandatory

```text
Authentication
Session Security
RBAC
Object Authorization
Score Integrity
Result Integrity
Database Security
Secrets
HTTPS
Audit Logs
Backups
```

## P1 — Strongly Recommended

```text
CSRF Hardening
Security Headers
Dependency Scanning
Automated Security Tests
Session Anomaly Detection
```

## P2 — Optional Hardening

```text
Advanced Monitoring
Enhanced Intrusion Detection
Automated Security Alerting
Advanced Forensics
```

---

# 142. Security Principle for the Development Team

When implementing a feature, ask:

```text
1. Who can access this?
2. Who can modify this?
3. What scope applies?
4. What happens if the user is malicious?
5. What happens if the UUID is known?
6. What happens if the request is manually crafted?
7. What happens if the session is stolen?
8. What gets audited?
9. What happens if two users modify it simultaneously?
10. Can the operation be undone safely?
```

---

# 143. Security Review Before Merge

Every security-sensitive pull request should answer:

```text
[ ] Authentication considered
[ ] Authorization considered
[ ] Scope considered
[ ] Input validated
[ ] Sensitive output reviewed
[ ] Audit requirement reviewed
[ ] Transaction requirement reviewed
[ ] Concurrency considered
[ ] Error handling reviewed
[ ] Tests added
```

---

# 144. Security Review Before Deployment

Before production deployment:

```text
Code
 ↓
Tests
 ↓
Security Tests
 ↓
Dependency Audit
 ↓
Environment Verification
 ↓
Database Backup
 ↓
Restore Verification
 ↓
Production Deployment
 ↓
Smoke Test
 ↓
Security Verification
```

---

# 145. Final Security Architecture

```text
                         INTERNET
                             │
                             ▼
                         CLOUDFLARE
                             │
                       HTTPS / WAF
                             │
                             ▼
                        NEXT.JS
                             │
                    HTTPS / WebSocket
                             │
                             ▼
                         NESTJS
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
       Authentication   Authorization    Validation
             │               │               │
             └───────────────┼───────────────┘
                             ▼
                      Business Logic
                             │
                             ▼
                         Prisma
                             │
                             ▼
                       PostgreSQL
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
          Audit          Competition       Sessions
           Logs             Data             Data
```

---

# 146. Security Model

The complete security model is:

```text
IDENTITY
   ↓
SESSION
   ↓
USER STATUS
   ↓
ROLE
   ↓
PERMISSION
   ↓
SCOPE
   ↓
RESOURCE AUTHORIZATION
   ↓
BUSINESS RULES
   ↓
TRANSACTION
   ↓
AUDIT
   ↓
REALTIME EVENT
```

Failure at any stage must prevent the protected operation.

---

# 147. Final Security Principle

> **A valid login does not grant trust.**

The platform must continuously establish that:

```text
The user is authenticated.
The session is valid.
The account is active.
The user has the required permission.
The permission applies to this scope.
The resource is accessible.
The operation is valid.
The modification is atomic.
The action is auditable.
```

Only then should the operation be executed.

---

# 148. Relationship to Other Documents

```text
PRD.md
   │
   ▼
ARCHITECTURE.md
   │
   ├── DATABASE.md
   │       │
   │       ▼
   │    Data Integrity
   │
   ├── RBAC.md
   │       │
   │       ▼
   │    Authorization
   │
   ├── API_SPEC.md
   │       │
   │       ▼
   │    API Security
   │
   └── SECURITY.md
           │
           ▼
      Security Controls
           │
           ▼
      Implementation
```

---

# 149. Status

**Approved Security Baseline**

Confirmed:

- Google OAuth.
- IIT Jammu institutional authentication.
- Database-backed sessions.
- Secure session cookies.
- Server-side authorization.
- RBAC.
- Permission + scope model.
- Object-level authorization.
- UUID resource identifiers.
- IP/session metadata.
- Session revocation.
- No permanent IP binding.
- Live-score integrity controls.
- Result approval.
- Result override auditing.
- Transactional critical operations.
- PostgreSQL isolation.
- Secure secret management.
- HTTPS.
- Cloudflare infrastructure protection.
- File/import validation.
- Audit logging.
- Backup and recovery requirements.
- Security testing requirements.
- No application-level rate limiting in the initial design.

TBD:

- Exact session expiration values.
- Exact anomaly-detection policy.
- Final CSRF implementation.
- Final CSP.
- Cloudflare configuration.
- Final production infrastructure.
- Final media storage provider.
- Exact backup provider and retention.
- Final incident-response authority.

---

# 150. Final Principle

> **The platform should assume that the browser is compromised, the API is known, UUIDs are public, requests can be modified, and credentials can potentially be stolen — and should still protect the competition data.**
