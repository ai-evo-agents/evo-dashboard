"use client";
import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAgentStore } from "@/store/agent-store";

/**
 * Loads the agent list from the API on mount, polls every 30 s as a
 * fallback, and wires up per-agent real-time updates via the Socket.IO
 * `dashboard:event` feed.
 *
 * Each `agent:status` heartbeat updates ONLY that specific agent's
 * status + last_heartbeat in the Zustand store — other agents are not
 * affected and the page does not re-fetch the full list on every tick.
 */
export function useAgents() {
  const setLoading = useAgentStore((s) => s.setLoading);
  const setAgents = useAgentStore((s) => s.setAgents);
  const upsertAgent = useAgentStore((s) => s.upsertAgent);
  const heartbeatAgent = useAgentStore((s) => s.heartbeatAgent);
  const agents = useAgentStore((s) => s.agents);
  const loading = useAgentStore((s) => s.loading);

  const refresh = useCallback(async () => {
    try {
      const data = await api.agents();
      setAgents(data.agents);
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }, [setAgents, setLoading]);

  useEffect(() => {
    refresh();

    // Poll every 30 s as a fallback to pick up agents we may have missed
    const interval = setInterval(refresh, 30_000);

    // Real-time per-agent updates — no full re-fetch needed
    const socket = getSocket();
    const handler = (evt: { event: string; data: Record<string, unknown> }) => {
      if (evt.event === "agent:register") {
        // A new (or reconnecting) agent announced itself — upsert its full record
        const d = evt.data;
        upsertAgent({
          agent_id: d.agent_id as string,
          role: (d.role as string) ?? "",
          status: "online",
          last_heartbeat: new Date().toISOString(),
          capabilities: (d.capabilities as string[]) ?? [],
          skills: (d.skills as string[]) ?? [],
          pid: (d.pid as number) ?? 0,
        });
      } else if (evt.event === "agent:status") {
        // Heartbeat from a running agent — update only this agent's heartbeat
        const d = evt.data;
        if (typeof d.agent_id === "string" && d.agent_id) {
          heartbeatAgent(d.agent_id, (d.status as string) ?? "heartbeat");
        }
      }
    };

    socket.on("dashboard:event", handler);

    return () => {
      clearInterval(interval);
      socket.off("dashboard:event", handler);
    };
  }, [refresh, upsertAgent, heartbeatAgent]);

  return { agents, loading, refresh };
}
