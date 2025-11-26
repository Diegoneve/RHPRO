
CREATE TABLE task_change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (user_id) REFERENCES user_profiles(id)
);

CREATE INDEX idx_task_change_log_task_id ON task_change_log(task_id);
CREATE INDEX idx_task_change_log_created_at ON task_change_log(created_at);

ALTER TABLE user_profiles ADD COLUMN position TEXT;
