"use client";
import { useEffect, useState } from "react";
import { useAgents } from "@/hooks/use-agents";
import { useModels } from "@/hooks/use-models";
import { StatusBadge } from "@/components/shared/status-badge";
import { getEffectiveStatus, isAgentLive, useAgentStore } from "@/store/agent-store";
import { api } from "@/lib/api";
import type { Agent, ModelEntry } from "@/lib/types";

export default function AgentsPage() {
  const { agents, loading } = useAgents();
  const { models, byProvider, loading: modelsLoading } = useModels();
  const upsertAgent = useAgentStore((s) => s.upsertAgent);

  // Tick every 10 s so "effective status" recomputes even when no socket
  // events arrive (catches agents that silently go offline).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const onlineCount = agents.filter(isAgentLive).length;

  const handleModelChange = async (agentId: string, model: string) => {
    // Optimistic update
    upsertAgent({ agent_id: agentId, preferred_model: model });
    try {
      await api.setAgentModel(agentId, model);
    } catch {
      // Revert on error — refetch will correct it
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agents</h1>
        <span className="text-sm text-zinc-500">
          {onlineCount} online / {agents.length} registered
        </span>
      </div>

      {loading ? (
        <div className="text-zinc-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.agent_id}
              agent={agent}
              byProvider={byProvider}
              modelsLoading={modelsLoading}
              onModelChange={handleModelChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Agent card ──────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  byProvider,
  modelsLoading,
  onModelChange,
}: {
  agent: Agent;
  byProvider: Record<string, ModelEntry[]>;
  modelsLoading: boolean;
  onModelChange: (agentId: string, model: string) => void;
}) {
  const effectiveStatus = getEffectiveStatus(agent);
  const isOnline = isAgentLive(agent);
  const isError =
    effectiveStatus === "failed" || effectiveStatus === "crashed";
  const [saving, setSaving] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSaving(true);
    onModelChange(agent.agent_id, e.target.value);
    // Brief visual feedback
    setTimeout(() => setSaving(false), 600);
  };

  return (
    <div
      className={`bg-zinc-900 border rounded-lg p-5 ${
        isError
          ? "border-red-500/40"
          : isOnline
          ? "border-emerald-500/20"
          : "border-zinc-800"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{agent.role}</h3>
        <StatusBadge status={effectiveStatus} />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Agent ID</span>
          <span className="text-zinc-300 font-mono text-xs truncate max-w-48">
            {agent.agent_id}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">PID</span>
          <span className="text-zinc-300 font-mono">{agent.pid || "--"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Last Heartbeat</span>
          <span
            className={`text-xs ${
              isOnline ? "text-emerald-400" : "text-zinc-500"
            }`}
          >
            {agent.last_heartbeat ? timeAgo(agent.last_heartbeat) : "--"}
          </span>
        </div>
      </div>

      {agent.capabilities.length > 0 && (
        <div className="mt-3">
          <span className="text-xs text-zinc-500">Capabilities</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {agent.capabilities.map((cap, i) => (
              <span
                key={i}
                className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded"
              >
                {String(cap)}
              </span>
            ))}
          </div>
        </div>
      )}

      {agent.skills.length > 0 && (
        <div className="mt-3">
          <span className="text-xs text-zinc-500">Skills</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {agent.skills.map((skill, i) => (
              <span
                key={i}
                className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded"
              >
                {String(skill)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Model Selection */}
      <div className="mt-4 pt-3 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-500">Preferred Model</span>
          {saving && (
            <span className="text-xs text-emerald-400">Saved</span>
          )}
        </div>
        <select
          value={agent.preferred_model || ""}
          onChange={handleChange}
          disabled={modelsLoading}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors"
        >
          <option value="">Auto (system default)</option>
          {Object.entries(byProvider).map(([provider, providerModels]) => (
            <optgroup key={provider} label={provider}>
              {providerModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id.split(":")[1] || m.id}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
