# Testing and Code Quality

Two runners cover the monorepo: **Jest** (via ts-jest) for every TypeScript
workspace, and **pytest** for `services/nlp-service`. Both emit coverage in a
format **SonarQube** consumes.

## Running tests

```bash
npm test                 # every TypeScript workspace, via turbo
npm run test:cov         # the same, with coverage
npm run test:python      # nlp-service
npm run test:python:cov  # the same, with coverage
```

A single workspace:

```bash
cd services/developer-service && npm test
cd services/developer-service && npx jest --watch
```

Python dependencies for testing live in a separate file so the runtime image
stays lean:

```bash
pip install -r services/nlp-service/requirements-dev.txt
```

## How the Jest setup is wired

`jest.preset.js` at the repo root holds the whole configuration. A workspace
only declares what differs:

```js
// services/developer-service/jest.config.js
const createJestConfig = require('../../jest.preset');

module.exports = createJestConfig();
```

Two details in the preset matter beyond convenience:

- **`process.env.TZ = 'UTC'`** is set before workers fork, so date formatting
  assertions behave the same on a laptop and on the CI runner.
- **`coverageReporters: [['lcov', { projectRoot: __dirname }]]`** makes the
  `SF:` entries in `lcov.info` repo-root relative. The Sonar scanner runs from
  the repo root; without this it would look for `src/foo.ts` at the top level,
  find nothing, and silently report 0% for every workspace.

Test files are `*.spec.ts` next to the code they cover. They are excluded from
`tsc` output via each workspace's `tsconfig.json`, so nothing ships in `dist/`.

Coverage lands at `<workspace>/coverage/lcov.info` and
`services/nlp-service/coverage.xml`.

### What is covered

Targeted unit tests on the logic that actually branches, with dependencies
supplied as plain object doubles rather than a DI container:

| Workspace | Under test |
|---|---|
| `shared/utils` | validators, date formatting, structured logger |
| `api-gateway` | avatar upload validation, in-memory rate limiter, downstream error translation |
| `services/developer-service` | user DTO mapping, self-service profile edit rules, mentor eligibility |
| `services/notification-service` | recipient fan-out, role broadcasts vs. personal rows, read/dismiss state |
| `services/skill-service` | proficiency averaging, skill-level banding, weakness derivation |
| `services/analysis-service` | file selection, diff assembly, GitHub retry backoff, TTL cache, bounded concurrency |
| `services/recommendation-service` | catalog normalisation, lexical gap scoring, cosine similarity, course/step stitching |
| `client/web` | admin workflow query-string round trip, notification store optimistic updates and rollback |
| `services/nlp-service` | diff parser, rule engine, report builder |

React pages are deliberately not rendered in tests. Doing so would pull in
jsdom, Testing Library and a Next transform pipeline for little signal; that
surface is covered by `next build` and `tsc --noEmit`.

## SonarQube

`sonar-project.properties` at the repo root defines the analysis: which source
roots to index, which files count as tests, and where the eight `lcov.info`
files and the Python `coverage.xml` live.

Source roots are listed explicitly rather than using `sonar.sources=.`.
Exclusions are applied *after* the file walk, so pointing the scanner at the
repo root makes it descend into every workspace's `node_modules` first — the
scan appears to hang at `Preprocessing files...` for minutes. **Add new
workspaces to `sonar.sources` (and `sonar.tests`) when you create them.**

**The scanner does not run tests.** Produce coverage first, or the report will
show 0%.

### Local instance

SonarQube and its database sit behind the `sonar` Compose profile, so a plain
`docker compose up -d` still starts only the datastores the app needs.

```bash
npm run sonar:up      # http://localhost:9000 — first boot takes a few minutes
```

Log in with `admin` / `admin`, change the password when prompted, then create a
project token (**My Account → Security**) and put it in `.env`:

```dotenv
SONAR_HOST_URL=http://sonarqube:9000
SONAR_TOKEN=sqp_...
```

`SONAR_HOST_URL` uses the service name because the scanner runs as a container
on the same Compose network, not on the host.

Then:

```bash
npm run test:cov
npm run test:python:cov
npm run sonar:scan    # one-shot sonar-scanner-cli container
```

`npm run sonar:down` stops the instance; the analysis history is kept in named
volumes.

> On Linux hosts SonarQube's embedded Elasticsearch needs
> `sysctl -w vm.max_map_count=262144`. Docker Desktop already sets this.

### In CI

The `sonarqube` job in [`ci.yml`](../.github/workflows/ci.yml) runs after
`node` and `python`, downloads the coverage artifacts those jobs uploaded, runs
the scan, and then waits on the project's quality gate.

It needs two repository secrets:

| Secret | Value |
|---|---|
| `SONAR_TOKEN` | A SonarQube user or "Analyze project" token |
| `SONAR_HOST_URL` | Base URL of your SonarQube server |

Without them every step no-ops with a warning, so forks and secret-less pull
requests still get a green build. The job checks out with `fetch-depth: 0`
because Sonar needs history to attribute issues and to decide which lines count
as new code on a pull request.
