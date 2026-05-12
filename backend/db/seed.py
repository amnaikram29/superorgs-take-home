import os
import csv
from .connection import get_conn, get_lock


def seed() -> None:
    csv_path = _find_csv()
    if csv_path is None:
        print("[seed] all_stocks_5yr.csv not found in any search path — skipping seed.")
        return

    lock = get_lock()
    with lock:
        conn = get_conn()
        try:
            cur = conn.execute("SELECT COUNT(*) FROM stock_prices")
            if cur.fetchone()[0] > 0:
                print("[seed] stock_prices already populated, skipping.")
                return

            print(f"[seed] Loading data from {csv_path}...")
            rows = []
            with open(csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        # Support both YYYY-MM-DD and MM/DD/YYYY date formats
                        date_raw = row.get("date") or row.get("Date") or ""
                        if "/" in date_raw:
                            parts = date_raw.split("/")
                            date_str = f"{parts[2]}-{parts[0].zfill(2)}-{parts[1].zfill(2)}"
                        else:
                            date_str = date_raw

                        # Support both 'Name' and 'name' column headers
                        name = row.get("Name") or row.get("name") or ""
                        rows.append((
                            date_str,
                            _float(row.get("open") or row.get("Open")),
                            _float(row.get("high") or row.get("High")),
                            _float(row.get("low") or row.get("Low")),
                            _float(row.get("close") or row.get("Close")),
                            _int(row.get("volume") or row.get("Volume")),
                            name,
                        ))
                    except Exception as e:
                        print(f"[seed] Skipping row due to error: {e}")

            conn.executemany(
                "INSERT OR IGNORE INTO stock_prices (date, open, high, low, close, volume, name) VALUES (?,?,?,?,?,?,?)",
                rows,
            )
            conn.commit()
            print(f"[seed] Inserted {len(rows)} rows into stock_prices.")
        finally:
            conn.close()


def _find_csv() -> str | None:
    """Return the first existing CSV path, checking env var then common locations."""
    candidates = [
        os.getenv("SEED_CSV_PATH"),                          # explicit override
        "/app/data/all_stocks_5yr.csv",                      # Docker volume mount
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "all_stocks_5yr.csv"),
        os.path.join(os.getcwd(), "data", "all_stocks_5yr.csv"),
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return os.path.abspath(path)
    return None


def _float(val) -> float | None:
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _int(val) -> int | None:
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return None
