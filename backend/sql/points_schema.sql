-- PostgreSQL schema for points tracking backend

CREATE TABLE IF NOT EXISTS point_rules (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    points INTEGER NOT NULL CHECK (points >= 0),
    metadata JSONB DEFAULT '{}'::JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS point_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    client_id UUID NOT NULL,
    rule_id TEXT NOT NULL REFERENCES point_rules(id),
    points INTEGER NOT NULL CHECK (points >= 0),
    metadata JSONB DEFAULT '{}'::JSONB,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT point_events_client_unique UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_point_events_user_awarded
    ON point_events(user_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS user_point_totals (
    user_id TEXT PRIMARY KEY,
    lifetime_points BIGINT NOT NULL DEFAULT 0,
    last_award_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION apply_point_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_point_totals (user_id, lifetime_points, last_award_at, updated_at)
    VALUES (NEW.user_id, NEW.points, NEW.awarded_at, NOW())
    ON CONFLICT (user_id) DO UPDATE
        SET lifetime_points = user_point_totals.lifetime_points + EXCLUDED.lifetime_points,
            last_award_at = GREATEST(user_point_totals.last_award_at, EXCLUDED.last_award_at),
            updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_point_event ON point_events;
CREATE TRIGGER trg_apply_point_event
AFTER INSERT ON point_events
FOR EACH ROW
EXECUTE FUNCTION apply_point_event();

DROP VIEW IF EXISTS recent_point_events;
CREATE VIEW recent_point_events AS
SELECT
    user_id,
    rule_id,
    points,
    metadata,
    awarded_at
FROM point_events
WHERE awarded_at >= NOW() - INTERVAL '30 days';
