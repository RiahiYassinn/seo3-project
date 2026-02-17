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
# Install all service dependencies
npm run install:all
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
npm run dev:all

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

### Using Docker Compose

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop all services
docker-compose -f docker-compose.prod.yml down
```

### Building Individual Services

```bash
# Build API Gateway
cd api-gateway
docker build -t seo3/api-gateway:latest .

# Build Developer Service
cd services/developer-service
docker build -t seo3/developer-service:latest .

# Similar for other services...
```

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

## CI/CD Integration

See `.github/workflows` for CI/CD pipeline examples.
