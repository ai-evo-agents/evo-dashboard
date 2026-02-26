export interface Agent {
  agent_id: string;
  role: string;
  status: string;
  last_heartbeat: string;
  capabilities: string[];
  skills: string[];
  pid: number;
}

export interface PipelineRow {
  id: string;
  run_id: string;
  stage: string;
  artifact_id: string;
  status: string;
  agent_id: string;
  result: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  task_type: string;
  status: string;
  agent_id: string;
  run_id: string;
  current_stage: string;
  summary: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
}

export interface TaskLog {
  id: string;
  task_id: string;
  level: string;
  message: string;
  detail: string;
  agent_id: string;
  stage: string;
  created_at: string;
}

export interface ProviderConfig {
  name: string;
  base_url: string;
  api_key_envs: string[];
  enabled: boolean;
  provider_type: string;
  extra_headers: Record<string, string>;
  rate_limit: { requests_per_minute: number; burst_size: number } | null;
}

export interface GatewayConfig {
  server: { host: string; port: number };
  providers: ProviderConfig[];
}

export interface ConfigHistoryEntry {
  id: string;
  config_hash: string;
  action: string;
  backup_path: string;
  timestamp: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  created_at: string;
}

export interface DashboardEvent {
  event: string;
  data: unknown;
  timestamp: string;
}

export const PIPELINE_STAGES = [
  "learning",
  "building",
  "pre_load",
  "evaluation",
  "skill_manage",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface MemoryTier {
  id: string;
  memory_id: string;
  tier: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Memory {
  id: string;
  scope: string;
  category: string;
  key: string;
  metadata: Record<string, unknown>;
  tags: string[];
  agent_id: string;
  run_id: string;
  skill_id: string;
  relevance_score: number;
  access_count: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryDetail extends Memory {
  tiers: MemoryTier[];
  task_ids?: string[];
}

export type MemoryStats = Record<string, number>;

export interface DebugResponse {
  request_id: string;
  agent_id: string;
  role: string;
  model: string;
  response?: string;
  error?: string;
  latency_ms: number;
  task_id?: string;
}

export interface DebugStreamChunk {
  request_id: string;
  delta: string;
  chunk_index: number;
  task_id?: string;
}

export interface TaskChangedEvent {
  action: string;
  task: Task;
}
