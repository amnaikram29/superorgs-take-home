from .connection import get_conn, get_lock

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS stock_prices (
    date    TEXT NOT NULL,
    open    REAL,
    high    REAL,
    low     REAL,
    close   REAL,
    volume  INTEGER,
    name    TEXT NOT NULL,
    PRIMARY KEY (date, name)
);

CREATE INDEX IF NOT EXISTS idx_name ON stock_prices(name);
CREATE INDEX IF NOT EXISTS idx_date ON stock_prices(date);

CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    title       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
"""


def init_schema() -> None:
    lock = get_lock()
    with lock:
        conn = get_conn()
        try:
            conn.executescript(SCHEMA_SQL)
            conn.commit()
        finally:
            conn.close()
