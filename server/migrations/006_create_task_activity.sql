CREATE TABLE IF NOT EXISTS task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN (
    'task_created',
    'status_changed',
    'priority_changed',
    'assignee_changed',
    'due_date_changed',
    'description_updated',
    'title_changed',
    'labels_changed',
    'blocked_changed'
  )),
  event_details JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(event_details) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_activity_task_chronological_idx
  ON task_activity (task_id, created_at DESC, id DESC);

ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;

-- Existing task rows have an authoritative created_at timestamp but no older field-change history.
-- Add a minimal creation event without guessing historical task values or actors.
INSERT INTO task_activity (task_id, event_type, event_details, created_at)
SELECT task.id, 'task_created', jsonb_build_object('legacyRecord', TRUE), task.created_at
FROM tasks task
WHERE NOT EXISTS (
  SELECT 1
  FROM task_activity activity
  WHERE activity.task_id = task.id
    AND activity.event_type = 'task_created'
);
