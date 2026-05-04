export type OSType = "real" | "linux" | "macos" | "windows";

export type AppMode = "live" | "history" | "simulation" | "comparison";

export interface ProcessState {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_mb: number;
  status: string;
  parent_pid: number | null;
  files_accessed: string[];
  last_seen: number;
  created_at: number;
}

export interface FileState {
  path: string;
  size_bytes: number;
  access_count: number;
  last_accessed: number;
  last_modified: number;
  is_hot: boolean;
  event_type: string;
  accessing_processes: number[];
}

export interface Relationship {
  source: string; // "proc:{pid}" | "file:{path}"
  target: string;
  type: "accesses" | "parent_of" | "writes";
  weight: number;
}

export interface SystemState {
  processes: Record<string, ProcessState>;
  files: Record<string, FileState>;
  relationships: Relationship[];
  timestamp: number;
}

export interface SystemStats {
  cpu_percent: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_percent: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_percent: number;
  timestamp: number;
}

export interface OSProfile {
  name: string;
  path_sep: string;
  root: string;
  home_prefix?: string;
  sys_dirs?: string[];
  tmp_dir?: string;
}

export interface SystemEvent {
  type: string;
  path?: string;
  process?: string;
  pid?: number;
  timestamp: number;
  simulated_os?: string;
  original_path?: string;
  original_process?: string;
}

// Graph node for D3
export interface GraphNode {
  id: string;
  label: string;
  nodeType: "process" | "file";
  size: number;
  color: string;
  isHot?: boolean;
  cpuPercent?: number;
  memoryMb?: number;
  accessCount?: number;
  status?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  edgeType: "accesses" | "parent_of" | "writes";
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ReplayFrame {
  timestamp: number;
  state: SystemState;
  event: SystemEvent;
}
