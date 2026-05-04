"""System Mirror WebSocket server — entry point."""
import asyncio
import json
import logging
import time
from collections import deque

from websockets.asyncio.server import serve as ws_serve, ServerConnection

from event_store import init_db, store_event, store_snapshot, get_events_in_range
from state_engine import StateEngine
from system_monitor import process_events, system_stats
from fs_watcher import fs_events, scan_directory
from os_abstraction import simulate_event, get_os_profile, OSType
from cli_history import load_history
from history_intelligence import analyze as analyze_history

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

HOST = "localhost"
PORT = 8765

# Shared state
state = StateEngine()
clients: set[ServerConnection] = set()
recent_events: deque[dict] = deque(maxlen=1000)
system_info: dict = {}
_batch: list[dict] = []
_batch_ts: float = 0.0
BATCH_INTERVAL = 0.5   # flush to clients every 500ms


async def broadcast(message: dict):
    if not clients:
        return
    data = json.dumps(message)
    dead = set()
    for ws in clients:
        try:
            await ws.send(data)
        except Exception:
            dead.add(ws)
    clients.difference_update(dead)


async def flush_batch():
    global _batch, _batch_ts
    if not _batch:
        return
    events_to_send = _batch[:]
    _batch = []
    _batch_ts = time.time()

    for evt in events_to_send:
        state.apply_event(evt)
        recent_events.append(evt)
        await store_event(evt)

    snapshot = state.to_dict()
    await broadcast({
        "type": "STATE_UPDATE",
        "state": snapshot,
        "events": events_to_send,
        "system": system_info,
    })


async def ingest_event(event: dict):
    _batch.append(event)
    if time.time() - _batch_ts >= BATCH_INTERVAL:
        await flush_batch()


async def monitor_processes():
    async for event in process_events():
        await ingest_event(event)


async def monitor_filesystem():
    async for event in fs_events():
        await ingest_event(event)


async def monitor_system_stats():
    global system_info
    while True:
        system_info = await system_stats()
        await asyncio.sleep(5)


async def periodic_snapshot():
    while True:
        await asyncio.sleep(30)
        if state.processes:
            await store_snapshot(state.to_dict())


async def handle_client(ws: ServerConnection):
    clients.add(ws)
    log.info(f"Client connected: {ws.remote_address}. Total: {len(clients)}")

    # Send initial state
    init_msg = {
        "type": "INIT",
        "state": state.to_dict(),
        "system": system_info,
        "os_profiles": {t.value: get_os_profile(t) for t in OSType},
    }
    await ws.send(json.dumps(init_msg))

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
                await handle_client_message(ws, msg)
            except json.JSONDecodeError:
                pass
    except Exception:
        pass
    finally:
        clients.discard(ws)
        log.info(f"Client disconnected. Total: {len(clients)}")


async def handle_client_message(ws: ServerConnection, msg: dict):
    mtype = msg.get("type")

    if mtype == "GET_HISTORY":
        start = msg.get("start", time.time() - 3600)
        end = msg.get("end", time.time())
        events = await get_events_in_range(start, end)
        await ws.send(json.dumps({"type": "HISTORY", "events": events}))

    elif mtype == "SIMULATE":
        target_os = OSType(msg.get("os", "real"))
        events = list(recent_events)
        simulated = [simulate_event(e, target_os) for e in events]

        # Rebuild simulated state
        sim_state = StateEngine()
        for e in simulated:
            sim_state.apply_event(e)

        await ws.send(json.dumps({
            "type": "SIMULATION_RESULT",
            "os": target_os.value,
            "state": sim_state.to_dict(),
            "profile": get_os_profile(target_os),
        }))

    elif mtype == "REPLAY":
        start = msg.get("start", time.time() - 600)
        end = msg.get("end", time.time())
        events = await get_events_in_range(start, end)

        replay_state = StateEngine()
        frames = []
        for evt in events:
            replay_state.apply_event(evt)
            frames.append({
                "timestamp": evt.get("timestamp"),
                "state": replay_state.to_dict(),
                "event": evt,
            })

        await ws.send(json.dumps({"type": "REPLAY_FRAMES", "frames": frames}))

    elif mtype == "SCAN_FS":
        path = msg.get("path")
        files = await scan_directory(path) if path else await scan_directory()
        await ws.send(json.dumps({"type": "FS_SCAN", "files": files}))

    elif mtype == "GET_CLI_HISTORY":
        loop = asyncio.get_event_loop()
        history = await loop.run_in_executor(None, load_history)
        intelligence = await loop.run_in_executor(None, analyze_history, history["commands"])
        await ws.send(json.dumps({
            "type": "CLI_HISTORY",
            "history": history,
            "intelligence": intelligence,
        }))

    elif mtype == "PING":
        await ws.send(json.dumps({"type": "PONG", "timestamp": time.time()}))


async def main():
    log.info("Initializing database...")
    await init_db()

    log.info("Starting System Mirror backend on ws://localhost:8765")
    async with ws_serve(handle_client, HOST, PORT):
        await asyncio.gather(
            monitor_processes(),
            monitor_filesystem(),
            monitor_system_stats(),
            periodic_snapshot(),
        )


if __name__ == "__main__":
    asyncio.run(main())
