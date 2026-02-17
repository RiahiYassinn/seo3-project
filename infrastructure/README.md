# Infrastructure Setup

This directory contains initialization scripts and configuration for infrastructure services.

## PostgreSQL

### Initial Setup

The `postgres/init/01-init.sql` script will:

- Create the UUID extension
- Create the developers table with all necessary fields
- Set up indexes for optimal query performance
- Create triggers for automatic timestamp updates

This script runs automatically when PostgreSQL starts for the first time.

### Manual Execution

If you need to run the script manually:

```bash
docker exec -i seo3-postgres psql -U seo3_user -d seo3_db < postgres/init/01-init.sql
```

### Adding More Tables

Create additional SQL files in `postgres/init/` with sequential numbering:

- `02-create-recommendations.sql`
- `03-create-notifications.sql`
- etc.

## MongoDB

### Initial Setup

The `mongodb/init/01-init.js` script will:

- Switch to the `seo3_analytics` database
- Create collections for skills, commits, and analysis data
- Set up indexes for optimal query performance

This script runs automatically when MongoDB starts for the first time.

### Manual Execution

```bash
docker exec -i seo3-mongodb mongosh -u seo3_user -p seo3_password < mongodb/init/01-init.js
```

### Verify Collections

```bash
docker exec -it seo3-mongodb mongosh -u seo3_user -p seo3_password --authenticationDatabase admin

use seo3_analytics
show collections
```

## Kafka Topics

Kafka topics are created automatically when first used. To pre-create topics:

```bash
# Access Kafka container
docker exec -it seo3-kafka bash

# Create topics
kafka-topics --create --topic commit.analysis --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
kafka-topics --create --topic analysis.completed --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
kafka-topics --create --topic skill.updated --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
kafka-topics --create --topic notification.sent --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
```

## Redis

Redis requires no initialization. It starts with default configuration suitable for development.

For production, consider:

- Setting a password
- Configuring persistence (AOF)
- Setting up Redis Cluster for high availability

## Backup Scripts

### PostgreSQL Backup

```bash
# Backup
docker exec seo3-postgres pg_dump -U seo3_user seo3_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker exec -i seo3-postgres psql -U seo3_user seo3_db < backup_20240216_120000.sql
```

### MongoDB Backup

```bash
# Backup
docker exec seo3-mongodb mongodump --username seo3_user --password seo3_password --authenticationDatabase admin --out /backup

# Restore
docker exec seo3-mongodb mongorestore --username seo3_user --password seo3_password --authenticationDatabase admin /backup
```

## Monitoring

### Check Service Health

```bash
# PostgreSQL
docker exec seo3-postgres pg_isready -U seo3_user

# MongoDB
docker exec seo3-mongodb mongosh --eval "db.adminCommand('ping')"

# Redis
docker exec seo3-redis redis-cli ping

# Kafka
docker exec seo3-kafka kafka-broker-api-versions --bootstrap-server localhost:9092
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f mongodb
docker-compose logs -f kafka
```

## Troubleshooting

### PostgreSQL Connection Issues

1. Check if container is running: `docker ps | grep postgres`
2. Check logs: `docker-compose logs postgres`
3. Verify connection: `docker exec -it seo3-postgres psql -U seo3_user -d seo3_db`

### MongoDB Connection Issues

1. Check if container is running: `docker ps | grep mongodb`
2. Check logs: `docker-compose logs mongodb`
3. Verify connection: `docker exec -it seo3-mongodb mongosh -u seo3_user -p seo3_password`

### Kafka Not Ready

Kafka takes time to start. Wait 30-60 seconds after starting, then check:

```bash
docker-compose logs kafka | grep "started"
```

### Port Conflicts

If ports are already in use, modify the ports in `docker-compose.yml`:

```yaml
ports:
  - "5433:5432" # Use 5433 instead of 5432
```
