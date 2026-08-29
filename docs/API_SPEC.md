# Convoquer'26 Digital Platform — Role-Based Access Control

**Project:** Convoquer'26 Digital Platform  
**Institute:** Indian Institute of Technology Jammu  
**Event:** Convoquer'26  
**Document Version:** 1.0  
**Status:** Approved RBAC Baseline

---

# 1. Purpose

This document defines the Role-Based Access Control (RBAC) architecture of the Convoquer'26 Digital Platform.

It answers:

> **Who can do what, where, and under what conditions?**

The RBAC system is responsible for protecting:

- Competition data.
- Scores.
- Results.
- Tournament structures.
- Participant information.
- Organizer operations.
- Media.
- Announcements.
- User accounts.
- Roles and permissions.
- Sessions.
- System configuration.

---

# 2. Core Security Principle

The platform follows:

> **Least Privilege.**

Every authenticated person should receive:

> **Neither more nor less access than required to perform their responsibilities.**

A user's organizational position does not automatically imply unrestricted technical access.

---

# 3. Authentication vs Authorization

Authentication and authorization are separate.

## Authentication

Answers:

> Who is this person?

The platform uses Google authentication and IIT Jammu institutional accounts.

```text
Google
   ↓
Verified Identity
   ↓
IIT Jammu Domain
   ↓
Application User
```

## Authorization

Answers:

> What is this person allowed to do?

```text
User
 ↓
Role
 ↓
Permission
 ↓
Scope
 ↓
Resource
```

Being successfully authenticated does not automatically make a person an organizer.

---

# 4. Authorization Model

The platform uses:

```text
USER
 │
 ├── ROLES
 │
 ├── PERMISSIONS
 │
 ├── SCOPES
 │
 └── ASSIGNMENTS
```

Effective authorization is determined by all four.

---

# 5. Role

A Role represents an organizational or functional position.

Examples:

```text
CONVENER
CO_CONVENER
HOSPITALITY_SECURITY_HEAD
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

Additional roles may be introduced later.

---

# 6. Permission

A Permission is an atomic capability.

Examples:

```text
match.view
match.create
match.update

score.view
score.update

result.view
result.submit
result.approve
result.override

team.view
team.create
team.update

user.view
user.create
user.update
user.suspend

role.view
role.assign
role.revoke

audit.view

media.create
media.update
media.publish

task.create
task.assign
task.update
```

---

# 7. Scope

Scope determines **where** a permission applies.

Possible scopes:

```text
GLOBAL
EVENT
DEPARTMENT
SPORT
TOURNAMENT
VENUE
ASSIGNMENT
OWN
PUBLIC
```

Example:

```text
Permission:
score.update

Scope:
SPORT = Football
```

The user can therefore update scores for Football matches within their authorized scope, but not Cricket.

---

# 8. Assignment

Assignments provide operational context.

For example:

```text
User:
Volunteer A

Role:
VOLUNTEER

Assignment:
Basketball Court
10:00–14:00
Participant Assistance
```

The Volunteer should see information relevant to this assignment rather than the entire organizer system.

---

# 9. Authorization Formula

Conceptually:

```text
ALLOW
IF

Authenticated
AND
Active User
AND
Valid Session
AND
Required Permission
AND
Correct Scope
AND
Resource Is Accessible
AND
Business Rules Permit Action
```

Otherwise:

```text
DENY
```

---

# 10. Server-Side Enforcement

All authorization must be enforced by the server.

Frontend checks are only for UI convenience.

This is insufficient:

```text
if (user.isSportsCoordinator) {
    showEditButton();
}
```

The backend must independently verify authorization.

---

# 11. Authorization Pipeline

Every protected operation follows:

```text
Request
   ↓
Session Validation
   ↓
User Status Check
   ↓
Role Resolution
   ↓
Permission Check
   ↓
Scope Check
   ↓
Resource Authorization
   ↓
Business Rule Validation
   ↓
Operation
```

---

# 12. User Status

A user must be active to perform authenticated operations.

Possible states:

```text
PENDING
ACTIVE
SUSPENDED
DEACTIVATED
```

Only `ACTIVE` users may perform normal organizer operations.

---

# 13. Session Requirement

A role assignment does not itself authenticate a user.

A request must contain a valid active session.

```text
User Role
   ≠
Active Session
```

Both are required.

---

# 14. Multiple Roles

A user may have multiple roles.

Example:

```text
User A
├── SPORTS_COORDINATOR
│     └── Football
│
└── MEDIA_MEMBER
```

The user receives permissions from both roles, subject to their respective scopes.

---

# 15. Multiple Role Resolution

The backend calculates effective permissions from applicable roles.

Conceptually:

```text
User
 │
 ├── Role A
 │     ├── Permission 1
 │     └── Permission 2
 │
 └── Role B
       ├── Permission 3
       └── Permission 4

             ↓

Effective Permissions
├── Permission 1
├── Permission 2
├── Permission 3
└── Permission 4
```

Scope restrictions remain applicable.

---

# 16. No Implicit Role Inheritance

Organizational hierarchy should not automatically mean technical permission inheritance.

For example:

```text
MEDIA_HEAD
```

does not automatically mean:

```text
CONVENER
```

permissions.

Permissions must be explicitly assigned.

---

# 17. Organizational Hierarchy

The organizational hierarchy is:

```text
CONVENER
   │
   ├── CO_CONVENER × 3
   │
   └── HEADS
        ├── Hospitality & Security
        ├── Management
        ├── Media
        ├── Design
        ├── Sponsorship
        ├── Overall Sports Coordinator
        └── Web Developer
             │
             └── Operational Teams / Coordinators / Volunteers
```

The organizing-policy document establishes this high-level hierarchy.

---

# 18. Convener

The Convener is the highest-authority application role.

The Convener has global authority across the platform.

Capabilities include:

```text
Users
Roles
Permissions
Sessions
Sports
Tournaments
Teams
Participants
Matches
Scores
Results
Standings
Venues
Tasks
Assignments
Media
Announcements
News
Sponsors
Imports
Audit Logs
System Configuration
```

The Convener may perform critical overrides.

---

# 19. Convener Override

The Convener may override ordinary business restrictions when organizationally necessary.

Examples:

```text
Correct an official result
Override a schedule
Correct a tournament configuration
Revoke a role
Revoke a session
Correct critical competition data
```

Overrides must always be audited.

---

# 20. Convener Auditability

Even though the Convener has absolute operational authority:

> **The Convener is not above the audit system.**

The system should record:

```text
Who
Action
Resource
Previous State
New State
Time
Session
IP
Reason
```

---

# 21. Co-Convener

There are three Co-Convener positions.

Each Co-Convener must have an independent account.

They should have broad operational authority comparable to the Convener.

However:

> Every Co-Convener action must remain individually attributable.

The system must never use a shared:

```text
co-convener@iitjammu.ac.in
```

account.

---

# 22. Co-Convener Critical Actions

Co-Conveners may perform sensitive operations where authorized.

Examples:

```text
Approve results
Modify schedules
Manage teams
Manage sports
Manage operational assignments
Manage organizers
```

Critical actions must be audited.

---

# 23. Hospitality & Security Head

The Hospitality & Security Head manages the hospitality/security operational domain.

The organizing policy assigns this Head responsibility for areas including accommodation, food, guest/player management, safety, crowd management and institute security coordination.

### Primary permissions

```text
participant.view
team.view
institute.view

schedule.view
match.view
venue.view

task.create
task.update
task.assign

assignment.view
assignment.create
assignment.update

hospitality.view
hospitality.update

internal_announcement.view
internal_announcement.create
```

### Explicit restrictions

The role should not automatically receive:

```text
score.update
result.approve
role.assign
permission.modify
system.configure
audit.delete
```

---

# 24. Hospitality Operational View

Hospitality should receive derived information useful for planning.

Examples:

```text
Institute A
├── Basketball: 12
├── Football: 18
└── Cricket: 15
```

and:

```text
Venue
├── Basketball Court
│     ├── Team A
│     ├── Team B
│     └── Volunteers
│
└── Football Ground
      ├── Team C
      └── Team D
```

This information should be generated from competition and assignment data.

---

# 25. Management Head

The Management Head manages event logistics and operational coordination.

The organizing policy assigns Management responsibility for scheduling, logistics and on-ground coordination.

### Primary permissions

```text
schedule.view
schedule.create
schedule.update

venue.view
venue.update

task.create
task.update
task.assign

assignment.view
assignment.create
assignment.update

match.view
team.view
```

### Restrictions

Management should not automatically receive:

```text
score.update
result.approve
role.assign
permission.modify
audit.modify
```

unless explicitly granted through an additional role/permission.

---

# 26. Media Head

The Media Head manages media operations.

The organizing policy assigns Media responsibility for social media, promotion, photography, videography and publicity.

### Permissions

```text
media.view
media.create
media.update
media.delete
media.publish

gallery.create
gallery.update
gallery.publish

news.create
news.update
news.publish

livestream.view
livestream.manage

announcement.create
announcement.update
```

### Restrictions

No automatic competition modification permissions.

---

# 27. Design Head

The Design Head manages design assets.

The organizing policy assigns Design responsibility for graphics, banners, posters and event branding.

### Permissions

```text
media.create
media.update
media.delete

design_asset.create
design_asset.update
design_asset.delete

gallery.view
sponsor.view
```

Design publication permissions may be granted where necessary.

Competition permissions are not automatically included.

---

# 28. Sponsorship Head

The Sponsorship Head manages sponsor information.

The organizing policy assigns Sponsorship responsibility for sponsor outreach and sponsor relations.

### Permissions

```text
sponsor.view
sponsor.create
sponsor.update
sponsor.delete
sponsor.publish
```

Private sponsor information, if stored, must have a more restricted scope.

---

# 29. Overall Sports Coordinator

The Overall Sports Coordinator has cross-sport competition-management responsibility.

The organizing policy assigns this position responsibility for coordination of sports events, match conduct, officials and gameplay issues.

### Primary permissions

```text
sport.view
sport.update

tournament.view
tournament.create
tournament.update

team.view
team.update

participant.view

fixture.view
fixture.create
fixture.update

match.view
match.create
match.update

score.view
score.update

result.view
result.submit
result.approve

standings.view

official.view
official.assign

schedule.view
schedule.update
```

Scope:

```text
ALL SPORTS
```

---

# 30. Sports Coordinator

A Sports Coordinator is assigned to a specific sport.

Example:

```text
User
└── SPORTS_COORDINATOR
       └── Sport = Football
```

### Permissions

```text
sport.view

tournament.view
tournament.update

team.view

participant.view

fixture.view
fixture.create
fixture.update

match.view
match.update

score.view
score.update

result.view
result.submit

standings.view
```

The exact permission set may be adjusted after final competition workflows are confirmed.

---

# 31. Sports Coordinator Scope

The most important restriction:

> A Sports Coordinator cannot automatically operate outside their assigned sport.

Example:

```text
Football Coordinator
```

can access:

```text
Football
```

but not:

```text
Cricket
Basketball
Chess
```

unless an additional authorized role/scope is assigned.

---

# 32. Sports Coordinator Assignment

Sports Coordinators are expected to be non-changeable through ordinary organizer operations.

Their official assignment should be managed by authorized higher-level administrators.

Once assigned:

```text
SPORTS_COORDINATOR
       ↓
SPORT = Football
```

should remain stable throughout the event unless an authorized administrative change occurs.

Any such change must be audited.

---

# 33. Volunteer

Volunteers receive task-oriented access.

A Volunteer should generally see:

```text
My Dashboard
My Tasks
My Assignments
My Schedule
Relevant Venues
Relevant Announcements
```

rather than the entire organizer system.

---

# 34. Volunteer Permissions

Typical permissions:

```text
assignment.view_own
assignment.update_own_status

task.view_assigned

venue.view

schedule.view_relevant

announcement.view_internal
```

Volunteers should not automatically receive:

```text
score.update
result.submit
result.approve
user.manage
role.manage
```

---

# 35. Media Member

Media members operate below the Media Head.

Possible permissions:

```text
media.view
media.create
media.update

gallery.view
gallery.create

livestream.view
```

Publication may require Media Head approval depending on the final workflow.

---

# 36. Design Member

Design members operate under the Design Head.

Possible permissions:

```text
design_asset.view
design_asset.create
design_asset.update

media.create
media.update
```

They should not automatically publish official content.

---

# 37. Web Developer

The Web Developer role is a special technical role.

The organizing policy assigns the Web Developer responsibility for developing and maintaining the official website/portal, including registrations, schedules, results and live updates.

The Web Developer should have technical permissions necessary to operate and maintain the platform.

However:

> Technical access does not automatically mean competition-authority access.

---

# 38. Web Developer Permissions

Potential permissions:

```text
system.view
system.configure

deployment.view

audit.view

user.view

technical_logs.view

content.view
content.update

competition.view
```

Competition-changing permissions should be granted only when explicitly required.

---

# 39. Web Team

Web Team members assist with development and maintenance.

They should have:

```text
technical documentation
development environment
test environment
appropriate application access
```

Production administrative permissions should be minimized.

Developers should not receive Convener-level application privileges simply because they maintain the code.

---

# 40. Management Team Member

Management members operate within the Management department.

Possible permissions:

```text
schedule.view

venue.view

task.view
task.update

assignment.view

match.view
team.view
```

Their exact permissions depend on their assignments.

---

# 41. Department Membership

A user may belong to a department without automatically receiving every Head-level permission.

Example:

```text
MEDIA_MEMBER
```

does not inherit:

```text
MEDIA_HEAD
```

permissions.

---

# 42. Role Matrix

The following is the initial high-level permission model.

| Capability            | Convener | Co-Convener |        Head | Sports Coord. |  Volunteer | Team Member |
| --------------------- | -------: | ----------: | ----------: | ------------: | ---------: | ----------: |
| View Public Data      |        ✓ |           ✓ |           ✓ |             ✓ |          ✓ |           ✓ |
| User Management       |        ✓ |           ✓ |  Restricted |             ✗ |          ✗ |           ✗ |
| Role Management       |        ✓ |           ✓ |  Restricted |             ✗ |          ✗ |           ✗ |
| Session Management    |        ✓ |           ✓ |  Restricted |             ✗ |          ✗ |           ✗ |
| Sports Management     |        ✓ |           ✓ |      Sports |             ✓ |          ✗ |  Restricted |
| Tournament Management |        ✓ |           ✓ |      Sports |             ✓ |          ✗ |  Restricted |
| Match Management      |        ✓ |           ✓ |      Sports |             ✓ |          ✗ |  Restricted |
| Live Score Update     |        ✓ |           ✓ |      Sports |             ✓ |          ✗ |    Assigned |
| Result Submit         |        ✓ |           ✓ |      Sports |             ✓ |          ✗ |    Assigned |
| Result Approve        |        ✓ |           ✓ |      Sports |    Restricted |          ✗ |           ✗ |
| Media Management      |        ✓ |           ✓ |       Media |             ✗ | Restricted |    Assigned |
| Sponsor Management    |        ✓ |           ✓ | Sponsorship |             ✗ |          ✗ |    Assigned |
| Task Management       |        ✓ |           ✓ |  Department |    Restricted |        Own |    Assigned |
| Audit View            |        ✓ |           ✓ |  Restricted |    Restricted |          ✗ |           ✗ |
| System Configuration  |        ✓ |           ✓ |  Restricted |             ✗ |          ✗ |   Technical |

This is a conceptual matrix. The final permission-level matrix will be maintained in machine-readable form during implementation.

---

# 43. Permission Naming Convention

Permissions should follow:

```text
resource.action
```

Examples:

```text
user.view
user.create
user.update

match.view
match.create
match.update

score.view
score.update

result.view
result.submit
result.approve
result.override
```

---

# 44. Avoid Wildcard Permissions

Avoid excessive permissions such as:

```text
admin.*
```

for ordinary roles.

A wildcard may exist internally for the Convener if necessary, but explicit permission evaluation is preferred.

---

# 45. Resource Scope

Permissions should be evaluated against the actual resource.

Example:

```text
PATCH /matches/<uuid>
```

The server must determine:

```text
Who?
What permission?
Which match?
Which sport?
Which tournament?
Which assignment?
```

before permitting the action.

---

# 46. Scope Evaluation Example

User:

```text
Sports Coordinator
Sport = Football
```

Request:

```text
Update Football Match
```

Result:

```text
ALLOW
```

Request:

```text
Update Cricket Match
```

Result:

```text
DENY
```

Even if the user knows the Cricket match UUID.

---

# 47. Assignment-Based Authorization

Some operations should be controlled by assignments.

Example:

```text
Volunteer
Assignment:
Venue = Basketball Court
Time = 10:00–14:00
Task = Participant Assistance
```

The user should not automatically receive unrelated volunteer tasks.

---

# 48. Own-Resource Scope

Some operations may use:

```text
OWN
```

scope.

Example:

```text
assignment.update_own_status
```

A Volunteer may update the status of their own assignment but not another Volunteer’s assignment.

---

# 49. Department Scope

A Head may operate within their department.

Example:

```text
MEDIA_HEAD
```

may have:

```text
media.*
```

but does not automatically have:

```text
sponsor.*
```

---

# 50. Global Scope

Global permissions apply across the event.

Examples:

```text
system.configure
user.manage
role.manage
audit.view
```

These should be highly restricted.

---

# 51. Event Scope

A permission may be scoped to:

```text
Convoquer'26
```

This is important if the platform later supports multiple Convoquer editions.

A user authorized for Convoquer'26 should not automatically receive access to another event edition.

---

# 52. Tournament Scope

A permission may be restricted to one tournament.

Example:

```text
score.update
Tournament = Football 2026
```

---

# 53. Venue Scope

Some operational users may be restricted to specific venues.

Example:

```text
Volunteer
Venue = Basketball Court
```

This is useful for operational dashboards.

---

# 54. Permission Evaluation Order

Recommended order:

```text
1. Is request authenticated?
2. Is session valid?
3. Is user active?
4. Does user possess required permission?
5. Does permission apply to this event?
6. Does permission apply to this department/sport/tournament?
7. Does user have resource access?
8. Is the requested operation valid?
9. Execute.
10. Audit if required.
```

---

# 55. Deny by Default

The authorization system must follow:

> **Default Deny.**

If the system cannot prove that the user has permission:

```text
DENY
```

It must not assume permission.

---

# 56. No Client-Supplied Authorization

The server must never trust:

```text
role=convener
```

or:

```text
isAdmin=true
```

from the frontend.

Authorization must be derived from trusted server-side data.

---

# 57. No Role Trust from JWT

If tokens are ever used internally for authentication transport, role information must not be treated as permanently authoritative.

Current architecture uses database-backed sessions.

The database remains the source of authorization truth.

---

# 58. Session Revocation

Authorized administrators should be able to revoke sessions.

Examples:

```text
Revoke one session
Revoke all sessions for user
Revoke sessions after security incident
```

Revocation should be audited.

---

# 59. Role Assignment

Role assignment is a privileged action.

The system should record:

```text
Who assigned role
Which role
To whom
Scope
When
Reason
```

---

# 60. Role Revocation

Role revocation should immediately affect authorization.

An existing active session should not preserve revoked permissions indefinitely.

The next protected request must evaluate current authorization.

---

# 61. Permission Changes

Changes to role permissions are highly sensitive.

Only authorized administrators should be able to perform them.

All such changes must be audited.

---

# 62. Critical Competition Actions

The following should be considered critical:

```text
score.update
result.approve
result.override
match.override
tournament.update
schedule.override
team.disqualify
role.assign
role.revoke
permission.modify
```

These require stronger auditing.

---

# 63. Result Approval

A result should only be approved by an authorized role.

Conceptually:

```text
Result Submitted
       ↓
Permission Check
       ↓
Sports Authority
       ↓
Approve
       ↓
Audit
       ↓
Published
```

---

# 64. Score Update

A score update requires:

```text
score.update
```

plus appropriate sport/match scope.

The server must additionally verify:

```text
Match exists
Match is active
User is authorized
Score is valid
State transition is valid
```

---

# 65. Result Override

An override is more privileged than a normal result update.

Potential authorization:

```text
Convener
Co-Convener
Authorized Overall Sports Authority
```

The exact final matrix will be confirmed with event authorities.

An override must require an audit reason.

---

# 66. Published Data Protection

Once competition data becomes official/public:

```text
PUBLISHED
```

ordinary editing permissions should no longer be sufficient.

A correction workflow should be used.

---

# 67. Authorization Failure

The API should return an appropriate authorization error.

Examples:

```text
401 Unauthorized
```

when authentication is absent/invalid.

```text
403 Forbidden
```

when the user is authenticated but lacks permission.

The response must not reveal sensitive information about the resource.

---

# 68. Resource Enumeration Protection

Even with UUIDs, the API must avoid leaking whether unauthorized resources exist.

For protected resources, responses should be designed carefully so users cannot use the API as an enumeration mechanism.

---

# 69. Public Resources

Public data does not require organizer authorization.

Examples:

```text
Published Sports
Published Schedule
Published Results
Published Standings
Published News
Published Announcements
Published Sponsors
Published Venues
```

However, publication status must be enforced.

---

# 70. Public vs Internal Permissions

Example:

```text
announcement.view.public
```

versus:

```text
announcement.view.internal
```

Internal announcements must never be returned through public endpoints.

---

# 71. Sensitive Participant Data

Participant records may contain:

```text
Name
Roll Number
DOB
Contact Number
```

Not all fields should be accessible to all organizers.

Access should be limited based on operational need.

---

# 72. Participant Data Scope Example

Hospitality may need:

```text
Name
Institute
Sport
Team
Match
Venue
```

but not necessarily:

```text
Date of Birth
Personal Contact Number
```

unless explicitly required.

---

# 73. Sports Coordinator Participant Access

A Sports Coordinator should generally access participants associated with their assigned sport.

They should not automatically receive the complete participant database.

---

# 74. Audit Access

Audit logs contain sensitive information.

Default access:

```text
Convener
Co-Convener
Authorized administrative roles
```

Department Heads should only receive audit access where explicitly justified.

---

# 75. Audit Log Immutability

RBAC must not provide an ordinary:

```text
audit.delete
```

permission.

Audit records should be append-oriented.

---

# 76. Technical Roles

Technical developers may need access to logs and system diagnostics.

This should not automatically grant:

```text
competition.override
role.manage
result.approve
```

Technical access and organizational authority remain separate.

---

# 77. Emergency Access

The platform may provide emergency override capability to highly authorized users.

Emergency actions must:

1. Require explicit authorization.
2. Record the actor.
3. Record the reason.
4. Record the affected resource.
5. Record before/after state.
6. Be visible in audit logs.

---

# 78. Authorization Middleware / Guards

NestJS should enforce authorization through reusable guards/decorators rather than manually rewriting permission checks in every controller.

Conceptually:

```text
@RequirePermission("score.update")
```

followed by scope/resource evaluation.

The exact implementation is an engineering decision.

---

# 79. Resource Authorization Service

The server should have a centralized authorization mechanism capable of evaluating:

```text
can(
    user,
    action,
    resource
)
```

Conceptually:

```text
can(user, "score.update", match)
```

returns:

```text
ALLOW
```

or:

```text
DENY
```

with the reason kept internal for diagnostics where appropriate.

---

# 80. Business Rules vs RBAC

RBAC answers:

> Is this user allowed to perform this operation?

Business rules answer:

> Is this operation valid right now?

Both are required.

Example:

```text
Sports Coordinator
+
score.update
```

does not mean the user can update:

```text
A published match
```

if the competition state forbids ordinary modification.

---

# 81. Example — Score Update

```text
Request
 ↓
Valid Session?
 ↓ YES
User Active?
 ↓ YES
score.update?
 ↓ YES
Football Scope?
 ↓ YES
Match Exists?
 ↓ YES
Match Editable?
 ↓ YES
Score Valid?
 ↓ YES
Transaction
 ↓
Audit
 ↓
Realtime Event
```

---

# 82. Example — Unauthorized Score Update

```text
Volunteer
 ↓
score.update?
 ↓
NO
 ↓
403 Forbidden
```

No database modification occurs.

---

# 83. Example — Wrong Sport

```text
Football Coordinator
 ↓
Request: Cricket Match
 ↓
score.update?
 ↓ YES
Scope = Football
 ↓
Match = Cricket
 ↓
DENY
```

---

# 84. Example — Stolen UUID

```text
User
 ↓
Known Match UUID
 ↓
Request
 ↓
Authentication
 ↓
Permission
 ↓
Scope
 ↓
Object Authorization
 ↓
DENY
```

Knowing the UUID does not grant access.

---

# 85. Example — Revoked Role

```text
User
 ↓
Previously Sports Coordinator
 ↓
Role Revoked
 ↓
Existing Session
 ↓
Protected Request
 ↓
Current Role Lookup
 ↓
Permission Missing
 ↓
DENY
```

---

# 86. Example — Suspended User

```text
User
 ↓
Session Exists
 ↓
User = SUSPENDED
 ↓
Protected Request
 ↓
DENY
```

Existing sessions should be revocable when the suspension occurs.

---

# 87. Permission Database Model

Conceptually:

```text
Role
  │
  └──< RolePermission >── Permission
```

A permission may be:

```text
match.update
```

while the RolePermission can determine its applicable scope.

---

# 88. User Role Database Model

```text
User
  │
  └──< UserRole >── Role
```

UserRole may contain:

```text
event_id
department_id
sport_id
tournament_id
assigned_by
created_at
expires_at
```

Not all fields are applicable to every role.

---

# 89. Temporary Roles

The system may support temporary role assignments.

Example:

```text
VOLUNTEER
Valid:
1 October – 4 October
```

After expiration, the role should no longer authorize operations.

---

# 90. Role Expiration

If role expiration is implemented:

```text
Current Time < expires_at
```

is required for authorization.

Expired roles are treated as inactive.

---

# 91. Sports Coordinator Stability

Sports Coordinator assignments should not be casually editable.

The application should restrict changes to authorized administrative roles.

Changes must be audited.

---

# 92. Permission Versioning

If permissions change during the event, the system should record when the change occurred.

This is important because an audit record should remain interpretable.

Example:

```text
10:00
User had score.update

11:00
Permission revoked

11:30
Score update denied
```

---

# 93. Audit and RBAC Interaction

Every sensitive authorization change should itself be audited.

Examples:

```text
ROLE_ASSIGNED
ROLE_REVOKED
PERMISSION_GRANTED
PERMISSION_REVOKED
USER_SUSPENDED
USER_DEACTIVATED
SESSION_REVOKED
```

---

# 94. Role Dashboard Mapping

The frontend dashboard should be derived from permissions.

A user should not be routed to a dashboard merely because:

```text
role === "SPORTS_COORDINATOR"
```

Instead the UI should consume authorized capabilities.

Example:

```text
User
 ↓
Effective Permissions
 ↓
Dashboard Modules
```

---

# 95. Dashboard Principle

A user should see:

> **What they need to do.**

Not:

> Everything the system can do.

Example Volunteer dashboard:

```text
Today's Assignments
Upcoming Task
Venue
Schedule
Announcements
```

not:

```text
Database
Users
Roles
Permissions
Audit Logs
```

---

# 96. Organizer Public View

Authenticated organizers must retain access to the public website.

The platform should provide a visible dashboard entry point:

```text
Public Website
      │
      └── Dashboard
```

Returning to the public site should not require logging out.

---

# 97. Role Switching

If a user has multiple roles, the interface may present role-relevant sections.

Example:

```text
Dashboard

Sports Coordinator — Football
Media Team
```

The backend still evaluates every operation independently.

A frontend "role switch" is a UI concept, not an authorization mechanism.

---

# 98. No Impersonation by Default

Organizers should not be able to impersonate other users as a normal feature.

If emergency impersonation is ever required, it must:

- Be highly restricted.
- Require explicit authorization.
- Be prominently audited.
- Preserve the identity of the original administrator.
- Record the impersonated user.

This is currently not required.

---

# 99. Permission Naming

Permissions should be consistent and machine-readable.

Recommended pattern:

```text
<resource>.<action>
```

Examples:

```text
sport.view
sport.update

tournament.view
tournament.update

match.view
match.update

score.view
score.update

result.view
result.submit
result.approve
result.override
```

---

# 100. Sensitive Permission Naming

Sensitive operations should be explicit.

Avoid:

```text
result.manage
```

when the distinction between:

```text
result.submit
result.approve
result.override
```

matters.

---

# 101. Administrative Permissions

Administrative permissions include:

```text
user.manage
role.manage
permission.manage
session.manage
system.configure
audit.view
```

These must be highly restricted.

---

# 102. Competition Permissions

Competition permissions include:

```text
sport.view
sport.update

tournament.view
tournament.create
tournament.update

fixture.view
fixture.create
fixture.update

match.view
match.create
match.update

score.view
score.update

result.view
result.submit
result.approve
result.override

standings.view
ranking.view
```

---

# 103. Operations Permissions

Operations permissions include:

```text
task.view
task.create
task.update
task.assign

assignment.view
assignment.create
assignment.update

hospitality.view
hospitality.update

venue.view
venue.update
```

---

# 104. Content Permissions

Content permissions include:

```text
news.view
news.create
news.update
news.publish

announcement.view
announcement.create
announcement.update
announcement.publish

media.view
media.create
media.update
media.delete
media.publish

gallery.view
gallery.create
gallery.update
gallery.publish

sponsor.view
sponsor.create
sponsor.update
sponsor.publish
```

---

# 105. Import Permissions

Participant/data import should be restricted.

Potential permissions:

```text
import.view
import.create
import.validate
import.execute
```

The ability to upload an Excel file should not automatically mean the ability to import it into production.

---

# 106. Import Authorization

Recommended flow:

```text
Upload
 ↓
Validate
 ↓
Preview
 ↓
Authorized Confirmation
 ↓
Import
```

Execution should be more privileged than upload.

---

# 107. Permission Matrix — Competition

| Permission          | Convener | Co-Convener | Overall Sports | Sports Coordinator | Volunteer |
| ------------------- | -------: | ----------: | -------------: | -----------------: | --------: |
| `sport.view`        |        ✓ |           ✓ |              ✓ |                  ✓ |         ✓ |
| `sport.update`      |        ✓ |           ✓ |              ✓ |             Scoped |         ✗ |
| `tournament.create` |        ✓ |           ✓ |              ✓ |             Scoped |         ✗ |
| `tournament.update` |        ✓ |           ✓ |              ✓ |             Scoped |         ✗ |
| `match.view`        |        ✓ |           ✓ |              ✓ |             Scoped |  Assigned |
| `match.update`      |        ✓ |           ✓ |              ✓ |             Scoped |         ✗ |
| `score.view`        |        ✓ |           ✓ |              ✓ |             Scoped |  Assigned |
| `score.update`      |        ✓ |           ✓ |              ✓ |             Scoped |         ✗ |
| `result.submit`     |        ✓ |           ✓ |              ✓ |             Scoped |         ✗ |
| `result.approve`    |        ✓ |           ✓ |              ✓ |     TBD/Restricted |         ✗ |
| `result.override`   |        ✓ |           ✓ |   ✓/Restricted |                  ✗ |         ✗ |
| `standings.view`    |        ✓ |           ✓ |              ✓ |             Scoped |         ✓ |

---

# 108. Permission Matrix — Operations

| Permission           | Convener | Co-Convener | Relevant Head | Team Member |  Volunteer |
| -------------------- | -------: | ----------: | ------------: | ----------: | ---------: |
| `task.view`          |        ✓ |           ✓ |             ✓ |    Assigned |   Assigned |
| `task.create`        |        ✓ |           ✓ |             ✓ |  Restricted |          ✗ |
| `task.update`        |        ✓ |           ✓ |             ✓ |    Assigned |        Own |
| `task.assign`        |        ✓ |           ✓ |             ✓ |  Restricted |          ✗ |
| `assignment.view`    |        ✓ |           ✓ |             ✓ |    Assigned |        Own |
| `assignment.create`  |        ✓ |           ✓ |             ✓ |  Restricted |          ✗ |
| `assignment.update`  |        ✓ |           ✓ |             ✓ |    Assigned | Own Status |
| `hospitality.view`   |        ✓ |           ✓ |   Hospitality |    Assigned |   Relevant |
| `hospitality.update` |        ✓ |           ✓ |   Hospitality |    Assigned |          ✗ |

---

# 109. Permission Matrix — Content

| Permission             | Convener | Co-Convener |          Head |     Member |
| ---------------------- | -------: | ----------: | ------------: | ---------: |
| `news.create`          |        ✓ |           ✓ |      Relevant |   Assigned |
| `news.publish`         |        ✓ |           ✓ | Relevant Head | Restricted |
| `media.create`         |        ✓ |           ✓ |      Relevant |   Assigned |
| `media.publish`        |        ✓ |           ✓ | Relevant Head | Restricted |
| `gallery.create`       |        ✓ |           ✓ |         Media |   Assigned |
| `sponsor.update`       |        ✓ |           ✓ |   Sponsorship |   Assigned |
| `announcement.publish` |        ✓ |           ✓ |      Relevant | Restricted |

---

# 110. Permission Matrix — Administration

| Permission          | Convener | Co-Convener |           Head | Sports Coord. |    Member |
| ------------------- | -------: | ----------: | -------------: | ------------: | --------: |
| `user.view`         |        ✓ |           ✓ |     Restricted |    Restricted |         ✗ |
| `user.create`       |        ✓ |           ✓ |     Restricted |             ✗ |         ✗ |
| `user.update`       |        ✓ |           ✓ |     Restricted |             ✗ |         ✗ |
| `role.assign`       |        ✓ |           ✓ | Restricted/TBD |             ✗ |         ✗ |
| `role.revoke`       |        ✓ |           ✓ | Restricted/TBD |             ✗ |         ✗ |
| `permission.manage` |        ✓ |           ✓ |              ✗ |             ✗ |         ✗ |
| `session.manage`    |        ✓ |           ✓ |     Restricted |             ✗ |         ✗ |
| `audit.view`        |        ✓ |           ✓ |     Restricted |    Restricted |         ✗ |
| `system.configure`  |        ✓ |           ✓ |              ✗ |             ✗ | Technical |

---

# 111. Important TBD Decisions

The following must be confirmed before final RBAC implementation:

- Exact Co-Convener permissions.
- Exact result approval hierarchy.
- Exact Sports Coordinator permissions.
- Whether Sports Coordinators can approve results.
- Exact Head-level user-management permissions.
- Exact Web Developer production permissions.
- Exact Hospitality data visibility.
- Exact participant-field visibility.
- Exact Volunteer capabilities.
- Whether certain Heads can assign roles.
- Emergency override policy.

Until confirmed, the more restrictive interpretation should be used.

---

# 112. Security Default for TBD

When authorization is undecided:

> **Deny by default.**

A permission should not be granted merely because it seems convenient.

It can be added later without compromising the initial security posture.

---

# 113. Testing Requirements

RBAC must be tested independently from the UI.

Tests should verify:

```text
Correct role → ALLOW
Wrong role → DENY
Correct sport → ALLOW
Wrong sport → DENY
Valid assignment → ALLOW
Wrong assignment → DENY
Revoked role → DENY
Expired role → DENY
Suspended user → DENY
Invalid session → DENY
Known UUID without permission → DENY
```

---

# 114. RBAC Test Matrix

Example:

```text
Football Coordinator
    │
    ├── Football Match
    │      └── score.update → ALLOW
    │
    └── Cricket Match
           └── score.update → DENY
```

Volunteer:

```text
Volunteer
    │
    ├── Own Assignment
    │      └── status.update → ALLOW
    │
    └── Other Assignment
           └── status.update → DENY
```

---

# 115. Security Acceptance Criteria

The RBAC implementation is successful when:

1. Every protected API requires authentication.
2. Every protected API checks authorization.
3. Permissions are evaluated server-side.
4. Scope is evaluated server-side.
5. Object-level authorization is enforced.
6. UUID knowledge does not bypass authorization.
7. Revoked roles immediately affect access.
8. Suspended users cannot perform protected operations.
9. Critical operations are auditable.
10. Frontend controls are never treated as security controls.

---

# 116. Final RBAC Architecture

```text
                         USER
                          │
                          ▼
                     AUTHENTICATION
                          │
                          ▼
                       SESSION
                          │
                          ▼
                         ROLES
                          │
                  ┌───────┴───────┐
                  ▼               ▼
             PERMISSIONS       ASSIGNMENTS
                  │               │
                  └───────┬───────┘
                          ▼
                        SCOPE
                          │
                          ▼
                   RESOURCE ACCESS
                          │
                          ▼
                  BUSINESS RULES
                          │
                  ┌───────┴───────┐
                  ▼               ▼
                 ALLOW           DENY
                  │
                  ▼
              OPERATION
                  │
                  ▼
              AUDIT LOG
```

---

# 117. Final RBAC Principle

The Convoquer'26 platform follows:

> **Authentication determines who you are.
> Roles determine your organizational responsibility.
> Permissions determine what you can do.
> Scope determines where you can do it.
> Assignments determine what you are responsible for.
> Business rules determine whether the operation is currently valid.
> Audit logs record what you actually did.**

No single layer should be treated as a substitute for another.

---

# 118. Relationship to Other Documents

```text
PRD.md
    │
    ▼
ARCHITECTURE.md
    │
    ▼
DATABASE.md
    │
    ▼
RBAC.md
    │
    ├───────────────┐
    ▼               ▼
API_SPEC.md    SECURITY.md
    │
    └───────┬───────┘
            ▼
       Implementation
```

`RBAC.md` defines the authorization model that the backend and database must implement.

---

# 119. Status

**Approved Baseline**

The following principles are locked:

- Server-side authorization.
- Default deny.
- Least privilege.
- Multiple roles per user.
- Permission + scope model.
- Assignment-aware access.
- Object-level authorization.
- UUIDs do not provide authorization.
- Database-backed sessions.
- Immediate effect of role revocation.
- Critical-action auditing.
- Convener global authority.
- Individually traceable Co-Conveners.
- Sport-scoped Sports Coordinators.
- Assignment-oriented Volunteers.
- Separate organizational and technical authority.

The exact permission matrix for unresolved organizational responsibilities remains subject to confirmation before implementation.
