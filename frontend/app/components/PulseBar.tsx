"use client";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSystemStore } from "@/app/store/systemStore";
import type { ProcessState } from "@/app/types/system";

// ── Constants ─────────────────────────────────────────────────────────────────

const HISTORY_LEN = 80;    // sparkline data points
const SPARK_W     = 160;
const SPARK_H     = 28;

// ── CPU Sparkline ─────────────────────────────────────────────────────────────

function CpuSparkline({ cpu }: { cpu: number }) {
  const buf = useRef<number[]>(Array(HISTORY_LEN).fill(0));
  const [linePath, setLinePath] = useState("");
  const [areaPath, setAreaPath] = useState("");

  useEffect(() => {
    buf.current = [...buf.current.slice(1), cpu];
    const vals = buf.current;

    const pts = vals.map((v, i) => {
      const x = (i / (HISTORY_LEN - 1)) * SPARK_W;
      const y = SPARK_H - (v / 100) * SPARK_H;
      return [x, y] as [number, number];
    });

    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} L ${SPARK_W},${SPARK_H} L 0,${SPARK_H} Z`;
    setLinePath(line);
    setAreaPath(area);
  }, [cpu]);

  const strokeColor = cpu > 70 ? "#ef4444" : cpu > 40 ? "#f59e0b" : "#818cf8";
  const glowStrength = cpu > 70 ? "3" : cpu > 40 ? "2" : "1.5";

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex flex-col items-end shrink-0">
        <span className="text-[9px] text-gray-500 leading-none">CPU</span>
        <motion.span
          key={Math.round(cpu / 5)}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          className="text-xs font-mono font-semibold tabular-nums"
          style={{ color: strokeColor }}
        >
          {Math.round(cpu)}%
        </motion.span>
      </div>

      <svg
        width={SPARK_W}
        height={SPARK_H}
        className="overflow-visible shrink-0"
        style={{ display: "block" }}
      >
        <defs>
          <filter id="spark-glow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation={glowStrength} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="spark-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill="url(#spark-area)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#spark-glow)"
          />
        )}
      </svg>
    </div>
  );
}

// ── Process Pill ──────────────────────────────────────────────────────────────

function ProcessPill({
  proc,
  expanded,
  onClick,
}: {
  proc: ProcessState;
  expanded: boolean;
  onClick?: () => void;
}) {
  const hot  = proc.cpu_percent > 15;
  const warm = proc.cpu_percent > 5;

  const bg = hot
    ? "bg-red-950/80 border-red-800 text-red-300"
    : warm
    ? "bg-amber-950/80 border-amber-800 text-amber-300"
    : "bg-indigo-950/60 border-indigo-900 text-indigo-300";

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.75 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.75 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono cursor-pointer transition-colors ${bg}`}
    >
      {(hot || warm) && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${hot ? "bg-red-400 animate-pulse" : "bg-amber-400"}`}
        />
      )}
      <span className="truncate max-w-[72px]">{proc.name}</span>
      {expanded && (
        <span className="opacity-60 shrink-0">{proc.cpu_percent.toFixed(1)}%</span>
      )}
    </motion.button>
  );
}

// ── File Activity Pulses ──────────────────────────────────────────────────────

type ActivityLevel = "idle" | "low" | "medium" | "high";

interface PulseDot {
  id: number;
  x: number;  // percent within container
}

const ACTIVITY_INTERVAL: Record<ActivityLevel, number> = {
  idle:   3500,
  low:    1400,
  medium:  600,
  high:    220,
};

const ACTIVITY_COLOR: Record<ActivityLevel, string> = {
  idle:   "#4b5563",
  low:    "#6366f1",
  medium: "#10b981",
  high:   "#ef4444",
};

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  idle:   "idle",
  low:    "low",
  medium: "med",
  high:   "high",
};

function FilePulses({ level }: { level: ActivityLevel }) {
  const [dots, setDots] = useState<PulseDot[]>([]);
  const counter = useRef(0);
  const color = ACTIVITY_COLOR[level];

  useEffect(() => {
    const interval = ACTIVITY_INTERVAL[level];
    const timer = setInterval(() => {
      const id = counter.current++;
      const x = 10 + Math.random() * 80;
      setDots((prev) => [...prev.slice(-10), { id, x }]);
      setTimeout(() => setDots((prev) => prev.filter((d) => d.id !== id)), 1400);
    }, interval);
    return () => clearInterval(timer);
  }, [level]);

  return (
    <div className="relative flex items-center shrink-0" style={{ width: 80, height: SPARK_H }}>
      {dots.map((d) => (
        <motion.span
          key={d.id}
          initial={{ scale: 0, opacity: 0.9 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 1.3, ease: "easeOut" }}
          className="absolute w-2 h-2 rounded-full pointer-events-none"
          style={{
            left: `${d.x}%`,
            top: "50%",
            translateY: "-50%",
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      ))}
      <div className="absolute bottom-0 right-0 flex flex-col items-end">
        <span className="text-[9px] text-gray-500 leading-none">files</span>
        <span className="text-[9px] font-mono" style={{ color }}>{ACTIVITY_LABEL[level]}</span>
      </div>
    </div>
  );
}

// ── Mini Memory Bar ───────────────────────────────────────────────────────────

function MiniBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-0.5 shrink-0">
      <div className="flex justify-between text-[9px] text-gray-500" style={{ width: 64 }}>
        <span>{label}</span>
        <span className="font-mono" style={{ color }}>{Math.round(pct)}%</span>
      </div>
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden" style={{ width: 64 }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return <div className="w-px self-stretch bg-gray-800 shrink-0 mx-1" />;
}

// ── Main PulseBar ─────────────────────────────────────────────────────────────

export default function PulseBar() {
  const { liveStats, liveState, connected, setMode } = useSystemStore();
  const [hovered, setHovered] = useState(false);

  // Top processes by CPU
  const topProcs = useMemo(() => {
    if (!liveState) return [];
    return Object.values(liveState.processes)
      .filter((p) => p.cpu_percent > 0)
      .sort((a, b) => b.cpu_percent - a.cpu_percent)
      .slice(0, hovered ? 5 : 3);
  }, [liveState, hovered]);

  // File activity level
  const activityLevel = useMemo((): ActivityLevel => {
    if (!liveState) return "idle";
    const now = Date.now() / 1000;
    const recent = Object.values(liveState.files).filter(
      (f) => now - f.last_accessed < 6
    ).length;
    if (recent > 15) return "high";
    if (recent > 5)  return "medium";
    if (recent > 0)  return "low";
    return "idle";
  }, [liveState]);

  const handleClick = useCallback(() => setMode("live"), [setMode]);

  const cpu  = liveStats?.cpu_percent      ?? 0;
  const memU = liveStats?.memory_used_mb   ?? 0;
  const memT = liveStats?.memory_total_mb  ?? 1;
  const dskU = liveStats?.disk_used_gb     ?? 0;
  const dskT = liveStats?.disk_total_gb    ?? 1;

  return (
    <motion.div
      className="shrink-0 border-t border-gray-800/80 bg-gray-950/95 backdrop-blur-sm cursor-pointer select-none overflow-hidden"
      animate={{ height: hovered ? 62 : 38 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={handleClick}
      title="Click to open Live view"
    >
      {/* Collapsed row — always visible */}
      <div className="flex items-center gap-0 px-4 h-[38px]">

        {/* Connection indicator */}
        <div className="flex items-center gap-1.5 shrink-0 mr-3">
          <motion.div
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-gray-600"}`}
            animate={connected ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
            transition={connected ? { duration: 2, repeat: Infinity } : {}}
          />
          <span className="text-[9px] text-gray-600 font-mono">
            {connected ? "live" : "off"}
          </span>
        </div>

        <Divider />

        {/* CPU sparkline */}
        <div className="px-3">
          <CpuSparkline cpu={cpu} />
        </div>

        <Divider />

        {/* Process pills */}
        <div className="flex items-center gap-1.5 px-3 min-w-0 flex-1">
          <AnimatePresence mode="popLayout">
            {topProcs.length > 0 ? (
              topProcs.map((p) => (
                <ProcessPill key={p.pid} proc={p} expanded={hovered} />
              ))
            ) : (
              <motion.span
                key="idle-label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] text-gray-700 font-mono"
              >
                no active processes
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <Divider />

        {/* File activity pulses */}
        <div className="px-3">
          <FilePulses level={activityLevel} />
        </div>

        {/* Expanded: mini bars for RAM + disk */}
        <AnimatePresence>
          {hovered && liveStats && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-3 overflow-hidden pl-3"
            >
              <Divider />
              <MiniBar
                label="RAM"
                value={memU}
                max={memT}
                color={memU / memT > 0.8 ? "#ef4444" : memU / memT > 0.6 ? "#f59e0b" : "#10b981"}
              />
              <MiniBar
                label="Disk"
                value={dskU}
                max={dskT}
                color={dskU / dskT > 0.9 ? "#ef4444" : "#6366f1"}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right-side label */}
        <div className="ml-auto pl-3 shrink-0">
          <span className="text-[9px] text-gray-700 font-mono">pulse</span>
        </div>
      </div>

      {/* Expanded second row */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-4 px-4 pb-2"
          >
            <span className="text-[9px] text-gray-600">
              {Object.keys(liveState?.processes ?? {}).length} processes
            </span>
            <span className="text-[9px] text-gray-600">
              {Object.keys(liveState?.files ?? {}).length} tracked files
            </span>
            <span className="text-[9px] text-gray-600">
              {liveState?.relationships.length ?? 0} relationships
            </span>
            <span className="text-[9px] text-indigo-600 ml-auto">
              click to focus →
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
