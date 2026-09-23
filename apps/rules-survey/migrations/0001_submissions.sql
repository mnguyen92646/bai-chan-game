CREATE TABLE IF NOT EXISTS rule_submissions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  locale TEXT NOT NULL,
  answers_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rule_submissions_created_at ON rule_submissions(created_at);
