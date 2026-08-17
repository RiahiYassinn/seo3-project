# GitHub Integration Setup

## Overview

This feature allows developers to link their GitHub accounts and analyze their repositories using NLP.

## Backend Setup

### 1. Install Dependencies

```bash
cd api-gateway
npm install @octokit/rest
```

### 2. Database Migration

If TypeORM synchronization is disabled, run the migration manually:

```bash
psql -U your_user -d your_database -f services/developer-service/migrations/001_create_github_tables.sql
```

### 3. Environment Variables

No additional environment variables are required. The GitHub module uses the existing `DEVELOPER_SERVICE_HOST` and `DEVELOPER_SERVICE_PORT`.

### 4. Start Services

```bash
# Start developer service
cd services/developer-service
npm run dev

# Start API gateway
cd api-gateway
npm run dev
```

## API Endpoints

### GitHub Integration Endpoints

- `GET /github/integration` - Get current GitHub integration status
- `POST /github/integration` - Link a GitHub account
  - Body: `{ github_username: string, github_token: string }`
- `DELETE /github/integration` - Unlink GitHub account
- `GET /github/repositories` - Get synced repositories
- `POST /github/sync` - Sync repositories from GitHub
  - Body: `{ integrationId: string, username: string }`
- `POST /github/analyze` - Analyze a repository with NLP
  - Body: `{ repository_id: string }`

## Frontend Usage

### Pages

1. **Dashboard**: `/dashboard/developer` - Quick GitHub overview with link to analysis page
2. **GitHub Integration**: `/dashboard/developer/github` - Full GitHub integration interface

### Features

- Link/unlink GitHub account using Personal Access Token
- View connected GitHub username and connection status
- Sync repositories from GitHub
- View repository list with details (stars, forks, language)
- Analyze individual repositories with NLP (coming soon)
- Track analysis status (pending, in_progress, completed, failed)

## Creating a GitHub Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Add a note like "devlab Integration"
4. Select scopes:
   - `repo` - Full control of private repositories
   - `read:user` - Read user profile data
5. Click "Generate token"
6. Copy the token (it won't be shown again!)
7. Use it in the devlab GitHub integration form

## Next Steps

### NLP Analysis Integration

The `POST /github/analyze` endpoint is set up but needs to be connected to:

1. Kafka topic for repository analysis queue
2. NLP service for actual code analysis
3. Results storage and retrieval endpoints

### Webhook Support (Future)

For real-time updates, set up GitHub webhooks to:

- Auto-sync on push events
- Trigger analysis on new commits
- Update repository metadata automatically

## Security Notes

- GitHub tokens are stored encrypted in the database
- Tokens have minimal required permissions (repo, read:user)
- Tokens can be revoked at any time from GitHub settings
- All endpoints require JWT authentication
