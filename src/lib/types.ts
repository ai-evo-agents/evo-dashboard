export interface Agent {
  agent_id: string;
  role: string;
  status: string;
  last_heartbeat: string;
  capabilities: string[];
  skills: string[];
  pid: number;
  preferred_model: string;
}

export interface ModelCost {
  input: number; // USD per 1M tokens
  output: number;
  cache_read?: number;
  cache_write?: number;
}

export interface ModelEntry {
  id: string; // "provider:model" format
  object: string;
  owned_by: string;
  provider: string;
  provider_type: string;
  // Rich metadata (optional — present when model_metadata is configured)
  context_window?: number;
  max_tokens?: number;
  reasoning?: boolean;
  input_types?: string[];
  cost?: ModelCost;
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
  models: string[];
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

// ── OpenTelemetry tracing types ───────────────────────────────────────────

export interface Trace {
  trace_id: string;
  service_name: string;
  root_span_name: string;
  start_time_ns: number;
  end_time_ns: number;
  duration_ns: number;
  status_code: number; // 0=unset, 1=ok, 2=error
  span_count: number;
  resource: Record<string, unknown>;
  updated_at: string;
}

export interface Span {
  span_id: string;
  trace_id: string;
  parent_span_id: string;
  name: string;
  kind: number;
  service_name: string;
  start_time_ns: number;
  end_time_ns: number;
  duration_ns: number;
  status_code: number;
  status_message: string;
  attributes: unknown[];
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  time_unix_nano: number;
  attributes: unknown[];
}

export const SPAN_KIND_NAMES: Record<number, string> = {
  0: "Unspecified",
  1: "Internal",
  2: "Server",
  3: "Client",
  4: "Producer",
  5: "Consumer",
};

export const STATUS_NAMES: Record<number, string> = {
  0: "Unset",
  1: "OK",
  2: "Error",
};
