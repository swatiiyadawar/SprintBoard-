-- Backlog membership is independent from workflow status. Existing work stays
-- on the active board unless a user explicitly moves it to the backlog.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_backlog BOOLEAN NOT NULL DEFAULT FALSE;

-- Keep task and activity writes transactional when backlog membership changes.
ALTER TABLE task_activity
  DROP CONSTRAINT IF EXISTS task_activity_event_type_check;

ALTER TABLE task_activity
  ADD CONSTRAINT task_activity_event_type_check CHECK (event_type IN (
    'task_created',
    'status_changed',
    'priority_changed',
    'assignee_changed',
    'due_date_changed',
    'description_updated',
    'title_changed',
    'labels_changed',
    'blocked_changed',
    'dependency_added',
    'dependency_removed',
    'backlog_changed'
  ));
