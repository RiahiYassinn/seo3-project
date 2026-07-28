-- Dismissals track per-user removal of role-broadcast notifications.
-- Notifications addressed to a single user are hard deleted instead.
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS dismissals JSONB NOT NULL DEFAULT '{}'::jsonb;
