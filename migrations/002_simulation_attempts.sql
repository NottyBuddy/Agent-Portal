CREATE TABLE IF NOT EXISTS simulation_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  scenario TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simulation_attempts_user_created ON simulation_attempts(user_id, created_at DESC);