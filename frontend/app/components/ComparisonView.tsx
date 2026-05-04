"use client";
import { useRef, useMemo } from "react";
import { useSystemStore } from "@/app/store/systemStore";
import SystemGraph from "./SystemGraph";
import type { OSType } from "@/app/types/system";

const OS_LABEL: Record<OSType, string> = {
  real:    "Real System",
  linux:   "Linux (Ubuntu)",
  macos:   "macOS",
  windows: "Windows",
};

// ── Compatibility analysis ────────────────────────────────────────────────────

interface CompatWarning {
  path: string;
  level: "error" | "warn" | "info";
  label: string;
  reason: string;
}

function analyzeCompat(realPath: string, simPath: string, targetOs: OSType): CompatWarning[] {
  const warnings: CompatWarning[] = [];
  if (targetOs === "real" || targetOs === "linux") return warnings;

  if (targetOs === "windows") {
    // Unix absolute paths
    if (realPath.startsWith("/") && !simPath.startsWith("C:\\"))
      warnings.push({
        path: realPath,
        level: "error",
        label: "Would fail on Windows",
        reason: "Unix absolute path — no drive letter equivalent",
      });

    // Spaces in path segments
    if (/ /.test(realPath))
      warnings.push({
        path: realPath,
        level: "warn",
        label: "Quoting required",
        reason: "Spaces in path — must be quoted in CMD/PowerShell",
      });

    // Case-sensitive difference
    const lcReal = realPath.toLowerCase();
    const lcSim  = simPath.toLowerCase();
    if (lcReal !== lcSim && realPath !== simPath)
      warnings.push({
        path: realPath,
        level: "info",
        label: "Case insensitive",
        reason: "Windows paths are case-insensitive — conflicts possible",
      });

    // Hidden files (Unix dot-prefix)
    const base = realPath.split("/").pop() ?? "";
    if (base.startsWith("."))
      warnings.push({
        path: realPath,
        level: "info",
        label: "Hidden convention differs",
        reason: "Unix hidden files (dot-prefix) are not hidden on Windows",
      });

    // Symlinks
    if (realPath.includes("->"))
      warnings.push({
        path: realPath,
        level: "warn",
        label: "Symlink issue",
        reason: "Symlinks behave differently on Windows (requires admin)",
      });
  }

  if (targetOs === "macos") {
    // /proc and /sys don't exist on macOS
    if (realPath.startsWith("/proc") || realPath.startsWith("/sys"))
      warnings.push({
        path: realPath,
        level: "error",
        label: "Not available on macOS",
        reason: "/proc and /sys are Linux-only virtual filesystems",
      });

    // /etc differences
    if (realPath.startsWith("/etc/") && !simPath.startsWith("/etc/"))
      warnings.push({
        path: realPath,
        level: "warn",
        label: "Path differs on macOS",
        reason: "Config file location differs between Linux and macOS",
      });

    // Case sensitivity
    warnings.push({
      path: realPath,
      level: "info",
      label: "Case insensitive",
      reason: "macOS is case-insensitive by default (unlike Linux)",
    });
  }

  return warnings;
}

const LEVEL_BADGE: Record<CompatWarning["level"], string> = {
  error: "bg-red-950/80 border-red-800 text-red-300",
  warn:  "bg-amber-950/80 border-amber-800 text-amber-300",
  info:  "bg-blue-950/80 border-blue-800 text-blue-300",
};

// ── Diff Panel ────────────────────────────────────────────────────────────────

function DiffPanel() {
  const { liveState, simulationState, simulationOs, osProfiles } = useSystemStore();

  const analysis = useMemo(() => {
    if (!liveState || !simulationState) return [];

    const realPaths = Object.keys(liveState.files).slice(0, 12);
    const simFiles  = simulationState.files;

    return realPaths.map((rp) => {
      // Find best matching sim path
      const rBase = rp.split("/").slice(-2).join("/");
      const sp = Object.keys(simFiles).find((s) => s.includes(rBase)) ?? rp;
      const warnings = analyzeCompat(rp, sp, simulationOs);
      return { real: rp, sim: sp, warnings };
    });
  }, [liveState, simulationState, simulationOs]);

  if (!liveState || !simulationState) return null;
  const profile = osProfiles[simulationOs];

  const totalWarnings = analysis.reduce((n, r) => n + r.warnings.length, 0);
  const errors        = analysis.reduce((n, r) => n + r.warnings.filter((w) => w.level === "error").length, 0);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur border-t border-gray-800 max-h-56 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800/60 sticky top-0 bg-gray-950/95">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Compatibility
        </span>
        {errors > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/80 border border-red-800 text-red-300">
            {errors} error{errors > 1 ? "s" : ""}
          </span>
        )}
        {totalWarnings - errors > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300">
            {totalWarnings - errors} warn
          </span>
        )}
        {profile && (
          <span className="ml-auto text-[10px] text-gray-600 font-mono">
            {profile.root} · sep="{profile.path_sep === "\\" ? "\\\\" : profile.path_sep}"
          </span>
        )}
      </div>

      {/* Path rows */}
      <div className="divide-y divide-gray-900">
        {analysis.map(({ real, sim, warnings }) => (
          <div key={real} className="grid grid-cols-2 gap-0 group">
            {/* Real path */}
            <div className="px-4 py-1.5 border-r border-gray-900 flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-mono truncate flex-1">{real}</span>
            </div>
            {/* Simulated path + warnings */}
            <div className="px-4 py-1.5 flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-mono truncate flex-1 ${warnings.some(w => w.level === "error") ? "text-red-400" : "text-gray-400"}`}>
                {sim}
              </span>
              {warnings.slice(0, 2).map((w, i) => (
                <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${LEVEL_BADGE[w.level]}`}
                  title={w.reason}>
                  {w.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onSimulate: (os: OSType) => void;
}

export default function ComparisonView({ onSimulate }: Props) {
  const { graphData, comparisonGraphData, simulationOs, osProfiles } = useSystemStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const profile = osProfiles[simulationOs];

  return (
    <div ref={containerRef} className="relative flex h-full w-full">
      <div className="flex-1 relative border-r border-gray-800 pb-56">
        <SystemGraph data={graphData} title="Real System" height={500} />
      </div>
      <div className="flex-1 relative pb-56">
        <SystemGraph
          data={comparisonGraphData}
          title={`Simulated: ${profile?.name ?? simulationOs}`}
          height={500}
        />
        {!comparisonGraphData.nodes.length && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
            Select an OS above to simulate
          </div>
        )}
      </div>
      <DiffPanel />
    </div>
  );
}
