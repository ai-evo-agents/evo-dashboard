import { create } from "zustand";
import type { Agent } from "@/lib/types";

/** How long since last heartbeat before we consider an agent offline (ms). */
export const HEARTBEAT_TIMEOUT_MS = 60_000;

interface AgentStore {
  agents: Agent[];
  loading: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────

  setLoading: (v: boolean) => void;

  /** Replace the full agents list (from API fetch). */
  setAgents: (agents: Agent[]) => void;

  /**
   * Add or update a single agent by agent_id.
   * Merges the supplied partial fields into the existing record (if any).
   */
  upsertAgent: (agent: Partial<Agent> & { agent_id: string }) => void;

  /**
   * Update ONLY the status + last_heartbeat for a known agent.
   * If the agent is not yet in the store it is ignored — a heartbeat
   * alone is not enough to create a brand-new record.
   */
  heartbeatAgent: (agentId: string, status: string) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  loading: true,

  setLoading: (loading) => set({ loading }),

  setAgents: (agents) => set({ agents }),

  upsertAgent: (update) => {
    set((state) => {
      const idx = state.agents.findIndex((a) => a.agent_id === update.agent_id);
      if (idx >= 0) {
        const next = [...state.agents];
        next[idx] = { ...next[idx], ...update };
        return { agents: next };
      }
      // New agent — fill in defaults for any missing fields
      const newAgent: Agent = {
        agent_id: update.agent_id,
        role: update.role ?? "",
        status: update.status ?? "online",
        last_heartbeat: update.last_heartbeat ?? new Date().toISOString(),
        capabilities: update.capabilities ?? [],
        skills: update.skills ?? [],
        pid: update.pid ?? 0,
        preferred_model: update.preferred_model ?? "",
        reasoning_effort: update.reasoning_effort ?? "",
      };
      return { agents: [...state.agents, newAgent] };
    });
  },

  heartbeatAgent: (agentId, status) => {
    set((state) => {
      const idx = state.agents.findIndex((a) => a.agent_id === agentId);
      if (idx < 0) return state; // Unknown agent — ignore lone heartbeats
      const next = [...state.agents];
      next[idx] = {
        ...next[idx],
        status,
        last_heartbeat: new Date().toISOString(),
      };
      return { agents: next };
    });
  },
}));

// ─── Derived helpers ────────────────────────────────────────────────────────

/** Statuses that indicate a live, healthy agent. */
const LIVE_STATUSES = new Set(["online", "heartbeat", "alive"]);

/**
 * Returns the "effective" status of an agent, taking into account
 * whether we have received a heartbeat recently.
 *
 * If the stored status is "online", "heartbeat", or "alive" but the
 * last_heartbeat timestamp is older than HEARTBEAT_TIMEOUT_MS, the agent
 * is treated as "offline" so the dashboard reflects reality immediately
 * rather than waiting for the next DB poll.
 */
export function getEffectiveStatus(agent: Agent): string {
  if (LIVE_STATUSES.has(agent.status)) {
    const lastSeen = agent.last_heartbeat
      ? Date.now() - new Date(agent.last_heartbeat).getTime()
      : Infinity;
    if (lastSeen > HEARTBEAT_TIMEOUT_MS) return "offline";
  }
  return agent.status;
}

/** Returns true when the agent is considered online/alive right now. */
export function isAgentLive(agent: Agent): boolean {
  return LIVE_STATUSES.has(getEffectiveStatus(agent));
}
