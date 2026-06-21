# SEO3 Developer Analytics Platform

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
seo3-project/
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

### Quick start with Docker (full stack)

```bash
cp .env.docker.example .env.docker
npm run docker:app:up
```

Then open **http://localhost:3010** (web) and **http://localhost:3000/docs** (API).

See [docs/deployment.md](docs/deployment.md) for details.

### Local development (hybrid)

```bash
# Infrastructure only
npm run docker:up

# App services on host with hot reload
npm run dev
```

### Manual installation

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

## Testing

```bash
# Run all tests
npm run test:all

# Run tests for specific service
cd services/developer-service && npm test
```

## Deployment

See [Deployment Guide](./docs/deployment.md) for production deployment instructions.

## License

MIT
