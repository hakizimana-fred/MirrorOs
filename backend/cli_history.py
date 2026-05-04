"""CLI history parser — bash, zsh, fish (read-only)."""
import re
import time
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class _Entry:
    command: str
    timestamp: float | None
    shell: str


def _parse_bash(path: Path) -> list[_Entry]:
    entries: list[_Entry] = []
    current_ts: float | None = None
    try:
        for line in path.read_text(errors="ignore").splitlines():
            if re.match(r"^#\d{9,}$", line):
                current_ts = float(line[1:])
            elif line.strip():
                entries.append(_Entry(line.strip(), current_ts, "bash"))
                current_ts = None
    except (OSError, PermissionError):
        pass
    return entries


def _parse_zsh(path: Path) -> list[_Entry]:
    entries: list[_Entry] = []
    try:
        for line in path.read_text(errors="ignore").splitlines():
            m = re.match(r"^: (\d+):\d+;(.+)$", line)
            if m:
                entries.append(_Entry(m.group(2).strip(), float(m.group(1)), "zsh"))
            elif line.strip() and not line.startswith(": "):
                entries.append(_Entry(line.strip(), None, "zsh"))
    except (OSError, PermissionError):
        pass
    return entries


def _parse_fish(path: Path) -> list[_Entry]:
    entries: list[_Entry] = []
    cmd: str | None = None
    ts: float | None = None
    try:
        for line in path.read_text(errors="ignore").splitlines():
            if line.startswith("- cmd: "):
                if cmd:
                    entries.append(_Entry(cmd, ts, "fish"))
                cmd = line[7:].strip()
                ts = None
            elif line.startswith("  when: "):
                try:
                    ts = float(line[8:].strip())
                except ValueError:
                    pass
        if cmd:
            entries.append(_Entry(cmd, ts, "fish"))
    except (OSError, PermissionError):
        pass
    return entries


_TAG_RULES: list[tuple[str, re.Pattern]] = [
    ("git",    re.compile(r"^git\b")),
    ("docker", re.compile(r"^docker(-compose)?\b")),
    ("npm",    re.compile(r"^(npm|yarn|pnpm|npx)\b")),
    ("python", re.compile(r"^(python3?|pip3?|uvicorn|pytest|ruff|mypy)\b")),
    ("system", re.compile(r"^(cd|ls|rm|mv|cp|mkdir|chmod|chown|find|grep|sudo|apt|brew|systemctl|kill)\b")),
    ("dev",    re.compile(r"^(make|cargo|go|rustup|gcc|clang|cmake|kubectl|helm|terraform)\b")),
    ("ssh",    re.compile(r"^(ssh|scp|sftp|rsync)\b")),
    ("editor", re.compile(r"^(vim|nvim|nano|code|emacs|v )\b")),
]


def _tag(cmd: str) -> list[str]:
    return [tag for tag, pat in _TAG_RULES if pat.match(cmd)]


def load_history() -> dict:
    home = Path.home()
    sources = [
        (home / ".bash_history", _parse_bash),
        (home / ".zsh_history", _parse_zsh),
        (home / ".local/share/fish/fish_history", _parse_fish),
    ]

    # Aggregate by deduplicated command string
    agg: dict[str, dict] = {}
    shells_found: list[str] = []

    for path, parser in sources:
        if not path.exists():
            continue
        entries = parser(path)
        if not entries:
            continue
        shell_name = entries[0].shell if entries else "?"
        if shell_name not in shells_found:
            shells_found.append(shell_name)

        for e in entries:
            cmd = e.command.strip()
            if not cmd or len(cmd) > 1000:
                continue
            if cmd not in agg:
                agg[cmd] = {
                    "command": cmd,
                    "count": 0,
                    "timestamps": [],
                    "shells": [],
                    "tags": _tag(cmd),
                }
            rec = agg[cmd]
            rec["count"] += 1
            if e.shell not in rec["shells"]:
                rec["shells"].append(e.shell)
            if e.timestamp:
                rec["timestamps"].append(e.timestamp)

    commands = sorted(agg.values(), key=lambda c: c["count"], reverse=True)

    # Keep only last_used instead of full timestamp list (bandwidth)
    result = []
    for c in commands[:3000]:
        ts = c["timestamps"]
        result.append({
            "command":   c["command"],
            "count":     c["count"],
            "last_used": max(ts) if ts else None,
            "shells":    c["shells"],
            "tags":      c["tags"],
        })

    total = sum(c["count"] for c in agg.values())

    return {
        "commands":       result,
        "shells_found":   shells_found,
        "total_invocations": total,
        "unique_commands":   len(agg),
        "loaded_at":      time.time(),
    }
