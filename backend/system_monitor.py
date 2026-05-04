"""psutil-based process and system stats monitor."""
import asyncio
import time
import psutil
from typing import AsyncIterator


POLL_INTERVAL = 2.0     # seconds between full scans
CPU_INTERVAL = 1.0      # cpu_percent measurement interval


async def process_events() -> AsyncIterator[dict]:
    """Yield PROCESS_UPDATE events continuously."""
    known_pids: set[int] = set()

    while True:
        now = time.time()
        current_pids: set[int] = set()

        try:
            procs = list(psutil.process_iter([
                "pid", "name", "status", "cpu_percent",
                "memory_info", "ppid", "create_time",
            ]))
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            await asyncio.sleep(POLL_INTERVAL)
            continue

        for proc in procs:
            try:
                info = proc.info
                pid = info["pid"]
                if pid is None:
                    continue

                current_pids.add(pid)
                mem = info.get("memory_info")

                yield {
                    "type": "PROCESS_UPDATE",
                    "pid": pid,
                    "name": info.get("name") or "unknown",
                    "status": info.get("status") or "running",
                    "cpu_percent": info.get("cpu_percent") or 0.0,
                    "memory_mb": round((mem.rss / 1024 / 1024) if mem else 0.0, 2),
                    "parent_pid": info.get("ppid"),
                    "timestamp": now,
                }
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        # Emit died events for vanished processes
        for dead_pid in known_pids - current_pids:
            yield {"type": "PROCESS_DIED", "pid": dead_pid, "timestamp": now}

        known_pids = current_pids
        await asyncio.sleep(POLL_INTERVAL)


async def system_stats() -> dict:
    """Snapshot of overall system stats."""
    vm = psutil.virtual_memory()
    cpu = psutil.cpu_percent(interval=0.1)
    disk = psutil.disk_usage("/")
    return {
        "cpu_percent": cpu,
        "memory_total_mb": round(vm.total / 1024 / 1024),
        "memory_used_mb": round(vm.used / 1024 / 1024),
        "memory_percent": vm.percent,
        "disk_total_gb": round(disk.total / 1024 / 1024 / 1024, 1),
        "disk_used_gb": round(disk.used / 1024 / 1024 / 1024, 1),
        "disk_percent": disk.percent,
        "timestamp": time.time(),
    }
