
CREATE TABLE task_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_update_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_update_id) REFERENCES task_updates(id)
);

CREATE INDEX idx_task_attachments_update_id ON task_attachments(task_update_id);
