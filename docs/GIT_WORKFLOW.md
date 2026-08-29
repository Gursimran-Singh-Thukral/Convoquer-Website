# Convoquer'26 Digital Platform — Git & GitHub Workflow

**Project:** Convoquer'26 Digital Platform  
**Repository Model:** Monorepo  
**Version Control:** Git  
**Remote Platform:** GitHub  
**Primary Branch:** `main`  
**Development Model:** Feature Branch + Pull Request  
**Team Size:** ~6–7 Developers + Project Lead  
**Document Version:** 1.0  
**Status:** Approved Development Baseline

---

# 1. Purpose

This document defines how the Convoquer'26 development team will use Git and GitHub.

The objectives are to:

- Keep the repository clean.
- Prevent accidental breaking changes.
- Make collaboration predictable.
- Teach beginners a professional Git workflow.
- Make every change traceable.
- Prevent direct uncontrolled changes to production code.
- Make code review mandatory for important changes.
- Integrate automated quality checks.
- Make it easy to identify who changed what and why.

---

# 2. Core Principle

> **Nobody should be afraid of Git, but nobody should be allowed to casually break the repository either.**

The workflow should be simple enough for a beginner while still following professional software-development practices.

---

# 3. Repository Structure

The repository will follow:

```text
convoquer26/
│
├── client/
├── server/
├── docs/
│
├── .github/
│   ├── workflows/
│   ├── pull_request_template.md
│   └── ...
│
├── .gitignore
├── README.md
└── ...
```

---

# 4. Main Branch

The primary branch is:

```text
main
```

`main` represents code that is considered stable.

Developers must not directly push feature work to `main`.

---

# 5. Main Branch Protection

The `main` branch should be protected through GitHub.

Recommended protections:

```text
[✓] Pull Request required
[✓] Automated checks required
[✓] Branch must be up to date before merge where practical
[✓] Force pushes disabled
[✓] Branch deletion restricted
```

The exact GitHub configuration will be finalized during repository setup.

---

# 6. Development Model

The project uses:

```text
Feature Branch
      ↓
Development
      ↓
Local Testing
      ↓
Push
      ↓
Pull Request
      ↓
Automated Checks
      ↓
Code Review
      ↓
Merge
      ↓
main
```

---

# 7. Why Feature Branches?

Feature branches prevent unfinished work from entering `main`.

Example:

```text
main
 │
 ├── feature/google-auth
 ├── feature/live-score
 ├── feature/public-schedule
 └── feature/hospitality-dashboard
```

---

# 8. Branch Naming Convention

Branches must follow a predictable naming scheme.

```text
feature/<name>
fix/<name>
refactor/<name>
test/<name>
docs/<name>
chore/<name>
```

Examples:

```text
feature/google-auth
feature/football-fixtures
feature/live-score
feature/hospitality-dashboard

fix/result-approval
fix/mobile-schedule

refactor/match-service

test/score-validation

docs/api-spec

chore/update-dependencies
```

---

# 9. Branch Naming Rules

Branch names should:

- Use lowercase.
- Use hyphens.
- Be descriptive.
- Be reasonably short.
- Represent one logical task.

Avoid:

```text
mybranch
test
new
final
changes
gursimranbranch
working
```

---

# 10. One Branch — One Purpose

A branch should normally contain one logical feature or fix.

Bad:

```text
feature/dashboard
```

containing:

```text
Dashboard
Authentication
Database migration
Random CSS changes
Bug fixes
```

Preferred:

```text
feature/dashboard-layout
feature/google-auth
fix/dashboard-mobile-layout
```

---

# 11. Starting Work

Before starting a task:

```bash
git switch main
git pull origin main
```

Then create a branch:

```bash
git switch -c feature/<feature-name>
```

Example:

```bash
git switch -c feature/live-score
```

---

# 12. Never Start From an Outdated Branch

Before beginning a new feature, make sure `main` is current.

Preferred:

```text
main
 ↓
git pull
 ↓
new feature branch
```

---

# 13. Checking Current Branch

Use:

```bash
git branch
```

The current branch will be marked.

Developers should always know which branch they are working on before committing.

---

# 14. Checking Changes

Use:

```bash
git status
```

frequently.

This shows:

- Current branch.
- Modified files.
- Untracked files.
- Staged files.

---

# 15. Reviewing Changes

Before committing:

```bash
git diff
```

Developers should understand what they are committing.

---

# 16. Staging Changes

Stage only the intended changes.

Example:

```bash
git add client/src/components/ScoreCard.tsx
```

or:

```bash
git add .
```

`git add .` should be used only after checking `git status`.

---

# 17. Commit Messages

Commit messages should explain the change.

Recommended format:

```text
<type>: <short description>
```

Examples:

```text
feat: add match creation API
fix: prevent duplicate score events
docs: update RBAC specification
test: add score validation tests
refactor: simplify match service
chore: update dependencies
```

---

# 18. Commit Types

| Type       | Purpose                      |
| ---------- | ---------------------------- |
| `feat`     | New functionality            |
| `fix`      | Bug fix                      |
| `docs`     | Documentation                |
| `test`     | Tests                        |
| `refactor` | Code restructuring           |
| `style`    | Non-functional style changes |
| `chore`    | Maintenance                  |
| `perf`     | Performance improvement      |

---

# 19. Good Commit Messages

Good:

```text
feat: add football match creation
fix: reject score updates for completed matches
test: add result approval authorization tests
docs: document session architecture
```

Bad:

```text
update
changes
final
done
working
fix
new code
```

---

# 20. Commit Size

Commits should represent logical units of work.

Preferred:

```text
feat: add match model
feat: add match creation service
test: add match validation
```

Avoid one giant commit:

```text
feat: complete entire backend
```

---

# 21. Do Not Commit Broken Code

A commit does not necessarily need to contain a complete feature, but it should normally leave the branch in a reasonable development state.

Before pushing a meaningful checkpoint:

```text
Format
Lint
Type Check
Tests
```

should pass where applicable.

---

# 22. Push a Branch

First push:

```bash
git push -u origin feature/<feature-name>
```

Example:

```bash
git push -u origin feature/live-score
```

Later:

```bash
git push
```

---

# 23. Pull Requests

A Pull Request is the normal path for merging code into `main`.

```text
Developer
   ↓
Feature Branch
   ↓
Push
   ↓
Pull Request
   ↓
Review
   ↓
Checks
   ↓
Merge
```

---

# 24. Pull Request Title

PR titles should be clear.

Examples:

```text
feat: implement live score event API
fix: prevent unauthorized result approval
docs: add database documentation
```

---

# 25. Pull Request Description

Every meaningful PR should explain:

```text
## What
What was implemented?

## Why
Why was it needed?

## Changes
What was changed?

## Testing
How was it tested?

## Database
Were database changes made?

## API
Were API changes made?

## Security
Are there security implications?

## Screenshots
If UI changed, provide screenshots.
```

---

# 26. Pull Request Checklist

Before requesting review:

```text
[ ] Code works locally
[ ] Formatting passes
[ ] Lint passes
[ ] Type checking passes
[ ] Tests pass
[ ] No secrets committed
[ ] No unrelated changes
[ ] Documentation updated if necessary
[ ] Database migration included if necessary
[ ] API specification updated if necessary
[ ] Security implications considered
```

---

# 27. Code Review

The reviewer should evaluate:

```text
Correctness
Security
Maintainability
Architecture
Performance
Testing
Consistency
```

Reviewers should not focus only on formatting because automated tooling will handle formatting.

---

# 28. Reviewer Responsibilities

A reviewer should ask:

1. Does this solve the intended problem?
2. Does it follow the architecture?
3. Is authorization correct?
4. Could a malicious user abuse it?
5. Are errors handled?
6. Are tests sufficient?
7. Does it introduce unnecessary complexity?
8. Does it break another feature?

---

# 29. Security-Sensitive PRs

Additional attention is required for:

```text
Authentication
Sessions
RBAC
Permissions
Score Updates
Results
Database
Imports
File Uploads
Production Configuration
```

These changes should not be merged casually.

---

# 30. Who Can Approve?

The project lead should define the final approval policy.

Recommended baseline:

```text
Normal PR
→ At least 1 reviewer

Security-sensitive PR
→ Project Lead + appropriate reviewer

Major architecture change
→ Project Lead approval
```

---

# 31. Project Lead Responsibilities

The project lead should:

- Maintain architectural consistency.
- Resolve major technical disagreements.
- Review critical security changes.
- Protect `main`.
- Coordinate milestones.
- Ensure documentation remains synchronized.
- Help beginners understand Git.
- Prevent unnecessary scope expansion.

---

# 32. Developer Responsibilities

Every developer should:

- Keep their branch focused.
- Pull changes regularly.
- Resolve their own straightforward conflicts.
- Test before opening PRs.
- Explain their code.
- Respond to review comments.
- Never commit secrets.
- Never bypass security.

---

# 33. Keeping Branches Updated

If `main` changes significantly while working:

```bash
git fetch origin
git switch main
git pull origin main
```

Then update the feature branch according to the team's chosen integration strategy.

---

# 34. Merge Strategy

The project should use a consistent merge strategy.

Recommended initial approach:

```text
Pull Request
 ↓
Review
 ↓
Checks
 ↓
Squash Merge
 ↓
main
```

Squashing keeps the `main` history relatively clean.

---

# 35. Why Squash Merge?

A developer may have commits such as:

```text
fix
fix again
oops
final
actually final
```

These are useful during development but unnecessary in the main project history.

Squash merging produces a cleaner history:

```text
feat: implement live score updates
```

---

# 36. Pull Request Merges

Only merge after:

```text
[✓] Required reviews
[✓] Automated checks
[✓] Conflict resolution
[✓] Testing
```

are satisfied.

---

# 37. Merge Conflicts

Conflicts are normal.

They do not mean Git is broken.

Typical situation:

```text
Developer A
     ↓
main changed

Developer B
     ↓
old branch
```

Git cannot automatically determine which change should win.

---

# 38. Resolving Conflicts

Recommended process:

```text
Save current work
 ↓
Fetch latest changes
 ↓
Update branch
 ↓
Resolve conflicts
 ↓
Run tests
 ↓
Commit conflict resolution
 ↓
Push
```

---

# 39. Do Not Blindly Accept Changes

When resolving:

```text
Accept Current
Accept Incoming
Accept Both
```

do not choose randomly.

Understand the code first.

---

# 40. Conflict Resolution Rule

After resolving conflicts:

```text
Format
 ↓
Lint
 ↓
Type Check
 ↓
Tests
```

must be run before merging.

---

# 41. If a Developer Gets Stuck

The developer should ask for help.

They should not:

```text
Delete random code
Force push blindly
Disable checks
Remove tests
```

---

# 42. Force Push

Force pushing to `main` is prohibited.

Avoid force pushing shared branches unless the team explicitly agrees.

If history rewriting is necessary:

```text
git push --force-with-lease
```

is preferred over:

```text
git push --force
```

but should still be used carefully.

---

# 43. Protected Main

The GitHub repository should prevent:

```text
Direct push to main
Force push to main
```

where GitHub settings allow.

---

# 44. GitHub Issues

Work should be tracked through GitHub Issues.

A feature should generally have:

```text
Issue
 ↓
Developer
 ↓
Branch
 ↓
PR
 ↓
Merge
```

---

# 45. Issue Structure

An issue should contain:

```text
Title
Description
Acceptance Criteria
Priority
Assignee
Labels
Dependencies
```

---

# 46. Issue Example

```text
Title:
Implement Football Match Creation API

Description:
Create an API endpoint for authorized users to create
football fixtures.

Acceptance Criteria:
- Authorized Sports Coordinator can create a match.
- Coordinator can only create matches for their sport.
- Invalid teams are rejected.
- Duplicate/conflicting fixtures are rejected.
- Operation is audited.
- Tests are included.
```

---

# 47. Labels

Recommended labels:

```text
feature
bug
documentation
frontend
backend
database
security
testing
urgent
good-first-issue
blocked
```

---

# 48. Priority

Recommended:

```text
P0 — Critical
P1 — High
P2 — Medium
P3 — Low
```

---

# 49. Good First Issues

Since many developers are beginners, create `good-first-issue` tasks.

Examples:

```text
Add footer component
Create venue card
Add API loading state
Write simple unit test
Improve mobile spacing
Create public sports page
```

---

# 50. Avoid Assigning Critical Features as First Tasks

Do not give a beginner their first task as:

```text
Implement authentication
```

or:

```text
Implement result override security
```

Instead, let them first learn the project structure.

---

# 51. GitHub Milestones

Milestones should correspond to development phases.

Example:

```text
Milestone 1 — Project Setup
Milestone 2 — Authentication
Milestone 3 — Public Website
Milestone 4 — Competition Core
Milestone 5 — Live Scoring
Milestone 6 — Organizer Platform
Milestone 7 — Testing
Milestone 8 — Deployment
```

---

# 52. Issue → Branch Mapping

A useful convention:

```text
Issue #42
```

becomes:

```text
feature/42-live-score
```

This is optional but recommended.

---

# 53. PR → Issue Mapping

Every PR should reference its issue.

Example:

```text
Closes #42
```

This allows GitHub to automatically connect the PR and issue.

---

# 54. Database Migrations

Database migrations require extra care.

A database-related PR must include:

```text
Prisma schema
Migration
Relevant code changes
Tests
```

where applicable.

---

# 55. Migration Rule

Never modify an already-committed migration just because it is inconvenient.

If a migration has already been shared:

```text
Create a new migration
```

instead.

---

# 56. Production Migration

Production migrations must be performed through the approved deployment process.

Developers should not casually run destructive database commands against production.

---

# 57. Dangerous Database Commands

Commands that can destroy data must be clearly restricted.

Examples include:

```text
prisma migrate reset
DROP DATABASE
TRUNCATE
```

These must never be run against production.

---

# 58. Generated Files

Generated files should follow project rules.

Developers should not commit generated artifacts unless the project explicitly requires them.

---

# 59. Dependencies

Dependency changes should be deliberate.

A PR adding a dependency should explain:

```text
What does it provide?
Why is it needed?
Could existing tooling solve the problem?
Is it maintained?
Does it introduce security concerns?
```

---

# 60. Lockfiles

The project's package lockfile must be committed.

Do not casually delete or regenerate lockfiles to "fix" unrelated issues.

---

# 61. Secrets

Never commit:

```text
.env
API keys
OAuth secrets
Database passwords
Session secrets
Private keys
Production credentials
```

---

# 62. Accidentally Committed Secret

If a secret is accidentally committed:

> **Do not simply delete the file and assume the secret is safe.**

The secret must be considered compromised.

Recommended process:

```text
Identify
 ↓
Revoke / Rotate Secret
 ↓
Remove From Repository History if required
 ↓
Verify
 ↓
Document Incident
```

---

# 63. `.gitignore`

The repository must contain an appropriate `.gitignore`.

It should cover items such as:

```text
node_modules/
.env
.next/
dist/
coverage/
logs/
OS/editor temporary files
```

The exact list depends on the project tooling.

---

# 64. Pull Before Starting New Work

At the beginning of a work session:

```bash
git switch main
git pull origin main
```

Then create a fresh branch.

---

# 65. End-of-Day Workflow

Before finishing:

```text
Save work
 ↓
Check status
 ↓
Commit logical work
 ↓
Push branch
```

If the work is unfinished, the developer may push the branch without opening a PR.

---

# 66. Work in Progress

Incomplete work should not be merged into `main`.

If necessary, use:

```text
Draft Pull Request
```

to share progress.

---

# 67. Draft Pull Requests

Draft PRs are useful when:

- Feedback is needed.
- Architecture needs review.
- Work is incomplete.
- Another developer needs to understand progress.

---

# 68. PR Review Comments

Developers should treat review comments professionally.

Review is about improving the project, not criticizing the developer.

---

# 69. Resolving Review Comments

After making requested changes:

```text
Make change
 ↓
Commit
 ↓
Push
 ↓
Reply to review
 ↓
Request re-review
```

---

# 70. Do Not Hide Review Changes

Avoid modifying unrelated code simply to make the diff appear smaller.

The PR should remain honest about what changed.

---

# 71. Abandoned Branches

Once a feature is merged:

```text
Delete branch
```

unless the branch needs to remain for a specific reason.

This keeps the repository manageable.

---

# 72. Stale Branches

Old branches should periodically be reviewed.

Branches that are no longer relevant should be deleted.

---

# 73. Reverting a Bad Merge

If a merged change breaks production or critical functionality:

```text
Identify
 ↓
Assess
 ↓
Revert if necessary
 ↓
Investigate
 ↓
Fix properly
```

Do not panic-edit `main`.

---

# 74. Hotfixes

Critical production issues may use:

```text
hotfix/<name>
```

Example:

```text
hotfix/live-score-corruption
```

Hotfixes still require review and testing.

---

# 75. Hotfix Workflow

```text
main
 ↓
hotfix branch
 ↓
Fix
 ↓
Test
 ↓
Review
 ↓
Merge
 ↓
Deploy
```

The final workflow for synchronization after the hotfix should be documented and followed consistently.

---

# 76. Release Tags

Stable releases may be tagged.

Example:

```text
v0.1.0
v0.2.0
v1.0.0
```

The versioning strategy can be finalized before production.

---

# 77. Pre-Event Release

Before the event, a stable production version should be identified.

Example:

```text
v1.0.0-convoquer26
```

or an appropriate final versioning scheme.

---

# 78. Release Candidate

Before final production:

```text
Development
 ↓
Release Candidate
 ↓
Full Testing
 ↓
Bug Fixes
 ↓
Production Release
```

---

# 79. Code Ownership

Feature ownership should be clear.

However:

> No critical subsystem should be understood by only one person.

At least one additional developer should understand important areas such as:

```text
Authentication
Database
Scoring
Results
Deployment
```

---

# 80. Knowledge Transfer

When a developer completes a major feature, they should be able to explain:

```text
Purpose
Architecture
Database
API
Security
Testing
```

to another team member.

---

# 81. Branch Ownership

A branch belongs to the developer working on it.

Other developers should avoid making unrelated changes directly to someone else's branch.

---

# 82. Shared Branches

Avoid shared feature branches unless necessary.

Prefer:

```text
Developer A → branch A
Developer B → branch B
```

and integrate through PRs.

---

# 83. GitHub Actions

The repository should eventually use GitHub Actions for automated checks.

Typical workflow:

```text
Pull Request
     ↓
GitHub Actions
     ├── Install
     ├── Format Check
     ├── Lint
     ├── Type Check
     ├── Test
     └── Build
     ↓
Pass / Fail
```

---

# 84. Required Checks

Before production, the exact CI checks should include at minimum:

```text
Formatting
Linting
Type Checking
Tests
Build
```

Security/dependency checks should be added where practical.

---

# 85. CI Must Not Be Bypassed

Developers should not merge code simply because:

```text
"It works on my machine."
```

If CI fails, determine why.

---

# 86. Automated Formatting

Formatting should be enforced automatically.

The repository will later define:

```text
Prettier
ESLint
EditorConfig
Git hooks
GitHub Actions
```

The exact configuration will be documented in:

```text
CODE_STYLE.md
```

---

# 87. Local Git Hooks

The project may use Git hooks to catch problems before code reaches GitHub.

Possible checks:

```text
Pre-commit
→ Formatting / linting

Pre-push
→ Tests / type checking
```

Hooks should remain reasonably fast.

---

# 88. Don't Make Git Hooks Excessively Heavy

A developer should not wait several minutes for every commit.

Use:

```text
Fast checks
```

locally and:

```text
Full checks
```

in CI where appropriate.

---

# 89. Team Communication

GitHub is the source of truth for code changes.

WhatsApp/Discord/etc. may be used for communication, but decisions affecting code should eventually be reflected in:

```text
Issue
PR
Documentation
```

---

# 90. Architecture Changes

If a developer wants to introduce a significant architecture change:

```text
Do not silently implement it.
```

Open a discussion/issue first.

Examples:

```text
Changing authentication
Changing database architecture
Introducing Redis
Introducing another backend
Changing API style
Changing deployment architecture
```

---

# 91. Documentation Changes

When implementation changes an architectural decision, update the relevant documentation.

For example:

```text
Database change
→ DATABASE.md

RBAC change
→ RBAC.md

API change
→ API_SPEC.md

Security change
→ SECURITY.md
```

---

# 92. No Silent Architecture Drift

The codebase and documentation must remain aligned.

If they disagree:

```text
Stop
 ↓
Discuss
 ↓
Decide
 ↓
Update Documentation
 ↓
Implement
```

---

# 93. Emergency Communication

For event-critical issues:

```text
Production problem
 ↓
Notify project lead
 ↓
Create/identify issue
 ↓
Hotfix
 ↓
Review
 ↓
Deploy
 ↓
Document
```

---

# 94. Beginner Developer Workflow

A beginner should be able to follow this:

```text
1. Open GitHub Issue.

2. Understand the task.

3. Pull latest main.

4. Create branch.

5. Make small change.

6. Test locally.

7. Commit.

8. Push.

9. Open PR.

10. Wait for automated checks.

11. Address review comments.

12. Get approval.

13. Merge.

14. Delete branch.
```

---

# 95. Daily Git Cheat Sheet

### Get latest code

```bash
git switch main
git pull origin main
```

### Create branch

```bash
git switch -c feature/my-feature
```

### Check changes

```bash
git status
git diff
```

### Stage

```bash
git add .
```

### Commit

```bash
git commit -m "feat: add my feature"
```

### Push

```bash
git push -u origin feature/my-feature
```

### Switch branch

```bash
git switch branch-name
```

### Update remote information

```bash
git fetch origin
```

---

# 96. What Not to Do

Never casually:

```text
git push --force origin main
```

Never commit:

```text
.env
```

Never bypass:

```text
RBAC
Authentication
Tests
CI
```

Never merge:

```text
Code you do not understand
```

Never use:

```text
main
```

as your personal development branch.

---

# 97. Git Safety Rule

Before executing an unfamiliar destructive Git command:

```text
STOP
 ↓
Understand the command
 ↓
Ask someone if unsure
```

Especially for:

```text
reset --hard
rebase
push --force
branch deletion
```

---

# 98. Recommended Team Structure

For the ~6–7 developers:

```text
                    PROJECT LEAD
                         │
            ┌────────────┼────────────┐
            │            │            │
         Frontend     Backend       QA/Testing
            │            │            │
        Developers   Developers    Developers
```

The exact division of responsibilities will be defined in `IMPLEMENTATION_PLAN.md`.

---

# 99. Ownership of Critical Systems

At least two people should understand each:

```text
Authentication
RBAC
Database
Scoring
Results
Deployment
```

This prevents a single point of human failure.

---

# 100. Git Workflow Summary

```text
                    GITHUB ISSUE
                         │
                         ▼
                   CREATE BRANCH
                         │
                         ▼
                     DEVELOP
                         │
                         ▼
                   LOCAL TESTING
                         │
                         ▼
                       PUSH
                         │
                         ▼
                  PULL REQUEST
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        AUTOMATED CHECKS       CODE REVIEW
              │                     │
              └──────────┬──────────┘
                         ▼
                       MERGE
                         │
                         ▼
                        main
                         │
                         ▼
                     DEPLOYMENT
```

---

# 101. Golden Rules

### Rule 1

> **Never directly push feature work to `main`.**

### Rule 2

> **Every meaningful feature should have an issue.**

### Rule 3

> **One branch should have one purpose.**

### Rule 4

> **Write meaningful commit messages.**

### Rule 5

> **Review before merging.**

### Rule 6

> **Never commit secrets.**

### Rule 7

> **Never bypass security to make development easier.**

### Rule 8

> **Run tests before asking others to review your work.**

### Rule 9

> **Keep documentation synchronized with implementation.**

### Rule 10

> **If you don't understand a Git command, don't run it blindly.**

---

# 102. Final Development Philosophy

Git is not merely a backup system.

It provides:

```text
History
Accountability
Collaboration
Review
Recovery
Traceability
```

Every important change to Convoquer'26 should therefore be:

```text
Identifiable
Reviewable
Testable
Reversible
```

---

# 103. Relationship to Other Documents

```text
DEVELOPMENT.md
       │
       ▼
GIT_WORKFLOW.md
       │
       ├── Branching
       ├── Commits
       ├── Pull Requests
       ├── Reviews
       └── GitHub Actions
                │
                ▼
          CODE_STYLE.md
                │
                ├── Formatting
                ├── ESLint
                ├── Prettier
                └── Git Hooks
```

---

# 104. Status

**Approved Git Workflow Baseline**

Confirmed:

- GitHub repository.
- Monorepo.
- Protected `main`.
- Feature branches.
- Pull Requests.
- Code review.
- GitHub Issues.
- GitHub Milestones.
- Conventional commit types.
- Squash merging.
- Automated CI checks.
- Security-sensitive PR review.
- Database migration review.
- No direct production database changes.
- Secret protection.
- Hotfix workflow.
- Draft PRs.
- Branch cleanup.
- Documentation synchronization.

TBD:

- Exact repository name.
- Exact GitHub organization/account.
- Final branch protection settings.
- Exact GitHub Actions workflows.
- Required number of reviewers.
- Final CODEOWNERS configuration.
- Exact release/versioning scheme.

---

# 105. Final Principle

> **Issue → Branch → Code → Test → Pull Request → Review → Checks → Merge → Deploy.**

If the team follows this consistently, GitHub becomes more than a place to store the project — it becomes the system that keeps a team of first-time developers from stepping on each other's work.
