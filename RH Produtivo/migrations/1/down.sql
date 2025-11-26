
DROP INDEX idx_task_updates_user_id;
DROP INDEX idx_task_updates_task_id;
DROP TABLE task_updates;

DROP INDEX idx_tasks_deadline;
DROP INDEX idx_tasks_status;
DROP INDEX idx_tasks_creator_id;
DROP INDEX idx_tasks_assignee_id;
DROP TABLE tasks;

DROP INDEX idx_user_profiles_manager_id;
DROP INDEX idx_user_profiles_mocha_user_id;
DROP TABLE user_profiles;
