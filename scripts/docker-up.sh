#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.docker ]]; then
  echo "Creating .env.docker from .env.docker.example"
  cp .env.docker.example .env.docker
fi

docker compose -f docker-compose.prod.yml up -d --build "$@"

echo ""
echo "SEO3 stack is starting."
echo "  Web client:   http://localhost:3010"
echo "  API Gateway:  http://localhost:3000"
echo "  API Docs:     http://localhost:3000/docs"
echo "  Kafka UI:     http://localhost:8080"
echo "  NLP Service:  http://localhost:8000"
echo ""
echo "Follow logs: npm run docker:app:logs"
