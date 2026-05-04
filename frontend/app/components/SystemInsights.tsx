"use client";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSystemStore } from "@/app/store/systemStore";

interface Insight {
  text: string;
  level: "info" | "warning" | "tip" | "session";
  icon: string;
}

const LEVEL_STYLE: Record<Insight["level"], string> = {
  info:    "text-indigo-300 border-indigo-900/60 bg-indigo-950/30",
  warning: "text-amber-300 border-amber-900/60 bg-amber-950/30",
  tip:     "text-emerald-300 border-emerald-900/60 bg-emerald-950/30",
  session: "text-violet-300 border-violet-900/60 bg-violet-950/30",
};

function deriveInsights(
  liveState:   ReturnType<typeof useSystemStore.getState>["liveState"],
  liveStats:   ReturnType<typeof useSystemStore.getState>["liveStats"],
  cliIntel:    ReturnType<typeof useSystemStore.getState>["cliIntelligence"],
): Insight[] {
  const out: Insight[] = [];

  if (liveStats) {
    if (liveStats.cpu_percent > 70)
      out.push({ text: `CPU at ${liveStats.cpu_percent.toFixed(0)}% — under heavy load`, level: "warning", icon: "⚡" });
    else if (liveStats.cpu_percent > 45)
      out.push({ text: `CPU at ${liveStats.cpu_percent.toFixed(0)}% — elevated activity`, level: "info", icon: "⚡" });

    if (liveStats.memory_percent > 85)
      out.push({ text: `Memory at ${liveStats.memory_percent.toFixed(0)}% — approaching limit`, level: "warning", icon: "⚠" });

    if (liveStats.disk_percent > 88)
      out.push({ text: `Disk at ${liveStats.disk_percent.toFixed(0)}% — consider cleanup`, level: "warning", icon: "💾" });
  }

  if (liveState) {
    const procs = Object.values(liveState.processes);

    // Top CPU hog
    const topProc = procs.sort((a, b) => b.cpu_percent - a.cpu_percent)[0];
    if (topProc && topProc.cpu_percent > 25)
      out.push({
        text: `${topProc.name} is using ${topProc.cpu_percent.toFixed(0)}% CPU`,
        level: topProc.cpu_percent > 60 ? "warning" : "info",
        icon: "⚙",
      });

    // Memory hog
    const topMem = [...procs].sort((a, b) => b.memory_mb - a.memory_mb)[0];
    if (topMem && topMem.memory_mb > 1024)
      out.push({
        text: `${topMem.name} is using ${(topMem.memory_mb / 1024).toFixed(1)} GB of RAM`,
        level: "warning",
        icon: "🧠",
      });

    // Hot files
    const hotFiles = Object.values(liveState.files).filter((f) => f.is_hot);
    if (hotFiles.length > 0) {
      const f = hotFiles.sort((a, b) => b.access_count - a.access_count)[0];
      const name = f.path.split("/").pop() ?? f.path;
      out.push({
        text: `${name} accessed ${f.access_count}× this session — hot file`,
        level: "info",
        icon: "🔥",
      });
    }

    // Coding session detection
    const DEV_PROCS = new Set(["code", "node", "python3", "python", "nvim", "vim", "cargo", "go", "rustup"]);
    const devProcs = procs.filter((p) => DEV_PROCS.has(p.name.toLowerCase().replace(".exe", "")));
    if (devProcs.length >= 2) {
      const names = [...new Set(devProcs.map((p) => p.name))].slice(0, 3).join(", ");
      out.push({ text: `Coding session active — ${names} running`, level: "session", icon: "💻" });
    }

    // Many processes
    if (procs.length > 250)
      out.push({ text: `${procs.length} processes running — busy system`, level: "info", icon: "⬡" });
  }

  // CLI tip
  if (cliIntel?.suggestions.length) {
    const top = cliIntel.suggestions[0];
    out.push({
      text: `Shell tip: ${top.suggestion}`,
      level: "tip",
      icon: "→",
    });
  }

  // Fallback if nothing interesting
  if (out.length === 0)
    out.push({ text: "System running normally", level: "info", icon: "✓" });

  return out;
}

export default function SystemInsights() {
  const { liveState, liveStats, cliIntelligence } = useSystemStore();
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const insights = useMemo(
    () => deriveInsights(liveState, liveStats, cliIntelligence),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveStats?.cpu_percent, liveStats?.memory_percent, liveStats?.disk_percent,
     Object.keys(liveState?.processes ?? {}).length,
     Object.values(liveState?.files ?? {}).filter(f => f.is_hot).length,
     cliIntelligence?.suggestions.length],
  );

  // Auto-cycle every 7 s
  useEffect(() => {
    if (dismissed || insights.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % insights.length), 7000);
    return () => clearInterval(t);
  }, [insights.length, dismissed]);

  // Reset index if insights list shrinks
  useEffect(() => {
    setIdx((i) => (i >= insights.length ? 0 : i));
  }, [insights.length]);

  if (dismissed) return null;

  const current = insights[Math.min(idx, insights.length - 1)];

  return (
    <div className={`shrink-0 flex items-center gap-3 px-4 py-1.5 border-b border-gray-800/60 ${LEVEL_STYLE[current.level]}`}
      style={{ minHeight: 32 }}>

      {/* Icon */}
      <span className="text-xs shrink-0">{current.icon}</span>

      {/* Animated text */}
      <div className="flex-1 min-w-0 relative overflow-hidden" style={{ height: 18 }}>
        <AnimatePresence mode="wait">
          <motion.span
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="absolute text-xs whitespace-nowrap"
          >
            {current.text}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Navigation (only if multiple) */}
      {insights.length > 1 && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIdx((i) => (i - 1 + insights.length) % insights.length)}
            className="opacity-40 hover:opacity-80 text-[10px] px-1 transition-opacity"
          >
            ‹
          </button>
          <span className="text-[9px] opacity-40 tabular-nums">{idx + 1}/{insights.length}</span>
          <button
            onClick={() => setIdx((i) => (i + 1) % insights.length)}
            className="opacity-40 hover:opacity-80 text-[10px] px-1 transition-opacity"
          >
            ›
          </button>
        </div>
      )}

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="opacity-25 hover:opacity-60 text-[11px] shrink-0 transition-opacity"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
