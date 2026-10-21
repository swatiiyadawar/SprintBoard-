-- Extend the existing activity event constraint without recreating either table.
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
    'dependency_removed'
  ));
