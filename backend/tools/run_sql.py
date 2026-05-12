import re
import os
import sqlite3
from db.connection import get_db_path

MAX_ROWS = 1000
QUERY_TIMEOUT_MS = 5000


def run_sql_handler(query: str) -> dict:
    query = query.strip()

    # Reject non-SELECT statements
    normalized = query.lstrip().upper()
    if not (normalized.startswith("SELECT") or normalized.startswith("WITH")):
        return {"error": "Only SELECT (or WITH ... SELECT) queries are allowed."}

    # Inject LIMIT if missing
    if not re.search(r'\bLIMIT\b', query, re.IGNORECASE):
        query = f"{query} LIMIT {MAX_ROWS}"

    db_path = get_db_path()
    uri = f"file:{db_path}?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
        conn.row_factory = sqlite3.Row

        interrupted = [False]

        def progress_handler():
            # Called periodically; returning non-zero aborts the query
            return 1 if interrupted[0] else 0

        import threading

        def timeout_fn():
            interrupted[0] = True

        timer = threading.Timer(QUERY_TIMEOUT_MS / 1000, timeout_fn)
        timer.start()
        try:
            conn.set_progress_handler(progress_handler, 1000)
            cur = conn.execute(query)
            columns = [d[0] for d in cur.description] if cur.description else []
            rows = [dict(r) for r in cur.fetchall()]
        finally:
            timer.cancel()
            conn.close()

        if interrupted[0]:
            return {"error": f"Query timed out after {QUERY_TIMEOUT_MS}ms."}

        return {"columns": columns, "rows": rows, "row_count": len(rows)}

    except sqlite3.OperationalError as e:
        return {"error": str(e)}
    except sqlite3.DatabaseError as e:
        return {"error": str(e)}
