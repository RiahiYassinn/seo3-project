# SEO3 GitHub Project Sprint Board

## Project Purpose

SEO3 is a microservices-based developer analytics and learning platform. The product lets developers connect GitHub, sync repositories, analyze contributor code activity, generate weakness profiles with an NLP/code-analysis service, and turn those findings into learning paths, documentation review tasks, or mentorship recommendations. The platform also includes admin user management, role-based dashboards, notifications, and a Docker-based local infrastructure stack.

Recommended GitHub Project fields:

- Status: Todo, In Progress, Done
- Sprint: Sprint 0, Sprint 1, Sprint 2, Sprint 3, Sprint 4
- Priority: P0, P1, P2
- Area: Frontend, Backend, NLP, Recommendation, Security, DevOps, Product

## Sprint 0 - Foundation Already Built

### Done

#### Card: Establish SEO3 microservices monorepo foundation

Description:
Set up the SEO3 monorepo with an API gateway, Next.js web client, shared TypeScript packages, and separate services for developer accounts, analysis, skills, recommendations, notifications, and NLP. This creates the technical foundation for independent service ownership while keeping local development coordinated through npm workspaces and Turbo.

Acceptance criteria:

- API gateway and service folders are present with individual package manifests.
- Shared packages exist for reusable types and utilities.
- Root scripts support development, build, test, lint, and Docker workflows.

Suggested fields: Priority P0, Area DevOps, Status Done, Sprint Sprint 0

#### Card: Implement authentication and role-based access foundation

Description:
Build the core authentication flow for registration, login, refresh tokens, logout, email verification, password reset, Google login hooks, and role-aware access for developer, tech lead, and admin users. The gateway delegates account operations to developer-service and returns normalized user profile data for the web client.

Acceptance criteria:

- Auth endpoints exist for register, login, refresh, logout, verify email, forgot password, reset password, change password, and current user.
- Developer-service stores users, refresh tokens, verification tokens, and password reset tokens.
- Frontend auth store and API client support authenticated requests and token refresh.

Suggested fields: Priority P0, Area Security, Status Done, Sprint Sprint 0

#### Card: Build admin backoffice user management

Description:
Deliver an admin dashboard for user management with role-based access, user listing, search, role filtering, create/update/delete operations, and statistics for users by role. This gives platform administrators the first operational backoffice surface.

Acceptance criteria:

- Admin routes exist under the web dashboard.
- API gateway exposes admin endpoints for user CRUD and stats.
- Developer-service supports admin user message patterns.
- Admin-only guards protect the relevant endpoints.

Suggested fields: Priority P1, Area Product, Status Done, Sprint Sprint 0

#### Card: Implement GitHub account linking and repository sync

Description:
Allow a developer to link a GitHub account using a personal access token, validate token ownership, encrypt the token, sync repositories through Octokit, and store repository metadata such as language, stars, forks, and sync timestamps.

Acceptance criteria:

- Developers can link and unlink GitHub integrations.
- Repository sync reads authenticated GitHub repositories.
- Synced repositories are stored per developer integration.
- GitHub token storage uses encryption before persistence.

Suggested fields: Priority P0, Area Backend, Status Done, Sprint Sprint 0

#### Card: Implement repository contributor analysis queue

Description:
Support contributor-level analysis requests for a selected repository. The developer-service validates selected contributors, stores batch state, emits Kafka `analysis.requested` events, tracks progress, and stores contributor profiles after analysis completion.

Acceptance criteria:

- API supports triggering analysis for one or more contributors.
- Batch state tracks queued, active, processed, and failed contributors.
- Progress, completion, and failure events update repository analysis status.
- Contributor profiles include quality score, skill level, weaknesses, recommendations, and analysis summary.

Suggested fields: Priority P0, Area Backend, Status Done, Sprint Sprint 0

#### Card: Build NLP code weakness analysis service

Description:
Create the FastAPI NLP/code-analysis service that consumes `commit.analysis` Kafka jobs, reassembles large repository snapshots, runs static and semantic analysis, builds a weakness profile, emits progress, and publishes `analysis.completed` or `analysis.failed` events.

Acceptance criteria:

- NLP service consumes Kafka analysis jobs.
- Static and semantic analyzers produce rule findings.
- Report builder outputs quality score, findings, strengths, weakness scores, skills, and learning resources.
- Service exposes health and direct `/analyze/code` endpoints.

Suggested fields: Priority P0, Area NLP, Status Done, Sprint Sprint 0

#### Card: Implement recommendation case generation pipeline

Description:
Generate actionable recommendation cases from completed analysis. The recommendation-service classifies outcomes into learning paths, docs reviews, or mentorship recommendations, stores history, calculates priority/confidence/effort, attaches evidence snapshots, and supports regeneration.

Acceptance criteria:

- Recommendation entities store type, status, scores, evidence, context, learning path, docs review, and mentor data.
- Service consumes `analysis.completed` when auto-generation is enabled.
- API supports developer recommendations, repository recommendations, contributor recommendations, regeneration, mentor assignment, and acknowledgement.
- Course catalog ingestion and RAG learning path services are wired into the module.

Suggested fields: Priority P0, Area Recommendation, Status Done, Sprint Sprint 0

#### Card: Implement notification persistence and read state

Description:
Create the notification-service to store user and role notifications, return unread counts, mark single notifications as read, mark all notifications as read, and consume notification events. Recommendation generation can create developer notifications through the service.

Acceptance criteria:

- Notification entity and migration exist.
- Notification endpoints support listing, sending, read, and read-all actions.
- Event consumer handles `notification.sent`.
- Recommendation-service can create recommendation-ready notifications.

Suggested fields: Priority P1, Area Backend, Status Done, Sprint Sprint 0

#### Card: Provide Docker-based local infrastructure

Description:
Define local infrastructure services for PostgreSQL, MongoDB, Redis, Kafka, Zookeeper, and Kafka UI. This gives developers a reproducible stack for running and testing the microservices locally.

Acceptance criteria:

- `docker-compose.yml` includes all required infrastructure services.
- Containers expose stable local ports.
- Health checks exist for PostgreSQL, MongoDB, Redis, and Kafka.
- Documentation explains how to start and inspect the stack.

Suggested fields: Priority P1, Area DevOps, Status Done, Sprint Sprint 0

## Sprint 1 - Developer Recommendation Experience

### In Progress

#### Card: Consolidate developer GitHub flow into the recommendations workspace

Description:
Redirect the developer GitHub pages to the new recommendations workspace so developers land in one clear surface for GitHub linking, recommendation review, and next-step actions. Current local changes show the GitHub list and repository detail pages being replaced by redirects to `/dashboard/developer/recommendations`.

Acceptance criteria:

- `/dashboard/developer/github` redirects authenticated developers to recommendations.
- `/dashboard/developer/github/:repositoryId` redirects authenticated developers to recommendations.
- Unauthenticated users are sent to login.
- Non-developer roles are sent to the general dashboard.

Suggested fields: Priority P1, Area Frontend, Status In Progress, Sprint Sprint 1

#### Card: Finish developer recommendations overview page

Description:
Complete the refreshed developer recommendations page that combines GitHub account linking, recommendation stats, recommendation cards, repository names, priority, confidence, effort, generated date, top issue, recommendation recap, and mark-completed behavior. The page should be polished, resilient, and ready for developer daily use.

Acceptance criteria:

- Page loads GitHub integration, recommendations, and repositories together.
- Linked and unlinked GitHub states are handled clearly.
- Recommendation cards show type, status, priority, repository, contributor, issue, recommendation recap, confidence, effort, and generated date.
- Mark completed updates card state without a full reload.
- Error, success, loading, empty, and refreshing states are covered.

Suggested fields: Priority P0, Area Frontend, Status In Progress, Sprint Sprint 1

#### Card: Finish recommendation detail page for developers

Description:
Ship the new recommendation detail route so developers can inspect the underlying analysis evidence before marking a recommendation complete. The page should render detected gaps, findings, course matches, success criteria, mentorship context, docs-review checklist, learning path steps, context signals, and generation details.

Acceptance criteria:

- `/dashboard/developer/recommendations/:recommendationId` loads authenticated developer data.
- Detail page maps repository IDs to repository names.
- Missing recommendation state is handled with a useful empty state.
- Mark completed action works from the detail view.
- Detail component renders all recommendation types without layout breakage.

Suggested fields: Priority P0, Area Frontend, Status In Progress, Sprint Sprint 1

#### Card: Update navigation for the recommendation-first developer workspace

Description:
Align the navbar and developer dashboard links with the new recommendation-first flow. Developers should have a clear path to their recommendation workspace, while legacy GitHub analysis links should not lead to duplicate or stale pages.

Acceptance criteria:

- Developer navigation points to the current recommendations workspace.
- Removed or redirected routes do not appear as primary navigation destinations.
- Admin and tech lead navigation remains unaffected.
- Mobile and desktop navigation are both checked.

Suggested fields: Priority P1, Area Frontend, Status In Progress, Sprint Sprint 1

#### Card: QA recommendation acknowledgement and status transitions

Description:
Validate the full developer acknowledgement flow from UI to API gateway to recommendation-service. Confirm that open and assigned recommendations can be marked completed, completed recommendations cannot be submitted repeatedly, and the UI reflects the persisted result.

Acceptance criteria:

- Acknowledgement succeeds for recommendations owned by the current developer.
- Completed recommendations render as completed in list and detail views.
- Unauthorized or cross-user acknowledgement attempts are rejected.
- Loading and error states are visible during failed or slow requests.

Suggested fields: Priority P0, Area Product, Status In Progress, Sprint Sprint 1

## Sprint 2 - Analysis Automation and Repository Intelligence

### Todo

#### Card: Implement GitHub webhook processing in analysis-service

Description:
Replace the placeholder GitHub webhook handler with real event processing for push and pull request events. The handler should verify payload shape, extract repository and commit context, map the event to a known integration or repository, and enqueue analysis work through Kafka.

Acceptance criteria:

- `POST /webhook/github` handles supported GitHub events beyond acknowledgement.
- Push events extract commits, repository metadata, and sender details.
- Pull request events extract PR metadata and changed branch context.
- Valid events emit analysis jobs or repository sync/update events.
- Unsupported events return a safe no-op response with logging.

Suggested fields: Priority P0, Area Backend, Status Todo, Sprint Sprint 2

#### Card: Add webhook signature verification and replay protection

Description:
Secure GitHub webhook ingestion by validating GitHub signatures, rejecting invalid payloads, and preventing duplicate processing of the same delivery ID. This is required before exposing webhook endpoints outside local development.

Acceptance criteria:

- Webhook secret is configurable through environment variables.
- `X-Hub-Signature-256` is validated using constant-time comparison.
- Duplicate `X-GitHub-Delivery` IDs are ignored or safely idempotent.
- Invalid signatures return an unauthorized response and do not enqueue work.
- Security failures are logged without leaking secrets.

Suggested fields: Priority P0, Area Security, Status Todo, Sprint Sprint 2

#### Card: Complete GitLab webhook support or remove it from public API docs

Description:
The analysis gateway and analysis-service expose GitLab webhook endpoints, but the implementation currently only acknowledges requests. Decide whether GitLab support is in scope for this release, then either implement push/MR processing or hide it from the active API surface.

Acceptance criteria:

- Product decision is documented.
- If in scope, GitLab push and merge request events enqueue analysis jobs.
- If out of scope, frontend/docs/API descriptions do not imply active GitLab support.
- Tests cover the chosen behavior.

Suggested fields: Priority P2, Area Product, Status Todo, Sprint Sprint 2

#### Card: Add repository analysis history and audit trail

Description:
Persist each analysis run separately so users can inspect previous analysis results, failures, timestamps, contributors, and generated recommendations. Current repository state stores the latest summary; a history model will support trend reporting and debugging.

Acceptance criteria:

- Analysis run entity or collection captures repository, contributor, status, started/completed timestamps, summary, metadata, and failure reason.
- Completion and failure handlers create immutable run records.
- API can return recent analysis runs for a repository and contributor.
- Recommendation records link back to the analysis run that generated them.

Suggested fields: Priority P1, Area Backend, Status Todo, Sprint Sprint 2

#### Card: Add real-time analysis progress in the web client

Description:
Surface analysis progress updates to the user while contributor analysis is running. The backend already publishes progress to repository state, but the web experience should avoid requiring manual refresh for long-running analysis batches.

Acceptance criteria:

- UI shows queued, in progress, completed, and failed contributor states.
- Progress percentage and current stage update automatically.
- Implementation uses polling, server-sent events, or websockets based on project constraints.
- Failed contributors display actionable failure messages.

Suggested fields: Priority P1, Area Frontend, Status Todo, Sprint Sprint 2

#### Card: Improve repository snapshot limits and large-repo resilience

Description:
Harden the repository snapshot collection path for large repositories, rate limits, binary files, oversized diffs, and GitHub API failures. Analysis should degrade gracefully and explain what was skipped.

Acceptance criteria:

- File inclusion and exclusion rules are documented.
- Oversized files, binaries, and generated files are skipped predictably.
- GitHub API rate limit responses trigger retry/backoff where appropriate.
- Analysis metadata records truncation, skipped files, diff size, and file counts.
- User-facing analysis status explains partial analysis results.

Suggested fields: Priority P1, Area Backend, Status Todo, Sprint Sprint 2

## Sprint 3 - Recommendation, Mentorship, and Learning Workflows

### Todo

#### Card: Build tech lead mentor queue UI

Description:
Create a tech lead workflow for viewing mentorship recommendations, filtering by priority and status, assigning themselves, and tracking assigned developer follow-ups. The backend supports mentor queues and assignment, but the user experience needs to be completed.

Acceptance criteria:

- Tech leads can view open mentorship recommendations.
- Tech leads can assign themselves to eligible recommendations.
- Assigned items show mentor, developer, repository, contributor, priority, and due window.
- Completed and resolved mentorship items are separated from active queue items.
- Empty, loading, and error states are covered.

Suggested fields: Priority P1, Area Frontend, Status Todo, Sprint Sprint 3

#### Card: Add recommendation feedback capture

Description:
Let developers and mentors provide feedback on recommendations so the platform can learn whether a learning path, docs review, or mentorship suggestion was useful. Recommendation entities already include a feedback field, but no complete feedback workflow is exposed.

Acceptance criteria:

- Developer can rate a recommendation and add optional notes.
- Mentor can add outcome notes for mentorship recommendations.
- Feedback is persisted with timestamp and user context.
- Admin or analytics view can review feedback trends.
- Feedback data is considered during future recommendation regeneration.

Suggested fields: Priority P1, Area Product, Status Todo, Sprint Sprint 3

#### Card: Add course catalog management UI

Description:
Provide an admin interface for ingesting and reviewing the learning course catalog used by the RAG recommendation pipeline. The service has catalog ingestion support, but catalog operations need an operational UI and validation.

Acceptance criteria:

- Admins can upload or trigger ingestion of a course catalog file.
- Ingestion result shows processed count, skipped count, and errors.
- Admins can search/browse courses by skill, provider, rating, and type.
- Invalid catalog records produce clear validation messages.

Suggested fields: Priority P2, Area Product, Status Todo, Sprint Sprint 3

#### Card: Build skill profile and skill graph views

Description:
Expose developer skill data generated from analysis in a clear dashboard. Skill-service ingests analysis completion events and stores skill profiles, but the frontend should show strengths, weakness scores, proficiency trends, and recommended next actions.

Acceptance criteria:

- Developer profile page shows overall code quality and top skills.
- Weakness scores and strengths are displayed in a readable way.
- Repository and contributor context is linked where available.
- Skill graph endpoint is either implemented fully or hidden until ready.
- Data refreshes after new analysis completes.

Suggested fields: Priority P1, Area Product, Status Todo, Sprint Sprint 3

#### Card: Add admin recommendation operations view

Description:
Give admins a full operational view of generated recommendations across developers, repositories, contributors, and recommendation types. Admins should be able to inspect evidence, regenerate recommendations, assign mentors, and monitor unresolved high-priority cases.

Acceptance criteria:

- Admin can list and filter recommendations by type, status, priority, developer, repository, and contributor.
- Admin can open detailed evidence for each recommendation.
- Admin can regenerate recommendations when newer analysis exists.
- Admin can assign or reassign mentors.
- High-priority open recommendations are easy to identify.

Suggested fields: Priority P1, Area Product, Status Todo, Sprint Sprint 3

## Sprint 4 - Production Hardening, Security, and Quality

### Todo

#### Card: Replace personal access token GitHub linking with GitHub OAuth or GitHub App flow

Description:
Move away from manually entered GitHub personal access tokens toward a safer GitHub OAuth or GitHub App installation flow. This reduces credential handling risk, improves revocation, and gives the platform a more professional onboarding experience.

Acceptance criteria:

- Product decision is made between OAuth app and GitHub App.
- User can connect GitHub through an authorization/install flow.
- Tokens are scoped minimally and rotated or refreshed appropriately.
- Existing PAT-based integrations have a migration or deprecation path.
- Documentation and UI no longer ask users to paste broad personal tokens for production use.

Suggested fields: Priority P0, Area Security, Status Todo, Sprint Sprint 4

#### Card: Remove plaintext password delivery from registration flow

Description:
The current registration flow sends credentials email with the plaintext password captured before hashing. Replace this with safer onboarding copy, verification links, and password reset flows so the platform never transmits or stores user passwords outside the hash path.

Acceptance criteria:

- Registration no longer sends plaintext password by email.
- Verification email contains only a verification link or token.
- Password reset flow remains available for account recovery.
- Tests confirm no email payload contains plaintext password fields.
- Security documentation notes the corrected behavior.

Suggested fields: Priority P0, Area Security, Status Todo, Sprint Sprint 4

#### Card: Implement real email and Slack notification delivery

Description:
Complete notification delivery beyond in-app persistence. Email service currently contains placeholder sending logic, and Slack integration is only scaffolded. Notifications should support configurable channels with reliable failure logging.

Acceptance criteria:

- Email provider configuration is environment-driven.
- Email service sends verification, password reset, recommendation, and system messages.
- Slack module can send selected notification types to configured channels.
- Delivery failures are logged and do not break primary workflows.
- Local development can use a safe console or test transport.

Suggested fields: Priority P1, Area Backend, Status Todo, Sprint Sprint 4

#### Card: Add automated test coverage for gateway and NestJS services

Description:
Expand test coverage beyond the NLP service. Add focused unit and integration tests for authentication, GitHub integration, repository analysis queueing, recommendation generation, notification creation, and admin authorization.

Acceptance criteria:

- API gateway auth and recommendation routes have tests.
- Developer-service GitHub linking, sync, and analysis state handlers have tests.
- Recommendation-service routing logic and persistence have tests.
- Notification-service recipient and read-state behavior has tests.
- CI can run these tests reliably.

Suggested fields: Priority P0, Area Quality, Status Todo, Sprint Sprint 4

#### Card: Add frontend regression tests for core workflows

Description:
Cover the highest-value web flows with frontend tests so auth, GitHub linking, recommendations, admin user management, and mentor workflows do not regress. Use the testing stack already preferred by the project or add a minimal Playwright setup.

Acceptance criteria:

- Tests cover login and role-based dashboard routing.
- Tests cover GitHub linked and unlinked recommendation states.
- Tests cover recommendation list, detail, and mark-completed behavior.
- Tests cover admin user table search/filter basics.
- Test commands are documented and runnable from the monorepo.

Suggested fields: Priority P1, Area Quality, Status Todo, Sprint Sprint 4

#### Card: Create GitHub Actions CI pipeline

Description:
Add CI automation for linting, building, testing, and validating the monorepo. Deployment documentation references CI/CD, but no workflow files are present in the repository scan.

Acceptance criteria:

- GitHub Actions workflow runs on pull requests and pushes to main/develop.
- Node workspaces install with caching.
- TypeScript builds run for gateway, services, shared packages, and web client.
- Python NLP tests and linting run.
- CI status is required before merging once stable.

Suggested fields: Priority P1, Area DevOps, Status Todo, Sprint Sprint 4

#### Card: Standardize database migrations for production

Description:
Move production schema changes to repeatable migrations across services and document the migration command path. Current docs mention migrations, and some services include SQL migration files, but the workflow needs to be consistent before production deployment.

Acceptance criteria:

- Developer-service, recommendation-service, and notification-service schemas have migration strategy documented.
- TypeORM synchronize is disabled for production.
- Migration scripts are available from package scripts or documented commands.
- Production deployment guide includes migration order and rollback notes.

Suggested fields: Priority P1, Area DevOps, Status Todo, Sprint Sprint 4

#### Card: Add observability and operational health checks

Description:
Improve production operability with consistent health endpoints, structured logs, Kafka consumer lag visibility, analysis queue metrics, and service-level status. This is especially important because analysis is asynchronous and spans multiple services.

Acceptance criteria:

- Every service exposes a health endpoint.
- Health checks include dependencies where appropriate, such as database and Kafka connectivity.
- Logs include correlation IDs for analysis requests.
- Metrics or logs expose queue depth, consumer failures, analysis duration, and recommendation generation outcomes.
- Deployment docs explain how to inspect service health.

Suggested fields: Priority P1, Area DevOps, Status Todo, Sprint Sprint 4

#### Card: Harden environment and secret management

Description:
Review and harden environment variables, secrets, token encryption, JWT secrets, database credentials, CORS origins, and production defaults. The repository contains local `.env` usage and encryption-dependent code that should fail safely when required secrets are missing.

Acceptance criteria:

- Required environment variables are validated on startup.
- Missing token encryption key, JWT secret, database credentials, and Kafka brokers fail with clear errors.
- Production CORS origins are restricted.
- Example environment file contains safe placeholders only.
- Secrets are not logged or exposed through API responses.

Suggested fields: Priority P0, Area Security, Status Todo, Sprint Sprint 4

#### Card: Update documentation to match current implementation

Description:
Refresh README and docs so they match current ports, scripts, routes, implemented features, and known limitations. Some docs reference older paths or future work that is now partially implemented, while other active features are missing from docs.

Acceptance criteria:

- README explains the current product purpose and supported workflows.
- Architecture docs reflect contributor analysis, recommendation cases, notifications, and current Kafka topics.
- GitHub integration docs reflect contributor analysis and recommendation-first developer flow.
- Auth docs remove outdated routes and describe the current cookie/token behavior accurately.
- Deployment docs match actual scripts and service ports.

Suggested fields: Priority P2, Area Documentation, Status Todo, Sprint Sprint 4

