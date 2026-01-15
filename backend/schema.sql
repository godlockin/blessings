DROP TABLE IF EXISTS tasks;
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT,
    original_image_path TEXT,
    reference_object_path TEXT,
    status TEXT CHECK(status IN ('PENDING', 'ANALYZING', 'GENERATING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
    generated_image_path TEXT,
    analysis_result TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_tasks_session_id ON tasks(session_id);
