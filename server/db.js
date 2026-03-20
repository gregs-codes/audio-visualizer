import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'render_jobs.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS render_jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

    status      TEXT    NOT NULL DEFAULT 'pending',
    -- pending | loading | buffering | recording | encoding | transcoding | saving | done | error | aborted

    audio_name  TEXT,
    format      TEXT    NOT NULL DEFAULT 'webm',
    resolution  TEXT    NOT NULL DEFAULT '720',
    fps         INTEGER NOT NULL DEFAULT 30,
    codec       TEXT    NOT NULL DEFAULT 'vp9',
    mode        TEXT,
    theme       TEXT,
    layout      TEXT,

    filename    TEXT,       -- output file name, set when done
    file_size   INTEGER,    -- bytes of the saved output file
    error       TEXT,       -- error message/detail if status = 'error'

    params      TEXT        -- full JSON snapshot of all render params
  );

  CREATE INDEX IF NOT EXISTS render_jobs_created_at ON render_jobs (created_at DESC);
  CREATE INDEX IF NOT EXISTS render_jobs_status     ON render_jobs (status);
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const stmtCreate = db.prepare(`
  INSERT INTO render_jobs
    (status, audio_name, format, resolution, fps, codec, mode, theme, layout, params)
  VALUES
    (@status, @audio_name, @format, @resolution, @fps, @codec, @mode, @theme, @layout, @params)
`);

const stmtUpdate = db.prepare(`
  UPDATE render_jobs
  SET
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    status     = COALESCE(@status,    status),
    filename   = COALESCE(@filename,  filename),
    file_size  = COALESCE(@file_size, file_size),
    error      = COALESCE(@error,     error)
  WHERE id = @id
`);

const stmtGet     = db.prepare(`SELECT * FROM render_jobs WHERE id = ?`);
const stmtList    = db.prepare(`SELECT * FROM render_jobs ORDER BY created_at DESC LIMIT ?`);
const stmtCount   = db.prepare(`SELECT COUNT(*) AS total FROM render_jobs`);

/**
 * Create a new render job record. Returns the new row id.
 * @param {object} opts
 */
export function createJob(opts = {}) {
  const result = stmtCreate.run({
    status:     'pending',
    audio_name: opts.audioName  ?? null,
    format:     opts.format     ?? 'webm',
    resolution: opts.resolution ?? '720',
    fps:        Number(opts.fps ?? 30),
    codec:      opts.codec      ?? 'vp9',
    mode:       opts.mode       ?? null,
    theme:      opts.theme      ?? null,
    layout:     opts.layout     ?? null,
    params:     opts.params     ? JSON.stringify(opts.params) : null,
  });
  return result.lastInsertRowid;
}

/**
 * Update a job's status and/or terminal fields.
 * @param {number|bigint} id
 * @param {object} fields  { status?, filename?, fileSize?, error? }
 */
export function updateJob(id, fields = {}) {
  stmtUpdate.run({
    id,
    status:    fields.status    ?? null,
    filename:  fields.filename  ?? null,
    file_size: fields.fileSize  ?? null,
    error:     fields.error     ?? null,
  });
}

/** Get a single job by id. */
export function getJob(id) {
  const row = stmtGet.get(Number(id));
  return row ? parseRow(row) : null;
}

/**
 * List recent jobs.
 * @param {number} limit  defaults to 100
 */
export function listJobs(limit = 100) {
  return stmtList.all(limit).map(parseRow);
}

/** Total job count. */
export function countJobs() {
  return stmtCount.get().total;
}

function parseRow(row) {
  return {
    ...row,
    params: row.params ? JSON.parse(row.params) : null,
  };
}

export default db;
