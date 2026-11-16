{
    "path": "migrations/002_simulation_attempts.sql",
    "text": "CREATE TABLE IF NOT EXISTS simulation_attempts (\n  id BIGSERIAL PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  scenario TEXT NOT NULL,\n  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),\n  feedback JSONB NOT NULL DEFAULT '{}'::jsonb,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\nCREATE INDEX IF NOT EXISTS idx_simulation_attempts_user_created ON simulation_attempts(user_id, created_at DESC);",
    "hash": "64e942e0b1f20f0670ced10a5a6e3a53ccd8e1317ca08767c8faa49759c20765",
    "total_lines": 9
}