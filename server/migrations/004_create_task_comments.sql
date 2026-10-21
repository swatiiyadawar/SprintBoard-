CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_comments_task_created_idx
  ON task_comments (task_id, created_at, id);

DROP TRIGGER IF EXISTS task_comments_set_updated_at ON task_comments;
CREATE TRIGGER task_comments_set_updated_at BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
