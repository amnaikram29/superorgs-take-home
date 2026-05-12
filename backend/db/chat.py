import json
import uuid
from datetime import datetime, timezone
from .connection import get_conn, get_lock


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_conversation(title: str | None = None) -> dict:
    conv_id = str(uuid.uuid4())
    now = _now()
    lock = get_lock()
    with lock:
        conn = get_conn()
        try:
            conn.execute(
                "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?,?,?,?)",
                (conv_id, title, now, now),
            )
            conn.commit()
        finally:
            conn.close()
    return {"id": conv_id, "title": title, "created_at": now, "updated_at": now}


def get_conversation(conv_id: str) -> dict | None:
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE id=?",
            (conv_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def list_conversations() -> list[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_conversation_title(conv_id: str, title: str) -> None:
    lock = get_lock()
    with lock:
        conn = get_conn()
        try:
            conn.execute(
                "UPDATE conversations SET title=?, updated_at=? WHERE id=?",
                (title, _now(), conv_id),
            )
            conn.commit()
        finally:
            conn.close()


def save_message(conv_id: str, role: str, content: list) -> dict:
    msg_id = str(uuid.uuid4())
    now = _now()
    content_json = json.dumps(content)
    lock = get_lock()
    with lock:
        conn = get_conn()
        try:
            conn.execute(
                "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?,?,?,?,?)",
                (msg_id, conv_id, role, content_json, now),
            )
            conn.execute(
                "UPDATE conversations SET updated_at=? WHERE id=?",
                (now, conv_id),
            )
            conn.commit()
        finally:
            conn.close()
    return {"id": msg_id, "conversation_id": conv_id, "role": role, "content": content, "created_at": now}


def get_messages(conv_id: str) -> list[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id=? ORDER BY created_at ASC",
            (conv_id,),
        ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["content"] = json.loads(d["content"])
            result.append(d)
        return result
    finally:
        conn.close()
