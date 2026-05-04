"""Analyze CLI history and produce actionable suggestions."""
import re
from collections import Counter, defaultdict


# ── Alias candidates ─────────────────────────────────────────────────────────

_KNOWN_ALIASES = {
    "git status":             "alias gs='git status'",
    "git diff":               "alias gd='git diff'",
    "git add -A":             "alias ga='git add -A'",
    "git log --oneline":      "alias gl='git log --oneline'",
    "git log --oneline --graph --all": "alias gla='git log --oneline --graph --all'",
    "git push origin main":   "alias gpm='git push origin main'",
    "git push origin master": "alias gpm='git push origin master'",
    "git checkout":           "alias gc='git checkout'",
    "git stash":              "alias gst='git stash'",
    "docker ps -a":           "alias dpa='docker ps -a'",
    "docker-compose up -d":   "alias dcu='docker-compose up -d'",
    "docker-compose down":    "alias dcd='docker-compose down'",
    "npm run dev":             "alias nd='npm run dev'",
    "npm run build":          "alias nb='npm run build'",
    "python3 -m pytest":      "alias pyt='python3 -m pytest'",
    "python3 -m http.server": "alias serve='python3 -m http.server'",
}


def _abbrev(cmd: str) -> str:
    """Auto-generate an alias name from a command string."""
    words = re.findall(r"[a-zA-Z]+", cmd)
    parts = [w[0] for w in words[:5] if w]
    return "".join(parts)[:6] or "cmd"


# ── Pattern matchers ──────────────────────────────────────────────────────────

_ANTIPATTERNS: list[tuple[re.Pattern, str, str]] = [
    (
        re.compile(r"cat .+ \| grep"),
        "Useless use of cat",
        "Replace `cat file | grep X` with `grep X file`",
    ),
    (
        re.compile(r"cd .+? && ls"),
        "cd + ls pattern",
        "Add `function cdls() { cd \"$1\" && ls; }` to your shell config",
    ),
    (
        re.compile(r"\|\s*grep .+\|\s*grep"),
        "Chained grep",
        "Combine with a single grep: `grep -E 'pat1|pat2'` or use `grep pat1 | grep pat2`",
    ),
    (
        re.compile(r"^find .+ -name"),
        "Slow find",
        "Consider `fd` (faster, simpler syntax): `fd <name>`",
    ),
    (
        re.compile(r"^grep -r"),
        "Slow grep -r",
        "Consider `rg` (ripgrep) — much faster for recursive search",
    ),
]


# ── Main analysis ─────────────────────────────────────────────────────────────

def analyze(commands: list[dict]) -> dict:
    suggestions: list[dict] = []
    seen_suggestions: set[str] = set()

    def add(s: dict):
        key = s["suggestion"]
        if key not in seen_suggestions:
            seen_suggestions.add(key)
            suggestions.append(s)

    for cmd_rec in commands:
        cmd = cmd_rec["command"]
        count = cmd_rec["count"]

        # Known alias mappings
        if cmd in _KNOWN_ALIASES and count >= 3:
            add({
                "type": "alias",
                "command": cmd,
                "suggestion": _KNOWN_ALIASES[cmd],
                "reason": f"Used {count}× — well-known shortcut",
                "priority": min(count, 20),
            })
            continue

        # Long command used repeatedly → auto alias
        if len(cmd) > 45 and count >= 4:
            alias_name = _abbrev(cmd)
            add({
                "type": "alias",
                "command": cmd,
                "suggestion": f"alias {alias_name}='{cmd}'",
                "reason": f"Used {count}× and is {len(cmd)} chars — worth aliasing",
                "priority": min(count, 15),
            })

        # Anti-patterns
        for pat, label, fix in _ANTIPATTERNS:
            if pat.search(cmd) and count >= 2:
                add({
                    "type": "optimization",
                    "command": cmd,
                    "suggestion": fix,
                    "reason": f"{label} (seen {count}×)",
                    "priority": 6,
                })

    # Detect frequent base-command clusters
    base_counts: Counter = Counter()
    for c in commands:
        words = c["command"].split()
        if words:
            base_counts[words[0]] += c["count"]

    # Suggest shell functions for the top repeated bases
    top_bases = [b for b, _ in base_counts.most_common(5) if base_counts[b] > 20]

    # Tag distribution
    tag_counts: Counter = Counter()
    for c in commands:
        for tag in c.get("tags", []):
            tag_counts[tag] += c["count"]

    # Session clusters: commands within 30-min windows
    timed = sorted(
        [c for c in commands if c.get("last_used")],
        key=lambda c: c["last_used"],  # type: ignore[arg-type]
    )

    # Variety score
    total_inv = sum(c["count"] for c in commands)
    unique = len(commands)
    variety_score = round(unique / total_inv * 100, 1) if total_inv else 0

    # Repetition score — single most-used command / total
    top_count = commands[0]["count"] if commands else 0
    repetition_score = round(top_count / total_inv * 100, 1) if total_inv else 0

    # Top 10 by count
    top10 = commands[:10]

    suggestions_sorted = sorted(suggestions, key=lambda s: -s["priority"])[:25]

    return {
        "suggestions":       suggestions_sorted,
        "top_commands":      top10,
        "tag_distribution":  dict(tag_counts.most_common(10)),
        "variety_score":     variety_score,
        "repetition_score":  repetition_score,
        "top_base_commands": dict(base_counts.most_common(10)),
        "total_invocations": total_inv,
    }
