"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAgents } from "@/hooks/use-agents";
import { usePipeline } from "@/hooks/use-pipeline";
import { useEvents } from "@/hooks/use-events";
import { StatusBadge } from "@/components/shared/status-badge";

export default function OverviewPage() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const { agents } = useAgents();
  const { runs } = usePipeline();
  const { events } = useEvents();

  useEffect(() => {
    const check = () =>
      api
        .health()
        .then(() => setHealthy(true))
        .catch(() => setHealthy(false));
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = agents.filter(
    (a) => a.status === "online" || a.status === "heartbeat" || a.status === "alive"
  ).length;
  const activeRuns = runs.filter((r) => r.status === "running");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              healthy === true
                ? "bg-emerald-400 animate-pulse"
                : healthy === false
                ? "bg-red-400"
                : "bg-zinc-600"
            }`}
          />
          <span className="text-zinc-400">
            King{" "}
            {healthy === true
              ? "connected"
              : healthy === false
              ? "unreachable"
              : "checking..."}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Agents Online"
          value={`${onlineCount} / ${agents.length}`}
          accent="emerald"
        />
        <SummaryCard
          label="Active Pipelines"
          value={String(activeRuns.length)}
          accent="blue"
        />
        <SummaryCard
          label="Total Runs"
          value={String(runs.length)}
          accent="zinc"
        />
        <SummaryCard
          label="Live Events"
          value={String(events.length)}
          accent="amber"
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Kernel Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {agents.map((agent) => (
            <div
              key={agent.agent_id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate">
                  {agent.role}
                </span>
                <StatusBadge status={agent.status} />
              </div>
              <div className="text-xs text-zinc-500">
                PID {agent.pid || "--"}
              </div>
            </div>
          ))}
          {agents.length === 0 && (
            <div className="text-zinc-500 text-sm col-span-6">
              No agents registered
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Events</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg divide-y divide-zinc-800">
          {events.slice(0, 10).map((ev, i) => (
            <div key={i} className="px-4 py-2 flex items-center gap-3 text-sm">
              <span className="text-zinc-500 font-mono text-xs w-20 shrink-0">
                {new Date(ev.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                {ev.event}
              </span>
              <span className="text-zinc-400 truncate font-mono text-xs">
                {JSON.stringify(ev.data).slice(0, 100)}
              </span>
            </div>
          ))}
          {events.length === 0 && (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              Waiting for events...
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const borders: Record<string, string> = {
    emerald: "border-emerald-500/30",
    blue: "border-blue-500/30",
    amber: "border-amber-500/30",
    zinc: "border-zinc-700",
  };
  return (
    <div
      className={`bg-zinc-900 border ${
        borders[accent] || borders.zinc
      } rounded-lg p-4`}
    >
      <div className="text-xs text-zinc-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
