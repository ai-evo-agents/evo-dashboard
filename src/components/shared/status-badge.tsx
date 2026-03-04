const colors: Record<string, string> = {
  online: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  heartbeat: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  // "alive" is what kernel agents report in their agent:status heartbeat
  alive: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pending: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  crashed: "bg-red-500/20 text-red-400 border-red-500/30",
  timed_out: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  offline: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  recovering: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  decomposed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = colors[status] || colors.offline;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "online" || status === "heartbeat" || status === "alive"
            ? "bg-emerald-400 animate-pulse"
            : status === "running" || status === "in_progress"
            ? "bg-blue-400 animate-pulse"
            : status === "recovering"
            ? "bg-amber-400 animate-pulse"
            : status === "decomposed"
            ? "bg-purple-400"
            : status === "failed" || status === "crashed"
            ? "bg-red-400"
            : "bg-zinc-400"
        }`}
      />
      {status}
    </span>
  );
}
