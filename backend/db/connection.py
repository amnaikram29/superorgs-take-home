import sqlite3
import os
import threading

_lock = threading.Lock()
_db_path = None


def get_db_path() -> str:
    global _db_path
    if _db_path is None:
        _db_path = os.getenv("SQLITE_PATH", "/app/data/app.db")
    return _db_path


def get_conn(readonly: bool = False) -> sqlite3.Connection:
    path = get_db_path()
    if readonly:
        uri = f"file:{path}?mode=ro"
        conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
    else:
        conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def get_lock() -> threading.Lock:
    return _lock
