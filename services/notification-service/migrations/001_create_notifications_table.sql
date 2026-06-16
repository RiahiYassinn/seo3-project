CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NULL,
    recipient_role VARCHAR NULL,
    type VARCHAR NOT NULL DEFAULT 'system',
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR NULL,
    priority VARCHAR NOT NULL DEFAULT 'info',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMP NULL,
    read_receipts JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user
    ON notifications (recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role
    ON notifications (recipient_role);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON notifications (created_at DESC);
