"""watchdog-based filesystem event watcher."""
import asyncio
import os
import time
from pathlib import Path
from queue import Queue, Empty
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Watch the user's home dir by default; keep it bounded
DEFAULT_WATCH_PATH = str(Path.home())
MAX_QUEUE = 500


class _Handler(FileSystemEventHandler):
    def __init__(self, queue: Queue):
        self._q = queue

    def _emit(self, event_type: str, path: str, **extra):
        if self._q.qsize() >= MAX_QUEUE:
            return
        try:
            stat = os.stat(path) if event_type != "FILE_DELETED" else None
        except (OSError, PermissionError):
            stat = None

        evt = {
            "type": event_type,
            "path": path,
            "size_bytes": stat.st_size if stat else 0,
            "last_modified": stat.st_mtime if stat else 0.0,
            "timestamp": time.time(),
            **extra,
        }
        self._q.put_nowait(evt)

    def on_opened(self, event):
        if not event.is_directory:
            self._emit("FILE_ACCESSED", event.src_path)

    def on_created(self, event):
        if not event.is_directory:
            self._emit("FILE_CREATED", event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self._emit("FILE_MODIFIED", event.src_path)

    def on_deleted(self, event):
        if not event.is_directory:
            self._emit("FILE_DELETED", event.src_path)


async def fs_events(watch_path: str = DEFAULT_WATCH_PATH):  # type: ignore[return]
    """Async generator yielding filesystem events."""
    queue: Queue = Queue(maxsize=MAX_QUEUE)
    handler = _Handler(queue)
    observer = Observer()
    observer.schedule(handler, watch_path, recursive=True)
    observer.start()

    try:
        while True:
            try:
                event = queue.get_nowait()
                yield event
            except Empty:
                await asyncio.sleep(0.1)
    finally:
        observer.stop()
        observer.join()


async def scan_directory(root: str = DEFAULT_WATCH_PATH, max_depth: int = 4) -> list[dict]:
    """One-shot recursive scan of directory tree, returning file metadata."""
    results = []
    root_path = Path(root)

    def _walk(path: Path, depth: int):
        if depth > max_depth:
            return
        try:
            for entry in path.iterdir():
                try:
                    stat = entry.stat()
                    results.append({
                        "path": str(entry),
                        "is_dir": entry.is_dir(),
                        "size_bytes": stat.st_size,
                        "last_modified": stat.st_mtime,
                        "depth": depth,
                    })
                    if entry.is_dir() and not entry.is_symlink():
                        _walk(entry, depth + 1)
                except (PermissionError, OSError):
                    continue
        except (PermissionError, OSError):
            pass

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _walk, root_path, 0)
    return results
