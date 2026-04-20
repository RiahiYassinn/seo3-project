-- GitHub Integration Tables Migration
-- Run this migration to create the tables for GitHub integration feature

-- Table: github_integrations
CREATE TABLE IF NOT EXISTS github_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL,
    github_username VARCHAR(255) NOT NULL,
    github_token TEXT NOT NULL,
    github_id BIGINT NOT NULL,
    avatar_url VARCHAR(500),
    connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (developer_id) REFERENCES developers(id) ON DELETE CASCADE,
    UNIQUE(developer_id)
);

-- Table: github_repositories
CREATE TABLE IF NOT EXISTS github_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL,
    github_repo_id BIGINT NOT NULL,
    repo_name VARCHAR(255) NOT NULL,
    repo_url VARCHAR(500) NOT NULL,
    repo_description TEXT DEFAULT '',
    language VARCHAR(100) DEFAULT 'Unknown',
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    is_private BOOLEAN DEFAULT false,
    default_branch VARCHAR(100) DEFAULT 'main',
    is_analyzed BOOLEAN DEFAULT false,
    analysis_status VARCHAR(50),
    last_analyzed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_synced TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (integration_id) REFERENCES github_integrations(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_github_integrations_developer_id ON github_integrations(developer_id);
CREATE INDEX IF NOT EXISTS idx_github_repositories_integration_id ON github_repositories(integration_id);
CREATE INDEX IF NOT EXISTS idx_github_repositories_analysis_status ON github_repositories(analysis_status) WHERE analysis_status IS NOT NULL;
