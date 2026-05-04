"use client";
import { useState, useMemo, useCallback } from "react";
import { useSystemStore } from "@/app/store/systemStore";
import type { CliCommand, CliTag } from "@/app/types/system";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<CliTag, string> = {
  git:    "bg-orange-900/60 text-orange-300 border-orange-700",
  docker: "bg-blue-900/60 text-blue-300 border-blue-700",
  npm:    "bg-red-900/60 text-red-300 border-red-700",
  python: "bg-yellow-900/60 text-yellow-300 border-yellow-700",
  system: "bg-gray-800 text-gray-400 border-gray-600",
  dev:    "bg-purple-900/60 text-purple-300 border-purple-700",
  ssh:    "bg-teal-900/60 text-teal-300 border-teal-700",
  editor: "bg-green-900/60 text-green-300 border-green-700",
};

const SUGGESTION_ICONS: Record<string, string> = {
  alias: "→",
  optimization: "⚡",
  warning: "⚠",
};

const SUGGESTION_COLORS: Record<string, string> = {
  alias:        "border-indigo-700 bg-indigo-950/40",
  optimization: "border-amber-700 bg-amber-950/40",
  warning:      "border-red-700 bg-red-950/40",
};

function relativeTime(ts: number | null): string {
  if (!ts) return "—";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TagPill({ tag }: { tag: CliTag }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${TAG_COLORS[tag] ?? "bg-gray-800 text-gray-400 border-gray-600"}`}>
      {tag}
    </span>
  );
}

function CommandRow({ cmd, rank }: { cmd: CliCommand; rank: number }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(cmd.command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }, [cmd.command]);

  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 border-b border-gray-900 hover:bg-gray-900/60 transition-colors">
      <span className="text-xs text-gray-700 font-mono w-5 shrink-0 pt-0.5 text-right">
        {rank}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm text-gray-100 font-mono break-all leading-snug">
            {cmd.command}
          </code>
          <button
            onClick={copy}
            className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300 text-xs transition-all"
            title="Copy command"
          >
            {copied ? "✓" : "⎘"}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {cmd.tags.map((t) => <TagPill key={t} tag={t} />)}
          <span className="text-[10px] text-gray-600 font-mono">
            {cmd.shells.join(", ")}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 gap-0.5">
        <span className="text-xs font-semibold text-indigo-400 font-mono tabular-nums">
          ×{cmd.count.toLocaleString()}
        </span>
        <span className="text-[10px] text-gray-600">{relativeTime(cmd.last_used)}</span>
      </div>
    </div>
  );
}

function IntelligencePanel() {
  const { cliIntelligence } = useSystemStore();
  const [copiedSuggestion, setCopiedSuggestion] = useState<string | null>(null);

  if (!cliIntelligence) return null;

  const { suggestions, tag_distribution, variety_score, repetition_score, top_base_commands } = cliIntelligence;

  const maxTagCount = Math.max(...Object.values(tag_distribution), 1);
  const maxBaseCount = Math.max(...Object.values(top_base_commands), 1);

  function copySuggestion(s: string) {
    navigator.clipboard.writeText(s).then(() => {
      setCopiedSuggestion(s);
      setTimeout(() => setCopiedSuggestion(null), 1200);
    });
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto h-full p-4">

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">Variety Score</div>
          <div className="text-2xl font-bold text-indigo-400 font-mono">{variety_score}%</div>
          <div className="text-[10px] text-gray-600 mt-0.5">unique / total runs</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 mb-1">Top Command %</div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{repetition_score}%</div>
          <div className="text-[10px] text-gray-600 mt-0.5">of all invocations</div>
        </div>
      </div>

      {/* Tag distribution */}
      {Object.keys(tag_distribution).length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">
            By Category
          </div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(tag_distribution)
              .sort((a, b) => b[1] - a[1])
              .map(([tag, count]) => (
                <div key={tag} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-14 shrink-0 font-mono">{tag}</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${(count / maxTagCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Top base commands */}
      <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">
          Top Commands
        </div>
        <div className="flex flex-col gap-1.5">
          {Object.entries(top_base_commands)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([base, count]) => (
              <div key={base} className="flex items-center gap-2">
                <code className="text-[10px] text-gray-300 w-20 shrink-0 truncate font-mono">{base}</code>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${(count / maxBaseCount) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold px-0.5">
            Suggestions
          </div>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className={`rounded-lg border p-3 ${SUGGESTION_COLORS[s.type] ?? "border-gray-700"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">{SUGGESTION_ICONS[s.type]}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                      {s.type}
                    </span>
                  </div>
                  <code className="text-xs text-gray-200 font-mono block break-all leading-snug">
                    {s.suggestion}
                  </code>
                  <p className="text-[10px] text-gray-500 mt-1">{s.reason}</p>
                </div>
                {/* Action buttons */}
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => copySuggestion(s.suggestion)}
                    className="text-gray-600 hover:text-gray-200 text-[10px] px-1.5 py-0.5 border border-gray-700 hover:border-gray-500 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedSuggestion === s.suggestion ? "✓ copied" : "⎘ copy"}
                  </button>
                  {s.type === "alias" && (
                    <button
                      onClick={() => {
                        const line = `\n${s.suggestion}`;
                        navigator.clipboard.writeText(line).then(() => setCopiedSuggestion(s.suggestion + "__rc"));
                        setTimeout(() => setCopiedSuggestion(null), 1800);
                      }}
                      className="text-indigo-500 hover:text-indigo-300 text-[10px] px-1.5 py-0.5 border border-indigo-900 hover:border-indigo-700 rounded transition-colors"
                      title="Copy as shell config line (paste into .zshrc / .bashrc)"
                    >
                      {copiedSuggestion === s.suggestion + "__rc" ? "✓ ready" : "+ .zshrc"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type SortKey = "count" | "recent";

const ALL_TAGS: CliTag[] = ["git", "docker", "npm", "python", "system", "dev", "ssh", "editor"];

export default function CliHistory({ onLoad }: { onLoad: () => void }) {
  const { cliHistory, cliIntelligence, cliLoading } = useSystemStore();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("count");
  const [activeTag, setActiveTag] = useState<CliTag | null>(null);

  const filtered = useMemo(() => {
    if (!cliHistory) return [];
    let cmds = cliHistory.commands;

    if (activeTag) {
      cmds = cmds.filter((c) => c.tags.includes(activeTag));
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      cmds = cmds.filter((c) => c.command.toLowerCase().includes(q));
    }

    if (sortBy === "recent") {
      cmds = [...cmds].sort((a, b) => (b.last_used ?? 0) - (a.last_used ?? 0));
    }
    // "count" order is already sorted from backend

    return cmds;
  }, [cliHistory, query, sortBy, activeTag]);

  if (!cliHistory && !cliLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-center">
          <div className="text-4xl mb-3">⌘</div>
          <div className="text-gray-300 font-semibold mb-1">CLI History Intelligence</div>
          <div className="text-sm text-gray-500 mb-6 max-w-xs text-center">
            Analyze your shell history for patterns, aliases, and workflow optimizations.
          </div>
          <button
            onClick={onLoad}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-medium transition-colors"
          >
            Load History
          </button>
        </div>
      </div>
    );
  }

  if (cliLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-sm text-gray-400">Parsing history files…</div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: command list */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-gray-800">

        {/* Toolbar */}
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900/50 shrink-0">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">⌕</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Sort */}
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1 shrink-0">
              {(["count", "recent"] as SortKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSortBy(k)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    sortBy === k
                      ? "bg-indigo-600 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {k === "count" ? "Most Used" : "Most Recent"}
                </button>
              ))}
            </div>
          </div>

          {/* Tag filters */}
          <div className="flex gap-1.5 flex-wrap">
            {ALL_TAGS.map((tag) => {
              const hasCommands = cliHistory?.commands.some((c) => c.tags.includes(tag));
              if (!hasCommands) return null;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`text-[10px] px-2 py-1 rounded border font-mono transition-all ${
                    activeTag === tag
                      ? TAG_COLORS[tag]
                      : "bg-transparent border-gray-700 text-gray-600 hover:text-gray-400"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
            {/* Stats */}
            <span className="ml-auto text-[10px] text-gray-600 self-center">
              {filtered.length.toLocaleString()} of{" "}
              {cliHistory?.unique_commands.toLocaleString()} commands
            </span>
          </div>
        </div>

        {/* Shells summary */}
        {cliHistory && (
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/30 border-b border-gray-900 shrink-0">
            <span className="text-[10px] text-gray-600">Shells:</span>
            {cliHistory.shells_found.map((s) => (
              <span key={s} className="text-[10px] text-gray-400 font-mono bg-gray-800 px-1.5 py-0.5 rounded">
                {s}
              </span>
            ))}
            <span className="ml-auto text-[10px] text-gray-600">
              {cliHistory.total_invocations.toLocaleString()} total runs
            </span>
          </div>
        )}

        {/* Command list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-600">
              No commands match
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <CommandRow key={cmd.command} cmd={cmd} rank={i + 1} />
            ))
          )}
        </div>
      </div>

      {/* Right: intelligence */}
      <div className="w-80 shrink-0 overflow-hidden flex flex-col bg-gray-950">
        <div className="px-4 py-2.5 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-widest shrink-0">
          Intelligence
          {cliIntelligence && (
            <span className="ml-2 text-indigo-400 font-mono normal-case text-[10px]">
              {cliIntelligence.suggestions.length} suggestions
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <IntelligencePanel />
        </div>
      </div>
    </div>
  );
}
