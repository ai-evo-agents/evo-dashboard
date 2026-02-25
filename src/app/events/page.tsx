"use client";
import { useState } from "react";
import { useEvents } from "@/hooks/use-events";
import { JsonViewer } from "@/components/shared/json-viewer";

const EVENT_TYPES = [
  "agent:register",
  "agent:status",
  "pipeline:next",
  "pipeline:stage_result",
  "task:changed",
];

const EVENT_COLORS: Record<string, string> = {
  "agent:register": "bg-emerald-500/10 text-emerald-400",
  "agent:status": "bg-emerald-500/10 text-emerald-400",
  "pipeline:next": "bg-blue-500/10 text-blue-400",
  "pipeline:stage_result": "bg-blue-500/10 text-blue-400",
  "task:changed": "bg-amber-500/10 text-amber-400",
};

export default function EventsPage() {
  const { events, clear } = useEvents();
  const [search, setSearch] = useState("");
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(
    new Set(EVENT_TYPES)
  );

  const toggleType = (type: string) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filtered = events.filter((ev) => {
    if (!enabledTypes.has(ev.event)) return false;
    if (search) {
      const str = JSON.stringify(ev).toLowerCase();
      if (!str.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Live Events</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">{events.length} total</span>
          <button
            onClick={clear}
            className="text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 px-3 py-1.5 rounded"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 w-64 focus:outline-none focus:border-zinc-600"
        />
        {EVENT_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              enabledTypes.has(type)
                ? EVENT_COLORS[type] || "bg-zinc-700 text-zinc-200"
                : "bg-zinc-800/50 text-zinc-600"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Event stream */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg divide-y divide-zinc-800 max-h-[calc(100vh-220px)] overflow-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            {events.length === 0
              ? "Waiting for events from king..."
              : "No events match filters"}
          </div>
        ) : (
          filtered.map((ev, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-zinc-500 font-mono text-xs w-20 shrink-0">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    EVENT_COLORS[ev.event] || "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {ev.event}
                </span>
              </div>
              <div className="ml-23">
                <JsonViewer data={ev.data} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
