
ALTER TABLE user_profiles DROP COLUMN position;
DROP INDEX idx_task_change_log_created_at;
DROP INDEX idx_task_change_log_task_id;
DROP TABLE task_change_log;
