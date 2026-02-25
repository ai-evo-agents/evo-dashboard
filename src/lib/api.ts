import type {
  Agent,
  PipelineRow,
  Task,
  TaskLog,
  GatewayConfig,
  ConfigHistoryEntry,
  CronJob,
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

  debugPrompt: (params: {
    agent_role: string;
    model: string;
    prompt: string;
    provider?: string;
    temperature?: number;
    max_tokens?: number;
  }) =>
    fetchJSON<{ success: boolean; request_id?: string; error?: string }>(
      "/debug/prompt",
      { method: "POST", body: JSON.stringify(params) }
    ),
};
