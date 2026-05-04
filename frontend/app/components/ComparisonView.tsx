"use client";
import { useRef, useEffect } from "react";
import { useSystemStore } from "@/app/store/systemStore";
import SystemGraph from "./SystemGraph";
import type { OSType } from "@/app/types/system";

const OS_LABEL: Record<OSType, string> = {
  real: "Real System",
  linux: "Linux (Ubuntu)",
  macos: "macOS",
  windows: "Windows",
};

interface Props {
  onSimulate: (os: OSType) => void;
}

function DiffPanel() {
  const { liveState, simulationState, simulationOs, osProfiles } = useSystemStore();

  if (!liveState || !simulationState) return null;

  const realPaths = Object.keys(liveState.files).slice(0, 8);
  const simPaths = Object.keys(simulationState.files).slice(0, 8);
  const profile = osProfiles[simulationOs];

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-950/90 backdrop-blur border-t border-gray-800 p-4 max-h-52 overflow-y-auto">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
        Path Differences
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-indigo-400 mb-1">Real</div>
          {realPaths.map((p) => (
            <div key={p} className="text-xs text-gray-400 font-mono truncate">
              {p}
            </div>
          ))}
        </div>
        <div>
          <div className="text-xs text-emerald-400 mb-1">{OS_LABEL[simulationOs]}</div>
          {simPaths.map((p) => (
            <div key={p} className="text-xs text-gray-400 font-mono truncate">
              {p}
            </div>
          ))}
        </div>
      </div>
      {profile && (
        <div className="mt-2 text-xs text-gray-600">
          Root: <span className="text-gray-400 font-mono">{profile.root}</span>
          &nbsp;·&nbsp; Sep: <span className="text-gray-400 font-mono">{profile.path_sep === "\\" ? "\\\\" : profile.path_sep}</span>
        </div>
      )}
    </div>
  );
}

export default function ComparisonView({ onSimulate }: Props) {
  const { graphData, comparisonGraphData, simulationOs, osProfiles } = useSystemStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const profile = osProfiles[simulationOs];

  return (
    <div ref={containerRef} className="relative flex h-full w-full gap-0">
      <div className="flex-1 relative border-r border-gray-800 pb-52">
        <SystemGraph data={graphData} title="Real System" height={500} />
      </div>
      <div className="flex-1 relative pb-52">
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
