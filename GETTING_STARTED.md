# 🚀 SEO3 Developer Platform - Quick Start Guide

## Project Structure Created ✅

Your complete microservices architecture has been set up with the following components:

### 📁 Directory Structure

```
seo3-project/
├── api-gateway/                  # NestJS API Gateway (Port 3000)
├── services/
│   ├── developer-service/        # Developer microservice (Port 3001)
│   ├── skill-service/           # Skill microservice (Port 3002)
│   ├── analysis-service/        # Analysis microservice (Port 3003)
│   ├── recommendation-service/  # Recommendation microservice (Port 3004)
│   ├── notification-service/    # Notification microservice (Port 3005)
│   └── nlp-service/             # FastAPI NLP service (Port 8000)
├── client/
│   └── web/                     # Next.js web application
├── shared/
│   ├── types/                   # Shared TypeScript types
│   └── utils/                   # Shared utilities
├── infrastructure/
│   ├── postgres/init/           # PostgreSQL initialization scripts
│   └── mongodb/init/            # MongoDB initialization scripts
├── docs/                        # Documentation
├── docker-compose.yml           # Development infrastructure
├── docker-compose.prod.yml      # Production deployment
└── .env.example                 # Environment variables template
```

## 🎯 Next Steps

### 1️⃣ Copy Environment Variables

```bash
# In the root directory
cp .env.example .env
```

Then edit `.env` with your actual configuration values.

### 2️⃣ Start Infrastructure Services

```bash
# Start PostgreSQL, MongoDB, Redis, and Kafka
docker-compose up -d
```

Wait for all services to be healthy (check with `docker-compose ps`).

### 3️⃣ Install Dependencies

```bash
# Install dependencies for all services
npm install

# Install API Gateway dependencies
cd api-gateway
npm install

# Install each service dependencies
cd ../services/developer-service && npm install
cd ../skill-service && npm install
cd ../analysis-service && npm install
cd ../recommendation-service && npm install
cd ../notification-service && npm install

# Install NLP service dependencies (Python)
cd ../nlp-service
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Install client dependencies
cd ../../client/web
npm install
```

### 4️⃣ Build Shared Libraries (Optional)

```bash
cd shared/types
npm install && npm run build

cd ../utils
npm install && npm run build
```

## 🏃 Running the Services

### Development Mode

#### Option A: Run All Services at Once (from root)

```bash
# This will start all NestJS services
npm run dev:all
```

#### Option B: Run Services Individually

**API Gateway:**

```bash
cd api-gateway
npm run dev
# Runs on http://localhost:3000
# Swagger docs: http://localhost:3000/api/docs
```

**Developer Service:**

```bash
cd services/developer-service
npm run dev
# Runs on http://localhost:3001
```

**Skill Service:**

```bash
cd services/skill-service
npm run dev
# Runs on http://localhost:3002
```

**Analysis Service:**

```bash
cd services/analysis-service
npm run dev
# Runs on http://localhost:3003
```

**Recommendation Service:**

```bash
cd services/recommendation-service
npm run dev
# Runs on http://localhost:3004
```

**Notification Service:**

```bash
cd services/notification-service
npm run dev
# Runs on http://localhost:3005
```

**NLP Service (Python):**

```bash
cd services/nlp-service
python -m uvicorn main:app --reload --port 8000
# Runs on http://localhost:8000
# Docs: http://localhost:8000/docs
```

**Web Client:**

```bash
cd client/web
npm run dev
# Runs on http://localhost:3000 (or 3010 to avoid conflict)
```

## 📊 Access Points

Once everything is running:

- **API Gateway**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs
- **NLP Service Docs**: http://localhost:8000/docs
- **Kafka UI**: http://localhost:8080
- **Web Client**: http://localhost:3000 (or 3010)

## 🐳 Production Deployment

### Build and Run with Docker Compose

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop all services
docker-compose -f docker-compose.prod.yml down
```

Note: You'll need to create Dockerfiles for the remaining services (skill, analysis, recommendation, notification) following the same pattern as developer-service/Dockerfile.

## 🔍 Verify Installation

### Check Infrastructure Services

```bash
docker-compose ps
```

All services should show as "Up" and "healthy".

### Test API Gateway

```bash
curl http://localhost:3000/api/v1/health
```

Should return: `{"status":"ok","timestamp":"...","service":"api-gateway"}`

### Test NLP Service

```bash
curl http://localhost:8000/health
```

Should return: `{"status":"healthy","service":"nlp-service"}`

## 📖 Documentation

- **Architecture**: See [docs/architecture.md](docs/architecture.md)
- **Deployment**: See [docs/deployment.md](docs/deployment.md)
- **Contributing**: See [docs/contributing.md](docs/contributing.md)

## 🛠️ Key Technologies

### Backend

- **NestJS** (TypeScript) - Microservices framework
- **FastAPI** (Python) - NLP service
- **PostgreSQL** - Main database
- **MongoDB** - Analytics database
- **Redis** - Cache & sessions
- **Apache Kafka** - Message broker

### Frontend

- **Next.js 14** - React framework
- **TanStack Query** - Data fetching
- **Tailwind CSS** - Styling
- **Zustand** - State management

### DevOps

- **Docker & Docker Compose**
- **GitHub Actions** (CI/CD ready)

## 🎓 What Each Service Does

### API Gateway

- Central entry point for all requests
- Authentication & authorization
- Rate limiting
- Request validation
- Routes requests to microservices

### Developer Service

- User management (CRUD)
- Profile management
- Authentication logic
- Mentor matching data

### Skill Service

- Skill tracking
- Skill graph generation
- Proficiency calculations
- Learning paths

### Analysis Service

- Git webhook handling
- Commit processing
- PR analysis
- Integration with GitHub/GitLab

### Recommendation Service

- Learning path generation
- Mentor matching
- Content curation
- Skill gap analysis

### Notification Service

- Email notifications
- Slack integration
- In-app notifications
- Push notifications

### NLP Service

- Commit message analysis
- Code parsing
- Technology detection
- Sentiment analysis

## 🚨 Common Issues

### Port Already in Use

If you get port conflicts, you can change the ports in `.env` or stop conflicting services.

### Database Connection Failed

Make sure docker-compose services are running:

```bash
docker-compose ps
docker-compose logs postgres
docker-compose logs mongodb
```

### Kafka Not Ready

Kafka takes time to start. Wait 30-60 seconds after `docker-compose up -d` before starting application services.

## 💡 Tips

1. **Start with Infrastructure**: Always ensure databases and Kafka are running before starting application services
2. **Check Logs**: Use `docker-compose logs -f [service-name]` to debug issues
3. **Database Init**: The init scripts will create necessary tables/collections on first run
4. **API Documentation**: Use Swagger UI at `/api/docs` to explore and test APIs
5. **Hot Reload**: All services support hot reload in development mode

## 🤝 Need Help?

- Check the documentation in the `docs/` folder
- Review service logs for error messages
- Ensure all environment variables are set correctly
- Verify all dependencies are installed

## 🎉 You're All Set!

Your complete microservices architecture is ready for development. Happy coding!

---

**Note**: This is a development setup. For production deployment, ensure you:

- Change all default passwords
- Use proper secrets management
- Configure SSL/TLS
- Set up proper monitoring and logging
- Configure backup strategies
- Review security best practices
