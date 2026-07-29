# SEO3 Platform Deployment Guide

## Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- MongoDB 6+
- Apache Kafka
- Redis

## Local Development

### 1. Start Infrastructure Services

```bash
# Start databases, Kafka, and Redis
docker-compose up -d
```

### 2. Set Up Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configurations
```

### 3. Install Dependencies

```bash
# Installs every workspace from the single root lockfile
npm ci
```

### 4. Run Database Migrations

```bash
# PostgreSQL migrations (if using a migration tool)
cd services/developer-service
npm run migration:run

# MongoDB indexes are created automatically on first run
```

### 5. Start Services

```bash
# Start all services in development mode
npm run dev

# Or start services individually:
npm run dev:gateway      # API Gateway on port 3000
npm run dev:developer    # Developer Service on port 3001
npm run dev:skill        # Skill Service on port 3002
npm run dev:analysis     # Analysis Service on port 3003
npm run dev:recommendation # Recommendation Service on port 3004
npm run dev:notification   # Notification Service on port 3005

# NLP Service (Python)
cd services/nlp-service
python -m uvicorn main:app --reload --port 8000

# Web Client
npm run dev:client       # Next.js on port 3000
```

## Production Deployment

### Required environment

`docker-compose.prod.yml` reads all credentials from the environment and
refuses to start if any of these are missing:

| Variable             | Purpose                    |
| -------------------- | -------------------------- |
| `POSTGRES_PASSWORD`  | Postgres superuser password |
| `MONGODB_PASSWORD`   | MongoDB root password       |
| `JWT_SECRET`         | Access token signing key    |
| `JWT_REFRESH_SECRET` | Refresh token signing key   |

Everything else falls back to a sensible default — see `.env.example`.

### Using Docker Compose

```bash
cp .env.example .env    # then fill in the secrets above

# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop all services
docker compose -f docker-compose.prod.yml down
```

To run images published by CI instead of building on the host:

```bash
export REGISTRY=ghcr.io/riahiyassinn/seo3-project
export IMAGE_TAG=sha-1a2b3c4        # or a release tag such as 1.4.0
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Building Individual Services

Every image builds **from the repository root**. This is an npm-workspaces
monorepo with a single root `package-lock.json`, so `npm ci` cannot run from
inside a service directory:

```bash
docker build -f api-gateway/Dockerfile                  -t seo3/api-gateway .
docker build -f services/developer-service/Dockerfile   -t seo3/developer-service .
docker build -f services/skill-service/Dockerfile       -t seo3/skill-service .
docker build -f services/analysis-service/Dockerfile    -t seo3/analysis-service .
docker build -f services/recommendation-service/Dockerfile -t seo3/recommendation-service .
docker build -f services/notification-service/Dockerfile   -t seo3/notification-service .
docker build -f services/nlp-service/Dockerfile         -t seo3/nlp-service .
docker build -f client/web/Dockerfile                   -t seo3/web-client .
```

Each Node image is multi-stage: dependencies are installed once from the root
lockfile, the workspace is built with `turbo`, then a pruned production-only
dependency tree is copied into a slim runtime stage that runs as a non-root
user.

## Service URLs

- API Gateway: http://localhost:3000
- API Documentation: http://localhost:3000/api/docs
- Developer Service: http://localhost:3001
- Skill Service: http://localhost:3002
- Analysis Service: http://localhost:3003
- Recommendation Service: http://localhost:3004
- Notification Service: http://localhost:3005
- NLP Service: http://localhost:8000
- Web Client: http://localhost:3010

## Infrastructure URLs

- PostgreSQL: localhost:5432
- MongoDB: localhost:27017
- Redis: localhost:6379
- Kafka: localhost:29092
- Zookeeper: localhost:2181
- Kafka UI: http://localhost:8080

## Health Checks

Check service health:

```bash
# API Gateway
curl http://localhost:3000/api/v1/health

# Developer Service
curl http://localhost:3001/health

# NLP Service
curl http://localhost:8000/health
```

## Monitoring

### View Service Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api-gateway
docker-compose logs -f developer-service
```

### Kafka Topics

View Kafka topics and messages:

```bash
# Access Kafka UI
open http://localhost:8080

# Or use Kafka CLI
docker exec -it seo3-kafka kafka-topics --list --bootstrap-server localhost:9092
```

## Troubleshooting

### Services won't start

1. Check if all infrastructure services are running:

   ```bash
   docker-compose ps
   ```

2. Check service logs for errors:

   ```bash
   docker-compose logs [service-name]
   ```

3. Verify environment variables are set correctly

### Database connection issues

1. Ensure databases are healthy:

   ```bash
   docker-compose ps postgres mongodb redis
   ```

2. Test database connections:

   ```bash
   # PostgreSQL
   docker exec -it seo3-postgres psql -U seo3_user -d seo3_db

   # MongoDB
   docker exec -it seo3-mongodb mongosh -u seo3_user -p seo3_password
   ```

### Kafka connection issues

1. Check Zookeeper is running:

   ```bash
   docker-compose ps zookeeper
   ```

2. Verify Kafka is connected to Zookeeper:
   ```bash
   docker-compose logs kafka
   ```

## Scaling Services

Scale specific services:

```bash
# Scale recommendation service to 3 instances
docker-compose -f docker-compose.prod.yml up -d --scale recommendation-service=3
```

## Security Notes

1. Change default passwords in `.env` for production
2. Use proper JWT secrets
3. Configure CORS properly
4. Enable HTTPS/TLS for production
5. Use secrets management (e.g., AWS Secrets Manager, HashiCorp Vault)

## Backup and Restore

### PostgreSQL Backup

```bash
docker exec seo3-postgres pg_dump -U seo3_user seo3_db > backup.sql
```

### MongoDB Backup

```bash
docker exec seo3-mongodb mongodump --username seo3_user --password seo3_password --out /backup
```

## CI/CD

Two workflows live in `.github/workflows`.

### CI — `ci.yml`

Runs on pull requests and on pushes to `main` / `develop`.

| Job                | What it does                                                          |
| ------------------ | --------------------------------------------------------------------- |
| **Node workspaces** | `turbo run lint typecheck build test` across all 9 TypeScript packages |
| **NLP service**     | `ruff` lint, `bandit` scan (fails on high severity), import check, `pytest` |
| **Docker**          | Builds all 8 images in parallel (no push) to prove the Dockerfiles work |
| **CI status**       | Aggregates the above into one required check                          |

Turbo's cache is restored from `actions/cache` and Docker layers from the
GitHub Actions cache, so unchanged packages and layers are skipped.

Point branch protection at the single **CI status** check rather than at each
job, so the matrix can grow without reconfiguring the branch rules.

### CD — `cd.yml`

Runs on pushes to `main` and on `v*.*.*` tags. It re-runs the full verification,
then builds and pushes all 8 images to GHCR at
`ghcr.io/<owner>/<repo>/<service>`:

| Trigger        | Tags produced                      |
| -------------- | ---------------------------------- |
| push to `main` | `latest`, `main`, `sha-<short>`    |
| tag `v1.4.0`   | `1.4.0`, `1.4`, `sha-<short>`      |

Authentication uses the built-in `GITHUB_TOKEN` with `packages: write` — no
registry secrets to manage.

> **The `deploy` job is a placeholder.** No host is wired up yet, so it only
> writes the image tag and the exact `docker compose` commands to the run
> summary. Replace that step with your real deploy (SSH, Helm, ECS, …) and
> create the `staging` / `production` environments under
> *Settings → Environments* to gate production behind an approval.

### Running the same checks locally

```bash
npm run ci          # lint + typecheck + build + test, exactly as CI runs it
npm run lint:fix    # apply ESLint fixes
```
