"""Base SQLite : schéma, connexion, petites fonctions utilitaires."""
import sqlite3
from datetime import datetime, timezone, timedelta

from . import config

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash     TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('admin', 'association', 'professionnel')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'info', 'active', 'rejected', 'suspended')),
  status_note       TEXT,
  status_changed_at TEXT,
  created_at        TEXT NOT NULL,
  last_login_at     TEXT,
  consent_at        TEXT,
  consent_version   TEXT
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  structure_name      TEXT NOT NULL,
  description         TEXT,
  registration_number TEXT,
  category            TEXT,
  commune             TEXT NOT NULL,
  postal_code         TEXT NOT NULL,
  website             TEXT,
  contact_name        TEXT NOT NULL,
  contact_role        TEXT,
  phone               TEXT,
  partner_code        TEXT UNIQUE,
  updated_at          TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY,
  member_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK (sender IN ('member', 'admin')),
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_member ON messages(member_id, id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id             INTEGER PRIMARY KEY,
  at             TEXT NOT NULL,
  admin_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_label   TEXT,
  action         TEXT NOT NULL,
  note           TEXT
);
"""


def now():
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(dt=None):
    return (dt or now()).isoformat()


def in_future(**kw):
    return iso(now() + timedelta(**kw))


def connect():
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH, timeout=10, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('PRAGMA busy_timeout = 5000')
    return conn


def init():
    conn = connect()
    conn.executescript(SCHEMA)
    if not conn.execute("SELECT 1 FROM settings WHERE key = 'notification_email'").fetchone():
        conn.execute("INSERT INTO settings (key, value) VALUES ('notification_email', ?)", (config.DEFAULT_NOTIFICATION_EMAIL,))
    conn.close()


def get_setting(conn, key, default=''):
    row = conn.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
    return row['value'] if row else default


def set_setting(conn, key, value):
    conn.execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', (key, value))


def audit(conn, admin_id, action, target_user_id=None, target_label=None, note=None):
    conn.execute('INSERT INTO audit_log (at, admin_id, target_user_id, target_label, action, note) VALUES (?, ?, ?, ?, ?, ?)',
                 (iso(), admin_id, target_user_id, target_label, action, note))
