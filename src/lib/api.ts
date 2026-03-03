import type {
  Agent,
  PipelineRow,
  Task,
  TaskLog,
  GatewayConfig,
  ConfigHistoryEntry,
  CronJob,
  Memory,
  MemoryDetail,
  MemoryStats,
  MemoryTier,
  ModelEntry,
  Trace,
  Span,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_KING_URL || "";

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  health: () => fetchJSON<{ status: string; service: string }>("/health"),

  agents: () => fetchJSON<{ agents: Agent[]; count: number }>("/agents"),

  pipelineStart: (trigger?: string) =>
    fetchJSON<{ success: boolean; run_id: string }>("/pipeline/start", {
      method: "POST",
      body: JSON.stringify({ trigger: trigger || "manual" }),
    }),

  pipelineRuns: () =>
    fetchJSON<{ runs: PipelineRow[]; count: number }>("/pipeline/runs"),

  pipelineDetail: (runId: string) =>
    fetchJSON<{ run_id: string; stages: PipelineRow[]; count: number }>(
      `/pipeline/runs/${runId}`
    ),

  tasks: (params?: { status?: string; agent_id?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.agent_id) qs.set("agent_id", params.agent_id);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return fetchJSON<{ tasks: Task[]; count: number }>(
      `/tasks${query ? `?${query}` : ""}`
    );
  },

  taskCurrent: () => fetchJSON<{ task: Task | null }>("/task/current"),

  createTask: (body: { task_type?: string; summary?: string; payload?: string }) =>
    fetchJSON<{ success: boolean; task?: Task; error?: string }>("/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  taskLogs: (taskId: string, limit?: number, offset?: number) => {
    const qs = new URLSearchParams();
    if (limit) qs.set("limit", String(limit));
    if (offset) qs.set("offset", String(offset));
    const query = qs.toString();
    return fetchJSON<{ logs: TaskLog[]; count: number }>(
      `/task/${taskId}/logs${query ? `?${query}` : ""}`
    );
  },

  gatewayConfig: () => fetchJSON<GatewayConfig>("/gateway/config"),

  updateGateway: (config: GatewayConfig) =>
    fetchJSON<{ success: boolean; error?: string }>("/gateway/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  configHistory: () =>
    fetchJSON<{ history: ConfigHistoryEntry[]; count: number }>(
      "/config-history"
    ),

  crons: () => fetchJSON<{ crons: CronJob[]; count: number }>("/admin/crons"),

  runCron: (name: string) =>
    fetchJSON<{ success: boolean }>(`/admin/crons/${name}/run`, {
      method: "POST",
    }),

  configSync: () =>
    fetchJSON<{ success: boolean }>("/admin/config-sync", { method: "POST" }),

  memories: (params?: {
    scope?: string;
    category?: string;
    agent_id?: string;
    run_id?: string;
    tag?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.scope) qs.set("scope", params.scope);
    if (params?.category) qs.set("category", params.category);
    if (params?.agent_id) qs.set("agent_id", params.agent_id);
    if (params?.run_id) qs.set("run_id", params.run_id);
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return fetchJSON<{ memories: Memory[]; count: number }>(
      `/memories${query ? `?${query}` : ""}`
    );
  },

  memoryDetail: (id: string) =>
    fetchJSON<MemoryDetail>(`/memories/${id}`),

  createMemory: (body: {
    scope: string;
    category: string;
    key: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
    agent_id?: string;
    run_id?: string;
    skill_id?: string;
    relevance_score?: number;
    tiers?: Array<{ tier: string; content: string }>;
  }) =>
    fetchJSON<{ success: boolean; memory: Memory }>("/memories", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateMemory: (
    id: string,
    body: {
      metadata?: Record<string, unknown>;
      tags?: string[];
      relevance_score?: number;
      tiers?: Array<{ tier: string; content: string }>;
    }
  ) =>
    fetchJSON<{ success: boolean; memory: Memory }>(`/memories/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteMemory: (id: string) =>
    fetchJSON<{ success: boolean }>(`/memories/${id}`, { method: "DELETE" }),

  searchMemories: (body: {
    query: string;
    scope?: string;
    category?: string;
    agent_id?: string;
    tier?: string;
    limit?: number;
  }) =>
    fetchJSON<{ memories: Memory[]; count: number }>("/memories/search", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  memoryStats: () =>
    fetchJSON<{ stats: MemoryStats }>("/memories/stats").then((r) => r.stats ?? {}),

  memoryTiers: (memoryId: string) =>
    fetchJSON<{ tiers: MemoryTier[]; count: number }>(`/memories/${memoryId}/tiers`),

  taskMemories: (taskId: string) =>
    fetchJSON<{ memories: Memory[]; count: number }>(`/task/${taskId}/memories`),

  gatewayModels: () =>
    fetchJSON<{ object: string; data: ModelEntry[] }>("/gateway/models"),

  reloadGatewayModels: () =>
    fetchJSON<{ object: string; data: ModelEntry[]; error?: string }>("/gateway/models/refresh", {
      method: "POST",
    }),

  setAgentModel: (agentId: string, model: string) =>
    fetchJSON<{ success: boolean; error?: string }>(
      `/agents/${agentId}/model`,
      { method: "PUT", body: JSON.stringify({ model }) }
    ),

  debugPrompt: (params: {
    agent_role: string;
    model: string;
    prompt: string;
    provider?: string;
    temperature?: number;
    max_tokens?: number;
  }) =>
    fetchJSON<{ success: boolean; request_id?: string; task_id?: string; error?: string }>(
      "/debug/prompt",
      { method: "POST", body: JSON.stringify(params) }
    ),

  debugBash: (params: { command: string; request_id?: string }) =>
    fetchJSON<{ success: boolean; request_id?: string; task_id?: string; error?: string }>(
      "/debug/bash",
      { method: "POST", body: JSON.stringify(params) }
    ),

  // ── Traces ────────────────────────────────────────────────────────────────

  traces: (params?: {
    service?: string;
    status?: number;
    min_duration_ms?: number;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.service) qs.set("service", params.service);
    if (params?.status !== undefined) qs.set("status", String(params.status));
    if (params?.min_duration_ms) qs.set("min_duration_ms", String(params.min_duration_ms));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return fetchJSON<{ traces: Trace[]; count: number }>(
      `/traces${query ? `?${query}` : ""}`
    );
  },

  traceDetail: (traceId: string) =>
    fetchJSON<{ trace: Trace; spans: Span[] }>(`/traces/${traceId}`),
};
