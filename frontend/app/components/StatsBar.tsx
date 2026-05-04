"use client";
import { useSystemStore } from "@/app/store/systemStore";

function Gauge({ label, value, max = 100, unit = "%" }: {
  label: string; value: number; max?: number; unit?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 80 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#10b981";

  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="text-gray-200 font-mono">
          {typeof value === "number" ? value.toFixed(1) : value}
          {unit}
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function StatsBar() {
  const { liveStats, liveState, connected } = useSystemStore();

  const procCount = liveState ? Object.keys(liveState.processes).length : 0;
  const fileCount = liveState ? Object.keys(liveState.files).length : 0;
  const hotFiles = liveState
    ? Object.values(liveState.files).filter((f) => f.is_hot).length
    : 0;

  return (
    <div className="flex items-center gap-6 px-5 py-3 bg-gray-900 border-b border-gray-800 flex-wrap">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-500"}`}
        />
        <span className="text-xs text-gray-400">
          {connected ? "Live" : "Disconnected"}
        </span>
      </div>

      {liveStats && (
        <>
          <Gauge label="CPU" value={liveStats.cpu_percent} />
          <Gauge
            label="RAM"
            value={liveStats.memory_used_mb}
            max={liveStats.memory_total_mb}
            unit=" MB"
          />
          <Gauge
            label="Disk"
            value={liveStats.disk_used_gb}
            max={liveStats.disk_total_gb}
            unit=" GB"
          />
        </>
      )}

      <div className="flex gap-4 ml-auto text-xs text-gray-500">
        <span>
          <span className="text-indigo-400 font-semibold">{procCount}</span> procs
        </span>
        <span>
          <span className="text-emerald-400 font-semibold">{fileCount}</span> files
        </span>
        <span>
          <span className="text-red-400 font-semibold">{hotFiles}</span> hot
        </span>
      </div>
    </div>
  );
}
