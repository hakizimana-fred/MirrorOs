import { create } from "zustand";
import type {
  SystemState,
  SystemStats,
  SystemEvent,
  OSProfile,
  OSType,
  AppMode,
  GraphData,
  GraphNode,
  GraphEdge,
  ReplayFrame,
  CliHistory,
  CliIntelligence,
} from "@/app/types/system";

const NODE_COLORS = {
  process: "#6366f1",       // indigo
  processHot: "#f59e0b",    // amber
  processIdle: "#4b5563",   // gray
  file: "#10b981",          // emerald
  fileHot: "#ef4444",       // red
  fileInactive: "#374151",  // dark gray
};

function stateToGraph(state: SystemState, maxNodes = 120): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenIds = new Set<string>();

  const procs = Object.values(state.processes)
    .sort((a, b) => b.cpu_percent - a.cpu_percent)
    .slice(0, Math.floor(maxNodes * 0.6));

  for (const p of procs) {
    const id = `proc:${p.pid}`;
    seenIds.add(id);
    nodes.push({
      id,
      label: p.name,
      nodeType: "process",
      size: Math.max(8, Math.min(40, 8 + p.memory_mb / 50)),
      color: p.cpu_percent > 5 ? NODE_COLORS.processHot : NODE_COLORS.process,
      cpuPercent: p.cpu_percent,
      memoryMb: p.memory_mb,
      status: p.status,
    });
  }

  const files = Object.values(state.files)
    .sort((a, b) => b.access_count - a.access_count)
    .slice(0, Math.floor(maxNodes * 0.4));

  for (const f of files) {
    const id = `file:${f.path}`;
    seenIds.add(id);
    const label = f.path.split("/").pop() || f.path;
    nodes.push({
      id,
      label,
      nodeType: "file",
      size: Math.max(6, Math.min(28, 6 + f.access_count * 2)),
      color: f.is_hot ? NODE_COLORS.fileHot : NODE_COLORS.file,
      isHot: f.is_hot,
      accessCount: f.access_count,
    });
  }

  for (const r of state.relationships) {
    if (seenIds.has(r.source) && seenIds.has(r.target)) {
      edges.push({
        source: r.source,
        target: r.target,
        edgeType: r.type as GraphEdge["edgeType"],
        weight: r.weight,
      });
    }
  }

  return { nodes, edges };
}

interface SystemStore {
  connected: boolean;
  mode: AppMode;
  liveState: SystemState | null;
  liveStats: SystemStats | null;
  simulationState: SystemState | null;
  simulationOs: OSType;
  historyEvents: SystemEvent[];
  replayFrames: ReplayFrame[];
  replayIndex: number;
  osProfiles: Record<string, OSProfile>;
  fsScan: unknown[];
  graphData: GraphData;
  comparisonGraphData: GraphData;
  cliHistory: CliHistory | null;
  cliIntelligence: CliIntelligence | null;
  cliLoading: boolean;

  setConnected: (v: boolean) => void;
  setMode: (m: AppMode) => void;
  initState: (msg: { state: SystemState; system: SystemStats; os_profiles: Record<string, OSProfile> }) => void;
  applyUpdate: (msg: { state: SystemState; system: SystemStats; events: SystemEvent[] }) => void;
  setHistoryEvents: (events: SystemEvent[]) => void;
  setSimulation: (msg: { os: string; state: SystemState; profile: OSProfile }) => void;
  setReplayFrames: (frames: ReplayFrame[]) => void;
  setReplayIndex: (i: number) => void;
  setSimulationOs: (os: OSType) => void;
  setFsScan: (files: unknown[]) => void;
  setCliData: (msg: { history: CliHistory; intelligence: CliIntelligence }) => void;
  setCliLoading: (v: boolean) => void;
}

export const useSystemStore = create<SystemStore>((set) => ({
  connected: false,
  mode: "live",
  liveState: null,
  liveStats: null,
  simulationState: null,
  simulationOs: "linux",
  historyEvents: [],
  replayFrames: [],
  replayIndex: 0,
  osProfiles: {},
  fsScan: [],
  graphData: { nodes: [], edges: [] },
  comparisonGraphData: { nodes: [], edges: [] },
  cliHistory: null,
  cliIntelligence: null,
  cliLoading: false,

  setConnected: (connected) => set({ connected }),

  setMode: (mode) => set({ mode }),

  initState: ({ state, system, os_profiles }) =>
    set({
      liveState: state,
      liveStats: system,
      osProfiles: os_profiles,
      graphData: stateToGraph(state),
    }),

  applyUpdate: ({ state, system }) =>
    set({
      liveState: state,
      liveStats: system,
      graphData: stateToGraph(state),
    }),

  setHistoryEvents: (events) => set({ historyEvents: events }),

  setSimulation: ({ os, state }) =>
    set({
      simulationOs: os as OSType,
      simulationState: state,
      comparisonGraphData: stateToGraph(state),
    }),

  setReplayFrames: (frames) => set({ replayFrames: frames, replayIndex: 0 }),

  setReplayIndex: (replayIndex) =>
    set((s) => {
      const frame = s.replayFrames[replayIndex];
      if (!frame) return { replayIndex };
      return { replayIndex, graphData: stateToGraph(frame.state) };
    }),

  setSimulationOs: (simulationOs) => set({ simulationOs }),

  setFsScan: (fsScan) => set({ fsScan }),

  setCliData: ({ history, intelligence }) =>
    set({ cliHistory: history, cliIntelligence: intelligence, cliLoading: false }),

  setCliLoading: (cliLoading) => set({ cliLoading }),
}));
