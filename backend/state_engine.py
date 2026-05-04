"""Central in-memory state model. Receives events, maintains derived state."""
import time
from collections import defaultdict
from dataclasses import dataclass, field


STALE_PROCESS_TTL = 30.0   # seconds before removing dead process
HOT_FILE_THRESHOLD = 5     # accesses to qualify as hot


@dataclass
class ProcessState:
    pid: int
    name: str
    cpu_percent: float = 0.0
    memory_mb: float = 0.0
    status: str = "running"
    files_accessed: set = field(default_factory=set)
    children: set = field(default_factory=set)
    parent_pid: int | None = None
    last_seen: float = field(default_factory=time.time)
    created_at: float = field(default_factory=time.time)


@dataclass
class FileState:
    path: str
    size_bytes: int = 0
    last_modified: float = 0.0
    access_count: int = 0
    last_accessed: float = field(default_factory=time.time)
    accessing_processes: set = field(default_factory=set)
    is_hot: bool = False
    event_type: str = "none"


@dataclass
class Relationship:
    source: str   # "proc:{pid}" or "file:{path}"
    target: str
    rel_type: str  # "accesses", "parent_of", "writes"
    weight: float = 1.0


class StateEngine:
    def __init__(self):
        self.processes: dict[int, ProcessState] = {}
        self.files: dict[str, FileState] = {}
        self.relationships: list[Relationship] = []
        self._rel_set: set[tuple] = set()
        self._last_cleanup = time.time()

    def apply_event(self, event: dict):
        t = event.get("timestamp", time.time())
        etype = event["type"]

        if etype == "PROCESS_UPDATE":
            self._handle_process_update(event, t)
        elif etype in ("FILE_ACCESSED", "FILE_CREATED", "FILE_MODIFIED", "FILE_DELETED"):
            self._handle_file_event(event, t)
        elif etype == "PROCESS_DIED":
            self._handle_process_died(event, t)

        if time.time() - self._last_cleanup > 10.0:
            self._cleanup_stale()
            self._last_cleanup = time.time()

    def _handle_process_update(self, event: dict, t: float):
        pid = event["pid"]
        if pid not in self.processes:
            self.processes[pid] = ProcessState(
                pid=pid,
                name=event.get("name", "unknown"),
                created_at=t,
            )
        p = self.processes[pid]
        p.name = event.get("name", p.name)
        p.cpu_percent = event.get("cpu_percent", p.cpu_percent)
        p.memory_mb = event.get("memory_mb", p.memory_mb)
        p.status = event.get("status", p.status)
        p.last_seen = t

        parent_pid = event.get("parent_pid")
        if parent_pid and parent_pid in self.processes:
            p.parent_pid = parent_pid
            self.processes[parent_pid].children.add(pid)
            self._add_rel(f"proc:{parent_pid}", f"proc:{pid}", "parent_of")

    def _handle_file_event(self, event: dict, t: float):
        path = event.get("path", "")
        if not path:
            return

        if path not in self.files:
            self.files[path] = FileState(path=path)

        f = self.files[path]
        f.last_accessed = t
        f.event_type = event["type"]

        if event["type"] != "FILE_DELETED":
            f.access_count += 1
            f.size_bytes = event.get("size_bytes", f.size_bytes)
            f.last_modified = event.get("last_modified", f.last_modified)
            f.is_hot = f.access_count >= HOT_FILE_THRESHOLD
        else:
            f.access_count = 0

        proc_name = event.get("process")
        proc_pid = event.get("pid")
        if proc_pid and proc_pid in self.processes:
            self.processes[proc_pid].files_accessed.add(path)
            f.accessing_processes.add(proc_pid)
            rel_type = "writes" if event["type"] == "FILE_MODIFIED" else "accesses"
            self._add_rel(f"proc:{proc_pid}", f"file:{path}", rel_type)

    def _handle_process_died(self, event: dict, t: float):
        pid = event.get("pid")
        if pid and pid in self.processes:
            self.processes[pid].status = "dead"
            self.processes[pid].last_seen = t

    def _add_rel(self, source: str, target: str, rel_type: str):
        key = (source, target, rel_type)
        if key not in self._rel_set:
            self._rel_set.add(key)
            self.relationships.append(Relationship(source, target, rel_type))

    def _cleanup_stale(self):
        now = time.time()
        dead_pids = [
            pid for pid, p in self.processes.items()
            if p.status == "dead" and now - p.last_seen > STALE_PROCESS_TTL
        ]
        for pid in dead_pids:
            del self.processes[pid]
            self._rel_set = {r for r in self._rel_set if f"proc:{pid}" not in r}
            self.relationships = [
                r for r in self.relationships
                if f"proc:{pid}" not in (r.source, r.target)
            ]

    def to_dict(self) -> dict:
        return {
            "processes": {
                str(pid): {
                    "pid": p.pid,
                    "name": p.name,
                    "cpu_percent": p.cpu_percent,
                    "memory_mb": p.memory_mb,
                    "status": p.status,
                    "parent_pid": p.parent_pid,
                    "files_accessed": list(p.files_accessed)[:20],
                    "last_seen": p.last_seen,
                    "created_at": p.created_at,
                }
                for pid, p in self.processes.items()
                if p.status != "dead"
            },
            "files": {
                path: {
                    "path": f.path,
                    "size_bytes": f.size_bytes,
                    "access_count": f.access_count,
                    "last_accessed": f.last_accessed,
                    "last_modified": f.last_modified,
                    "is_hot": f.is_hot,
                    "event_type": f.event_type,
                    "accessing_processes": list(f.accessing_processes),
                }
                for path, f in self.files.items()
            },
            "relationships": [
                {
                    "source": r.source,
                    "target": r.target,
                    "type": r.rel_type,
                    "weight": r.weight,
                }
                for r in self.relationships[-500:]  # cap for serialization
            ],
            "timestamp": time.time(),
        }
