"use client";
import { useSystemStore } from "@/app/store/systemStore";
import type { AppMode, OSType } from "@/app/types/system";

const MODES: { id: AppMode; label: string; icon: string }[] = [
  { id: "live", label: "Live", icon: "⬤" },
  { id: "history", label: "History", icon: "⟲" },
  { id: "simulation", label: "Simulate", icon: "⬡" },
  { id: "comparison", label: "Compare", icon: "⊞" },
];

const OS_OPTIONS: { id: OSType; label: string }[] = [
  { id: "real", label: "Real" },
  { id: "linux", label: "Linux" },
  { id: "macos", label: "macOS" },
  { id: "windows", label: "Windows" },
];

interface Props {
  onSimulate: (os: OSType) => void;
}

export default function ModeSelector({ onSimulate }: Props) {
  const { mode, setMode, simulationOs, setSimulationOs } = useSystemStore();

  function handleOsSelect(os: OSType) {
    setSimulationOs(os);
    onSimulate(os);
  }

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-900 border-b border-gray-800">
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === m.id
                ? "bg-indigo-600 text-white shadow"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
            }`}
          >
            <span className="mr-1.5">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {(mode === "simulation" || mode === "comparison") && (
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-gray-500">Simulate as:</span>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {OS_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => handleOsSelect(o.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  simulationOs === o.id
                    ? "bg-emerald-700 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
