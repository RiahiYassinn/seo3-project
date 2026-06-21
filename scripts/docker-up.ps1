$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

if (-not (Test-Path ".env.docker")) {
  Write-Host "Creating .env.docker from .env.docker.example"
  Copy-Item ".env.docker.example" ".env.docker"
}

docker compose -f docker-compose.prod.yml up -d --build @args

Write-Host ""
Write-Host "SEO3 stack is starting."
Write-Host "  Web client:   http://localhost:3010"
Write-Host "  API Gateway:  http://localhost:3000"
Write-Host "  API Docs:     http://localhost:3000/docs"
Write-Host "  Kafka UI:     http://localhost:8080"
Write-Host "  NLP Service:  http://localhost:8000"
Write-Host ""
Write-Host "Follow logs: npm run docker:app:logs"
