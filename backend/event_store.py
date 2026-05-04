"""SQLite-backed event store with async access."""
import json
import time
import aiosqlite
from pathlib import Path

DB_PATH = Path(__file__).parent / "events.db"

CREATE_EVENTS = """
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    timestamp REAL NOT NULL,
    data TEXT NOT NULL
)
"""

CREATE_SNAPSHOTS = """
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    state TEXT NOT NULL
)
"""


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_EVENTS)
        await db.execute(CREATE_SNAPSHOTS)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp)")
        await db.commit()


async def store_event(event: dict):
    ts = event.get("timestamp", time.time())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO events (type, timestamp, data) VALUES (?, ?, ?)",
            (event["type"], ts, json.dumps(event)),
        )
        await db.commit()


async def store_snapshot(state: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO snapshots (timestamp, state) VALUES (?, ?)",
            (time.time(), json.dumps(state)),
        )
        await db.commit()


async def get_events_in_range(start: float, end: float) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT data FROM events WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp",
            (start, end),
        )
        rows = await cursor.fetchall()
        return [json.loads(row["data"]) for row in rows]


async def get_latest_snapshot() -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT state FROM snapshots ORDER BY timestamp DESC LIMIT 1"
        )
        row = await cursor.fetchone()
        return json.loads(row["state"]) if row else None


async def get_event_count() -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM events")
        row = await cursor.fetchone()
        return row[0] if row else 0
