# Convoquer'26 Digital Platform — Code Style Guide

**Project:** Convoquer'26 Digital Platform  
**Institute:** Indian Institute of Technology Jammu  
**Frontend:** Next.js + TypeScript  
**Backend:** NestJS + TypeScript  
**Database:** PostgreSQL + Prisma  
**Repository:** Monorepo  
**Formatting:** Prettier  
**Linting:** ESLint  
**Editor Configuration:** EditorConfig  
**Automation:** Git Hooks + GitHub Actions  
**Document Version:** 1.0  
**Status:** Approved Development Baseline

---

# 1. Purpose

This document defines the coding conventions for the entire Convoquer'26 codebase.

The objective is not to force every developer to manually remember hundreds of formatting rules.

Instead:

> **Machines should enforce formatting; developers should focus on writing understandable code.**

The project should therefore use automated tooling wherever possible.

---

# 2. Core Philosophy

The project's code should be:

```text
Readable
Explicit
Consistent
Predictable
Maintainable
Secure
```

The primary style principle is:

> **Code should be easy for another developer to read from top to bottom.**

This is especially important because the development team contains several developers who are new to web development.

---

# 3. Style Reference

The project lead's existing coding style is the primary reference for the project's readability conventions.

The reference code demonstrates:

- Explicit logical sections.
- Descriptive variable names.
- Generous separation between logical blocks.
- Section comments.
- Straightforward control flow.
- Explicit error handling.
- Explicit response construction.

For example, the reference controller separates request extraction, user identification, validation and database processing into visually distinct sections.

The new codebase should preserve this readability philosophy while following the project's TypeScript/NestJS architecture.

---

# 4. Automated vs Human Rules

Not every rule should require human review.

## Automatically enforced

```text
Indentation
Spacing
Line endings
Quotes
Semicolons
Trailing commas
Basic syntax formatting
Unused variables
Many common lint issues
Type errors
```

## Human-reviewed

```text
Naming quality
Architecture
Function responsibility
Business logic
Security
Database design
API design
Comments
Code readability
Unnecessary complexity
```

---

# 5. Formatting Stack

The project should use:

```text
EditorConfig
     ↓
Prettier
     ↓
ESLint
     ↓
Git Hooks
     ↓
GitHub Actions
```

---

# 6. EditorConfig

An `.editorconfig` file should be present at the repository root.

It should define the basic editor behavior for every developer.

Recommended baseline:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 4
trim_trailing_whitespace = true
```

The final indentation configuration must remain consistent across the entire project.

---

# 7. Indentation

The project uses:

```text
Spaces
```

rather than tabs.

The default project indentation is:

```text
4 spaces
```

unless the final framework/tooling configuration establishes another project-wide standard.

Developers must not manually choose different indentation levels.

---

# 8. Example Indentation

Preferred:

```ts
const createMatch = async () => {
    try {
        const match = await matchService.create();

        return match;
    } catch (error) {
        throw error;
    }
};
```

The exact formatter output will be authoritative.

The important rule is consistency.

---

# 9. Vertical Spacing

The project intentionally uses whitespace to separate logical operations.

For example:

```ts
const { title, description } = createMatchDto;

const createdBy = req.user.id;

if (!title || !description) {
    throw new BadRequestException();
}

const match = await this.matchService.create();

return match;
```

Logical blocks should not be unnecessarily compressed into a single dense block.

---

# 10. Logical Block Separation

When a function performs several conceptually different operations, separate them visually.

Preferred structure:

```text
Extract Data

↓

Identify User

↓

Validate Input

↓

Perform Operation

↓

Handle Result

↓

Return Response
```

This mirrors the project's existing controller style.

---

# 11. Blank Lines

Blank lines should be used to communicate structure.

Use blank lines between:

- Imports and code.
- Variable groups.
- Logical operations.
- Validation sections.
- Database operations.
- Error handling.
- Return statements.
- Major class methods.

Do not add random blank lines without a structural reason.

---

# 12. Functions

Functions should have one primary responsibility.

Bad:

```ts
async function processEverything() {
    // Authentication
    // Database
    // Score calculation
    // Email
    // Audit
    // Notification
}
```

Preferred:

```text
AuthenticationService
MatchService
ScoreService
AuditService
NotificationService
```

---

# 13. Function Length

There is no absolute line limit.

However:

> If a function becomes difficult to understand by reading it from top to bottom, it should probably be divided.

Do not split functions merely to achieve an arbitrary line count.

---

# 14. Function Naming

Functions should use descriptive verbs.

Preferred:

```ts
createMatch();
getMatch();
updateMatch();
deleteMatch();
approveResult();
calculateStandings();
assignVolunteer();
publishResult();
```

Avoid:

```ts
doThing();
process();
handle();
run();
execute();
```

unless the meaning is obvious from context.

---

# 15. Variable Naming

Variables should describe what they contain.

Preferred:

```ts
matchId;
createdBy;
updatedMatch;
participantCount;
currentScore;
sportCoordinator;
```

Avoid:

```ts
x;
data1;
obj;
temp;
thing;
result2;
```

---

# 16. Boolean Naming

Boolean variables should communicate a condition.

Preferred:

```ts
isActive;
isPublished;
isApproved;
hasPermission;
canEdit;
isAuthenticated;
```

Avoid:

```ts
active;
permission;
edit;
```

when the meaning is ambiguous.

---

# 17. Constants

Constants should use descriptive names.

For example:

```ts
const DEFAULT_PAGE_SIZE = 20;
```

Do not create unexplained magic numbers throughout the code.

---

# 18. Magic Numbers

Avoid:

```ts
if(score > 3) {
```

when `3` has a business meaning.

Prefer:

```ts
const MAX_ALLOWED_OVERTIME_PERIODS = 3;

if(score > MAX_ALLOWED_OVERTIME_PERIODS) {
```

The constant should only be introduced when it genuinely improves understanding.

---

# 19. Strings

Repeated important strings should be centralized when appropriate.

Avoid scattering:

```ts
"RESULT_APPROVED";
```

throughout dozens of files.

Use enums/constants where they improve consistency.

---

# 20. Comments

Comments should explain:

```text
Why
```

rather than merely:

```text
What
```

Bad:

```ts
// Get event
const event = await this.eventService.getEvent();
```

Good:

```ts
// Fetch the match before modifying its score so that
// sport scope and match state can be validated.
const match = await this.matchService.getMatch(matchId);
```

---

# 21. Section Comments

Section comments are encouraged for functions containing multiple logical stages.

The existing project style uses comments such as:

```js
// Create New Event
// Get All Events
// Update an Event
// Delete an Event
```

to clearly divide operations.
The same principle should be used in the new codebase.

---

# 22. Comment Style

Preferred:

```ts
// Validate the match before accepting the score update.
```

Avoid unnecessarily verbose comments:

```ts
// This line below is going to call the service
// which is responsible for getting the match
// because we need the match here.
```

---

# 23. Do Not Comment Obvious Code

Avoid:

```ts
// Increment count by one
count++;
```

The code already explains itself.

---

# 24. TODO Comments

TODOs should be meaningful.

Preferred:

```ts
// TODO: Replace temporary scoring rule after tournament format is confirmed.
```

Avoid:

```ts
// TODO: fix
```

---

# 25. Imports

Imports should be organized consistently.

Recommended order:

```text
1. External packages
2. Framework imports
3. Internal absolute imports
4. Relative imports
5. Styles/assets where applicable
```

Example:

```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/database/prisma.service";

import { ScoreService } from "./score.service";
import { UpdateScoreDto } from "./dto/update-score.dto";
```

The final ESLint configuration should enforce import consistency where practical.

---

# 26. Unused Imports

Unused imports must not remain in the codebase.

The uploaded reference file contains an apparently unused import:

```js
const { get } = require("../routes/userRoutes");
```

The new project should use ESLint/TypeScript checks to catch such issues automatically.

---

# 27. Semicolons

The project will use semicolons consistently.

Example:

```ts
const matchId = req.params.id;
```

The final Prettier configuration will enforce this.

---

# 28. Quotes

The project should use one quote style consistently.

Recommended:

```ts
const message = "Match updated successfully";
```

Prettier will enforce the final configuration.

---

# 29. Trailing Commas

Trailing commas should be handled automatically by Prettier.

Developers should not manually debate whether a trailing comma is required.

---

# 30. Line Length

Developers should not manually force every line to a particular length.

Prettier should wrap code according to the project's configured print width.

The project should prioritize readability over an arbitrary line-length obsession.

---

# 31. TypeScript

The project uses TypeScript.

New production code should be written in TypeScript unless there is a specific reason otherwise.

---

# 32. Avoid `any`

Avoid:

```ts
const data: any = ...
```

Prefer:

```ts
const data: MatchResponse = ...
```

If `any` is genuinely necessary, its use should be justified.

---

# 33. Type Safety

TypeScript should be configured strictly enough to catch meaningful mistakes.

Developers should not silence TypeScript errors merely to make the build pass.

Avoid unnecessary:

```ts
as any
```

or:

```ts
// @ts-ignore
```

---

# 34. Interfaces and Types

Use interfaces/types where they improve clarity.

Examples:

```ts
interface MatchScore {
    home: number;
    away: number;
}
```

and:

```ts
type MatchStatus = "SCHEDULED" | "LIVE" | "COMPLETED";
```

The project's final conventions for interfaces vs type aliases should remain consistent.

---

# 35. Enums

Enums may be used for stable domain concepts where appropriate.

Examples:

```text
MatchStatus
UserStatus
Role
Permission
SportType
```

Avoid introducing an enum when a simpler union or constant structure is sufficient.

---

# 36. Null and Undefined

Handle nullable values explicitly.

Do not assume that database values always exist.

Example:

```ts
if (!match) {
    throw new NotFoundException("Match not found");
}
```

---

# 37. Error Handling

Errors should be handled explicitly.

The project's reference code consistently checks database errors and returns an appropriate response.

The NestJS implementation should preserve the same philosophy using NestJS exceptions and appropriate error handling.

---

# 38. Backend Error Handling

Use appropriate NestJS exceptions.

Examples:

```ts
throw new BadRequestException();
throw new UnauthorizedException();
throw new ForbiddenException();
throw new NotFoundException();
throw new ConflictException();
```

Do not return arbitrary error objects from controllers.

---

# 39. Controller Style

Controllers should remain readable and relatively thin.

Preferred:

```text
Controller
    ↓
Validate DTO
    ↓
Call Service
    ↓
Return Result
```

Business logic belongs in services.

---

# 40. Service Style

Services should contain business logic.

Example:

```ts
async approveResult(resultId: string, user: AuthenticatedUser) {

    const result = await this.getResult(resultId);

    this.authorizationService.assertCanApprove(user, result);

    this.validateResult(result);

    return this.prisma.$transaction(async (transaction) => {

        // Update result
        // Recalculate standings
        // Create audit log

    });

}
```

---

# 41. Database Code

Database access should not be scattered throughout controllers.

Preferred:

```text
Controller
    ↓
Service
    ↓
Prisma
```

---

# 42. Prisma Naming

Prisma models should use clear domain names.

Examples:

```text
User
Session
Sport
Team
Participant
Match
ScoreEvent
Result
AuditLog
```

Field naming should remain consistent with the database specification.

---

# 43. API Naming

REST endpoints should use consistent resource names.

Preferred:

```text
/matches
/matches/:id
/teams
/sports
/results
/participants
```

Avoid inconsistent patterns such as:

```text
/getMatches
/getAllTeams
/updateMatch
```

unless a specific API design decision requires them.

---

# 44. API Variables

Use descriptive identifiers.

Preferred:

```ts
const matchId = params.id;
```

rather than:

```ts
const id = params.id;
```

when the context contains multiple resource identifiers.

---

# 45. Security-Sensitive Code

Security code must favor clarity over cleverness.

Examples:

```text
Authentication
Authorization
Session handling
Permission checks
Score validation
Result approval
Audit logging
```

should be explicit.

---

# 46. Never Hide Authorization

Avoid:

```ts
return this.updateMatch(matchId);
```

when it is unclear whether authorization occurred.

Preferred:

```ts
this.authorizationService.assertCanUpdateMatch(user, match);

return this.matchService.updateMatch(matchId, dto);
```

The authorization step should be obvious.

---

# 47. Frontend Components

React components should generally have one clear responsibility.

Preferred:

```text
MatchCard
ScoreBoard
ScheduleTable
TeamCard
LeaderboardTable
```

Avoid giant components that contain an entire page's logic.

---

# 48. Component Naming

React components use PascalCase.

Examples:

```text
MatchCard.tsx
ScoreBoard.tsx
VenueCard.tsx
OrganizerSidebar.tsx
```

---

# 49. Hooks

Custom hooks should use the `use` prefix.

Examples:

```ts
useCurrentUser();
useMatch();
useLiveScore();
usePermissions();
```

---

# 50. API Hooks

Where practical, API interaction should be abstracted from visual components.

Preferred:

```text
Component
   ↓
Hook
   ↓
API Client
   ↓
Backend
```

---

# 51. UI Logic

Do not place large business rules inside JSX.

Avoid:

```tsx
return (
    <div>
        {score > 10 && user.role === 'ADMIN' && match.status !== 'COMPLETED' && ...}
    </div>
);
```

Move complicated logic into named functions/hooks.

---

# 52. Conditional Rendering

Simple conditions may remain inline.

Complex conditions should be named.

Preferred:

```ts
const canEditScore = ...
```

then:

```tsx
{
    canEditScore && <ScoreEditor />;
}
```

---

# 53. CSS

The project must use one agreed styling strategy.

Developers should not introduce arbitrary styling frameworks without discussion.

The final styling system will be defined during implementation.

---

# 54. Reusable Components

If the same UI pattern appears repeatedly, consider creating a reusable component.

Examples:

```text
Button
Modal
Table
Card
Badge
Input
Select
LoadingState
ErrorState
```

Do not abstract components prematurely.

---

# 55. Component Abstraction Rule

Create an abstraction when:

```text
The pattern is repeated
+
The abstraction is genuinely clearer
```

Do not create:

```text
UniversalComponentManagerFactory
```

for two simple buttons.

---

# 56. State Management

State should live at the lowest reasonable level.

Do not put every piece of UI state into a global store.

---

# 57. Naming Files

Recommended conventions:

### React Components

```text
PascalCase.tsx
```

### Hooks

```text
useSomething.ts
```

### Services

```text
something.service.ts
```

### Controllers

```text
something.controller.ts
```

### DTOs

```text
create-something.dto.ts
```

### Tests

```text
something.spec.ts
```

---

# 58. Folder Naming

Folders should generally use lowercase kebab-case where appropriate.

Examples:

```text
live-score/
result-approval/
hospitality-dashboard/
```

---

# 59. Backend Module Structure

NestJS modules should follow a predictable structure.

Example:

```text
matches/
│
├── dto/
│   ├── create-match.dto.ts
│   └── update-match.dto.ts
│
├── matches.controller.ts
├── matches.service.ts
├── matches.module.ts
└── matches.spec.ts
```

The exact structure may evolve, but consistency is mandatory.

---

# 60. Frontend Feature Structure

Frontend features should be grouped logically.

Example:

```text
features/
│
├── matches/
├── teams/
├── results/
├── standings/
└── authentication/
```

---

# 61. Avoid Deeply Nested Folders

Do not create unnecessarily deep structures.

Bad:

```text
src/features/events/components/cards/common/items/shared/base/
```

Prefer a structure that reflects actual architectural boundaries.

---

# 62. API Response Structure

API responses should follow the documented API specification.

Developers should not invent different response structures for different endpoints without updating `API_SPEC.md`.

---

# 63. Database Response Filtering

Never return the complete database object simply because it is convenient.

Bad:

```ts
return this.prisma.user.findUnique(...);
```

if the returned object contains fields that should not leave the backend.

Use appropriate response DTOs.

---

# 64. Logging

Logs should contain useful context.

Preferred:

```ts
this.logger.error(`[DB Match Update Error] ${error.message}`);
```

The existing coding style uses identifiable log prefixes such as:

```text
[DB Event Insert Error]
[DB Event Fetch Error]
[Event Controller Error]
```

The NestJS logging system should preserve this clarity.

---

# 65. Never Log Secrets

Never log:

```text
Passwords
OAuth secrets
Session tokens
Access tokens
Database passwords
Private keys
```

---

# 66. Debug Logs

Temporary debug logs must be removed before production.

Do not leave:

```ts
console.log(user);
```

in production code.

---

# 67. Async/Await

Use `async/await` consistently for asynchronous operations.

Preferred:

```ts
const match = await this.matchService.getMatch(matchId);
```

Avoid mixing multiple asynchronous styles unnecessarily.

---

# 68. Promise Handling

Do not leave promises unintentionally unhandled.

Every asynchronous operation should have an intentional lifecycle.

---

# 69. Optional Chaining

Use optional chaining where it improves readability.

Example:

```ts
user?.profile?.name;
```

Do not use it blindly when missing data should instead produce an explicit error.

---

# 70. Early Returns

Early returns are encouraged when they simplify logic.

Example:

```ts
if (!match) {
    throw new NotFoundException("Match not found");
}

if (match.status === MatchStatus.COMPLETED) {
    throw new BadRequestException("Match is already completed");
}
```

This is preferable to deeply nested conditionals.

---

# 71. Nesting

Avoid excessive nesting.

Bad:

```ts
if (user) {
    if (match) {
        if (match.status) {
            if (permission) {
                // ...
            }
        }
    }
}
```

Prefer explicit validation with early exits.

---

# 72. Switch Statements

Use switch statements when they make domain logic clearer.

For example:

```ts
switch (match.status) {
    case MatchStatus.SCHEDULED:
        break;

    case MatchStatus.LIVE:
        break;

    case MatchStatus.COMPLETED:
        break;
}
```

---

# 73. Business Rules

Important business rules should have descriptive names.

Instead of:

```ts
if(a && b && !c && d > 4) {
```

prefer:

```ts
const canPublishResult =
    hasApprovalPermission &&
    isValidResult &&
    !isAlreadyPublished &&
    participantCount > MINIMUM_PARTICIPANTS;
```

---

# 74. Validation

Input validation should happen before business logic.

```text
Request
 ↓
DTO Validation
 ↓
Authentication
 ↓
Authorization
 ↓
Business Validation
 ↓
Database
```

The exact guard/pipeline order must follow the backend architecture.

---

# 75. Never Trust Request Data

Do not trust:

```ts
req.body.role;
req.body.userId;
req.body.permissions;
req.body.score;
```

without server-side validation and authorization.

---

# 76. IDs

Publicly exposed database resources should use the UUID strategy defined in `DATABASE.md`.

Do not create sequential public identifiers merely for convenience.

---

# 77. Tests

Tests should follow the same naming conventions as production code.

Example:

```text
score.service.spec.ts
result.service.spec.ts
authorization.service.spec.ts
```

---

# 78. Test Naming

Test names should describe behavior.

Preferred:

```ts
it('should reject score updates for completed matches', ...);
```

Avoid:

```ts
it('test 1', ...);
```

---

# 79. Test Organization

Tests should generally follow:

```text
Arrange
Act
Assert
```

Example:

```ts
// Arrange

// Act

// Assert
```

---

# 80. Security Tests

Security-sensitive modules must include negative tests.

Examples:

```text
Unauthorized user
Wrong role
Wrong sport scope
Revoked session
Invalid resource
```

---

# 81. Formatting Automation

The repository should eventually contain scripts similar to:

```json
{
    "scripts": {
        "format": "prettier --write .",
        "format:check": "prettier --check .",
        "lint": "eslint .",
        "typecheck": "tsc --noEmit",
        "test": "..."
    }
}
```

The final scripts depend on the chosen workspace configuration.

---

# 82. Prettier

Prettier should be the authority for mechanical formatting.

Developers should not manually argue about:

```text
Spaces
Indentation
Line wrapping
Quotes
Trailing commas
```

Run:

```bash
npm run format
```

when formatting the project.

---

# 83. Format Check

CI should run:

```bash
npm run format:check
```

A PR should not be merged if formatting checks fail.

---

# 84. ESLint

ESLint should enforce code-quality rules that Prettier cannot.

Examples:

```text
Unused variables
Unused imports
Dangerous patterns
TypeScript issues
React issues
```

---

# 85. Editor Integration

Developers should configure their editors to format automatically.

Recommended:

```text
Format On Save
```

This means most formatting problems disappear before code is committed.

---

# 86. Git Hooks

The project should eventually use Git hooks.

Recommended approach:

```text
Pre-commit
    ↓
Fast formatting/lint checks

Pre-push
    ↓
Relevant tests/type checks
```

The final implementation may use a tool such as Husky or an equivalent solution.

---

# 87. GitHub Actions

GitHub Actions should perform authoritative checks.

Example:

```text
Pull Request
     ↓
Install Dependencies
     ↓
Format Check
     ↓
Lint
     ↓
Type Check
     ↓
Tests
     ↓
Build
```

---

# 88. Formatting Is Not Optional

If the CI formatter check fails:

```text
PR cannot be considered ready.
```

The developer should run the formatter rather than manually editing dozens of lines.

---

# 89. ESLint Overrides

ESLint rules may be disabled for specific files when justified.

However:

```ts
// eslint-disable
```

should not be used casually.

If a rule must be disabled, the reason should be clear.

---

# 90. Prettier Overrides

Prettier configuration should remain centralized.

Individual developers should not create personal formatting configurations.

---

# 91. Editor Settings

The repository may include:

```text
.vscode/
```

configuration for recommended extensions and project settings.

Recommended extensions may include:

```text
ESLint
Prettier
EditorConfig
Prisma
```

The exact extension list can be finalized later.

---

# 92. Personal Editor Preferences

Developers may use any editor they prefer.

However:

> The repository's automated configuration is authoritative.

---

# 93. Generated Code

Generated files should not be manually formatted or edited unless explicitly intended.

Examples may include:

```text
Prisma generated client
Build output
Framework-generated files
```

---

# 94. Comments and Documentation

Code comments should not replace proper documentation.

If a behavior affects architecture:

```text
Update the relevant .md document.
```

---

# 95. Security Comments

Security-sensitive code may contain comments explaining why a particular check exists.

Example:

```ts
// Do not remove this authorization check.
// Possession of a match UUID does not imply permission to modify it.
```

Such comments can prevent future accidental security regressions.

---

# 96. Don't Over-Engineer

Readable code is not necessarily highly abstract code.

Prefer:

```ts
const match = await this.matchesService.getMatch(matchId);
```

over introducing five abstraction layers for a simple operation.

---

# 97. Don't Under-Engineer Security

Conversely, do not simplify security-sensitive code merely to make it shorter.

For example:

```ts
// Check permission
// Check sport scope
// Check match state
// Update score
// Audit
```

is preferable to hiding critical security logic inside unclear abstractions.

---

# 98. Code Review Style

Reviewers should distinguish between:

```text
Automated formatting issues
```

and:

```text
Actual design problems
```

Formatting should normally be left to Prettier.

Reviewers should spend their time on:

```text
Correctness
Security
Architecture
Maintainability
```

---

# 99. Code Review Question

Before approving a PR, ask:

> **Would I understand this code six months from now without asking the original author?**

If the answer is no, improve the code or documentation.

---

# 100. Style Exceptions

Exceptions are allowed when they make the code objectively clearer.

However:

```text
Exception
 ↓
Reason
 ↓
Review
```

should exist for significant deviations.

---

# 101. Final Style Example

A typical backend operation should visually resemble:

```ts
async updateMatch(
    matchId: string,
    updateMatchDto: UpdateMatchDto,
    user: AuthenticatedUser
) {

    // Get Match

    const match = await this.matchesService.getMatch(matchId);

    if(!match) {

        throw new NotFoundException('Match not found');

    }


    // Check Authorization

    this.authorizationService.assertCanUpdateMatch(
        user,
        match
    );


    // Validate Update

    this.matchesService.validateUpdate(
        match,
        updateMatchDto
    );


    // Update Match

    const updatedMatch = await this.prisma.match.update({
        where: {
            id: matchId
        },

        data: updateMatchDto
    });


    // Return Updated Match

    return updatedMatch;

}
```

The exact output will ultimately be determined by Prettier and the framework conventions, but the **logical separation and explicit readability** are intentional.

---

# 102. What Automation Should Do

The developer should be able to write:

```ts
const match = await service.getMatch(id);
```

and let the tooling turn it into the project's agreed formatting.

The developer should not spend time manually aligning:

```text
spaces
tabs
line breaks
commas
quotes
```

---

# 103. What Automation Should NOT Do

Automated formatting cannot decide:

```text
Is this architecture correct?
Is this permission check sufficient?
Should this query exist?
Should this data be public?
Is this business rule correct?
```

These require human review.

---

# 104. Formatting Workflow

```text
Developer writes code
        ↓
Save
        ↓
Prettier formats
        ↓
ESLint checks
        ↓
Developer fixes actual issues
        ↓
Commit
        ↓
GitHub Actions
        ↓
Final verification
```

---

# 105. Developer Checklist

Before opening a PR:

```text
[ ] Code is formatted
[ ] No unused imports
[ ] No unused variables
[ ] No unnecessary any
[ ] No debug console logs
[ ] Naming is descriptive
[ ] Functions are understandable
[ ] Comments explain important reasoning
[ ] Security checks are present
[ ] Tests are included where appropriate
[ ] Documentation updated where necessary
```

---

# 106. Golden Rules

### Rule 1

> **Let the formatter handle formatting.**

### Rule 2

> **Write code that reads naturally from top to bottom.**

### Rule 3

> **Use descriptive names.**

### Rule 4

> **Separate logical operations visually.**

### Rule 5

> **Keep functions focused.**

### Rule 6

> **Prefer explicit code over clever code.**

### Rule 7

> **Do not hide security logic.**

### Rule 8

> **Do not use `any` to escape TypeScript problems.**

### Rule 9

> **Comments should explain why.**

### Rule 10

> **Consistency is more important than personal preference.**

---

# 107. Relationship to Other Documents

```text
DEVELOPMENT.md
       │
       ▼
GIT_WORKFLOW.md
       │
       ▼
CODE_STYLE.md
       │
       ├── EditorConfig
       ├── Prettier
       ├── ESLint
       ├── Git Hooks
       └── GitHub Actions
               │
               ▼
          TESTING.md
               │
               ▼
          DEPLOYMENT.md
```

---

# 108. Status

**Approved Code Style Baseline**

Confirmed:

- TypeScript-first development.
- 4-space indentation baseline.
- Spaces instead of tabs.
- Generous logical whitespace.
- Explicit readable code.
- Descriptive naming.
- Section comments.
- Focused functions.
- Thin controllers.
- Business logic in services.
- DTO-based validation.
- Explicit authorization.
- Prettier.
- ESLint.
- EditorConfig.
- Git hooks.
- GitHub Actions.
- Automated formatting.
- Automated linting.
- Automated type checking.
- Automated testing.
- Human code review for architecture/security.

TBD:

- Final Prettier configuration.
- Final ESLint configuration.
- Final EditorConfig values if framework tooling requires changes.
- Exact Git hook implementation.
- Exact GitHub Actions workflow.
- Final CSS/styling conventions.
- Final import-order configuration.
- Final TypeScript strictness settings.

---

# 109. Final Principle

> **The codebase should look as if one team wrote it — even when seven different developers contributed to it.**

The goal is not to make everyone write code exactly like the project lead.

The goal is to make every developer's code:

```text
Consistent
Readable
Predictable
Automatically formatted
Automatically checked
Secure
Easy to maintain
```

while preserving the project's preferred explicit and structured coding style.
