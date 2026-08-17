# devlab Developer Analytics Platform

A microservices-based platform for analyzing developer activity, skill tracking, and personalized learning recommendations.

## Architecture Overview

### Client Layer

- **Web Browser (Next.js)**: Main web interface
- **Mobile App**: Future implementation
- **API Clients**: External API consumers

### API Gateway Layer

- **NestJS API Gateway**: Central entry point with:
  - Authentication & Authorization
  - Rate Limiting
  - Request Validation
  - Response Caching

### Core Microservices (NestJS)

1. **Developer Service**: Developer CRUD, profiles, authentication, mentor matching
2. **Skill Service**: Skill management, skill graph, proficiency calculations, learning paths
3. **Analysis Service**: Git integration, commit processing, PR analysis, webhook handling

### Supporting Services

- **NLP Service (FastAPI)**: Commit analysis, code parsing, tech detection, sentiment analysis
- **Recommendation Service (NestJS)**: Learning path generation, mentor matching, content curation
- **Notification Service (NestJS)**: Email, Slack, in-app notifications, webhooks

### Message Broker

- **Apache Kafka**: Event-driven communication between services

### Data Layer

- **PostgreSQL**: Main application data (users, auth, commits metadata, recommendations)
- **MongoDB**: NLP/Analytics data (raw commits, analysis results, skill graphs)
- **Redis**: Caching and session management

### External Integrations

- Git Platforms: GitHub, GitLab, Bitbucket
- Learning Platforms: Udemy, Coursera

## Project Structure

```
devlab-project/
├── api-gateway/           # NestJS API Gateway
├── services/
│   ├── developer-service/ # Developer microservice
│   ├── skill-service/     # Skill microservice
│   ├── analysis-service/  # Analysis microservice
│   ├── recommendation-service/ # Recommendation microservice
│   ├── notification-service/   # Notification microservice
│   └── nlp-service/       # FastAPI NLP service
├── client/
│   └── web/              # Next.js web application
├── shared/               # Shared libraries and utilities
├── infrastructure/       # Docker, K8s, Terraform configs
└── docs/                # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15+
- MongoDB 6+
- Apache Kafka
- Redis

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd devlab-project

# Install dependencies for all services
npm run install:all

# Start infrastructure services (databases, Kafka, Redis)
docker-compose up -d

# Start all microservices in development mode
npm run dev:all
```

## Development

Each service can be run independently:

```bash
# API Gateway
cd api-gateway && npm run dev

# Developer Service
cd services/developer-service && npm run dev

# NLP Service
cd services/nlp-service && python -m uvicorn main:app --reload

# Client
cd client/web && npm run dev
```

## Testing and Code Quality

```bash
# Unit tests across every TypeScript workspace
npm test

# ...with coverage (writes <workspace>/coverage/lcov.info)
npm run test:cov

# NLP service (Python)
npm run test:python
npm run test:python:cov

# A single workspace
cd services/developer-service && npm test
```

SonarQube runs from the `sonar` Docker Compose profile, so the default
`docker compose up -d` is unaffected:

```bash
npm run sonar:up      # http://localhost:9000
npm run test:cov && npm run test:python:cov
npm run sonar:scan
```

CI runs the same tests, uploads the coverage reports, and scans them on every
push and pull request. See [Testing and Code Quality](./docs/testing.md) for the
full setup, including the two repository secrets the SonarQube job needs.

## Deployment

See [Deployment Guide](./docs/deployment.md) for production deployment instructions.

## License

MIT
