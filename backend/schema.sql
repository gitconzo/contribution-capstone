-- backend/schema.sql
-- Full database schema for the Contribution Capstone tool.
-- Run this once against a fresh PostgreSQL database before starting the backend.
--
-- Usage:
--   psql -h <host> -U <user> -d <database> -f schema.sql
--
-- All statements use IF NOT EXISTS so the script is safe to re-run.
-- The backend will also apply a small number of ALTER TABLE migrations at
-- startup; running this schema first is the cleanest way to provision a
-- new database.

-- =============================================================================
-- units
-- One row per academic unit (e.g. COS40005). Teams belong to a unit.
-- =============================================================================
CREATE TABLE IF NOT EXISTS units (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- teams
-- One row per capstone team. The id is a string of the form "team_<timestamp>"
-- assigned by the backend at creation time.
-- =============================================================================
CREATE TABLE IF NOT EXISTS teams (
    id                                TEXT PRIMARY KEY,
    unit_id                           INT REFERENCES units(id) ON DELETE SET NULL,
    name                              TEXT NOT NULL,
    repo_url                          TEXT,
    repo_owner                        TEXT,
    repo_name                         TEXT,
    owner_email                       TEXT,
    allow_student_role_self_assign    BOOLEAN NOT NULL DEFAULT TRUE,
    auto_approve_uploads              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                        TIMESTAMPTZ DEFAULT NOW()
);

-- Index on owner_email for the per-tutor team filter in GET /api/teams.
CREATE INDEX IF NOT EXISTS idx_teams_owner_email ON teams(LOWER(owner_email));

-- =============================================================================
-- students
-- One row per student enrolled in a team. role is a comma-separated string
-- supporting multiple roles per student (e.g. "leader,scrum_master").
-- aliases is a JSON-encoded string array of alternative name spellings used
-- for fuzzy matching in document parsing.
-- =============================================================================
CREATE TABLE IF NOT EXISTS students (
    id          SERIAL PRIMARY KEY,
    team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    email       TEXT,
    github      TEXT,
    aliases     TEXT,
    role        TEXT NOT NULL DEFAULT 'member',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, email)
);

CREATE INDEX IF NOT EXISTS idx_students_team_id ON students(team_id);
CREATE INDEX IF NOT EXISTS idx_students_email   ON students(LOWER(email));

-- =============================================================================
-- rules
-- Per-team metric weights. One row per (team, metric_name) pair.
-- Weights are expected to sum to 100 across all rules for a team.
-- =============================================================================
CREATE TABLE IF NOT EXISTS rules (
    id           SERIAL PRIMARY KEY,
    team_id      TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    weight       NUMERIC NOT NULL DEFAULT 0,
    description  TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, name)
);

CREATE INDEX IF NOT EXISTS idx_rules_team_id ON rules(team_id);

-- =============================================================================
-- rule_settings
-- Per-team scoring configuration that isn't a metric weight (e.g. whether
-- saved rule changes should auto-trigger re-aggregation).
-- =============================================================================
CREATE TABLE IF NOT EXISTS rule_settings (
    team_id      TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    auto_recalc  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- sprints
-- One row per sprint per team. branch is optional and lets per-sprint
-- analyses target a specific GitHub branch instead of the team's default.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sprints (
    id                  SERIAL PRIMARY KEY,
    team_id             TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    sprint_number       INT NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    scrum_master_email  TEXT,
    branch              TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, sprint_number)
);

CREATE INDEX IF NOT EXISTS idx_sprints_team_id ON sprints(team_id);

-- =============================================================================
-- tasks
-- Per-sprint task assignments. Priority and status are constrained to a
-- fixed set of values; legacy data may need migrating before adding the
-- constraints.
-- =============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id                SERIAL PRIMARY KEY,
    sprint_id         INT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    team_id           TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    assigned_to_email TEXT NOT NULL,
    title             TEXT NOT NULL,
    description       TEXT,
    story_points      INT NOT NULL DEFAULT 1,
    priority          TEXT NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low', 'medium', 'high')),
    status            TEXT NOT NULL DEFAULT 'in_progress'
                          CHECK (status IN ('in_progress', 'complete')),
    completed_at      TIMESTAMPTZ,
    created_by_email  TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team_id   ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee  ON tasks(LOWER(assigned_to_email));

-- =============================================================================
-- file_registry
-- One row per uploaded file. Tracks the file through its upload, approval,
-- and parsing lifecycle. s3_key points at the raw uploaded file; s3_parsed_key
-- points at the JSON output of the appropriate Python parser. json_path is
-- the local-disk path the aggregator reads from.
--
-- detected_type is what the upload handler inferred from the filename;
-- user_type is what the user explicitly chose (may differ).
--
-- upload_scope distinguishes team-level documents (attendance sheets,
-- sprint reports, project plans) from individual student documents
-- (worklogs, peer reviews).
-- =============================================================================
CREATE TABLE IF NOT EXISTS file_registry (
    id                   TEXT PRIMARY KEY,
    team_id              TEXT REFERENCES teams(id) ON DELETE CASCADE,
    sprint_id            TEXT,
    original_name        TEXT NOT NULL,
    stored_name          TEXT NOT NULL,
    s3_key               TEXT NOT NULL,
    s3_parsed_key        TEXT,
    json_path            TEXT,
    mimetype             TEXT,
    size                 BIGINT,
    detected_type        TEXT,
    user_type            TEXT,
    upload_scope         TEXT DEFAULT 'individual'
                            CHECK (upload_scope IN ('team', 'individual')),
    uploaded_by_name     TEXT,
    uploaded_by_email    TEXT,
    upload_date          TIMESTAMPTZ DEFAULT NOW(),
    status               TEXT NOT NULL DEFAULT 'uploaded',
    approval_status      TEXT DEFAULT 'pending'
                            CHECK (approval_status IN ('pending', 'approved', 'declined')),
    decline_reason       TEXT,
    parse_message        TEXT,
    parsed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_file_registry_team_id ON file_registry(team_id);
CREATE INDEX IF NOT EXISTS idx_file_registry_status  ON file_registry(status);
CREATE INDEX IF NOT EXISTS idx_file_registry_type    ON file_registry(user_type);
CREATE INDEX IF NOT EXISTS idx_file_registry_sprint  ON file_registry(sprint_id);
