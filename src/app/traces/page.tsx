"use client";
import { useState } from "react";
import { useTraces, useTraceDetail } from "@/hooks/use-traces";
import type { TraceFilters } from "@/hooks/use-traces";
import type { Trace, Span } from "@/lib/types";
import { STATUS_NAMES } from "@/lib/types";
import { SpanWaterfall } from "@/components/traces/span-waterfall";
import { SpanDetail } from "@/components/traces/span-detail";

export default function TracesPage() {
  const [filters, setFilters] = useState<TraceFilters>({});
  const [serviceInput, setServiceInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [minDurationInput, setMinDurationInput] = useState("");
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  const { traces, count, loading, offset, setOffset, limit } =
    useTraces(filters);
  const {
    trace: traceDetail,
    spans,
    loading: detailLoading,
  } = useTraceDetail(selectedTraceId);

  const applyFilters = () => {
    setFilters({
      service: serviceInput || undefined,
      status: statusFilter ? Number(statusFilter) : undefined,
      minDurationMs: minDurationInput ? Number(minDurationInput) : undefined,
    });
    setOffset(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") applyFilters();
  };

  const totalPages = Math.ceil(count / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="p-6 h-[calc(100vh-0px)] flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold">Traces</h1>
        <span className="text-sm text-zinc-500">{count} traces</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <input
          type="text"
          placeholder="Service name..."
          value={serviceInput}
          onChange={(e) => setServiceInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 w-40 focus:outline-none focus:border-zinc-600"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setFilters((f) => ({
              ...f,
              status: e.target.value ? Number(e.target.value) : undefined,
            }));
            setOffset(0);
          }}
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
        >
          <option value="">All statuses</option>
          <option value="0">Unset</option>
          <option value="1">OK</option>
          <option value="2">Error</option>
        </select>
        <input
          type="number"
          placeholder="Min ms..."
          value={minDurationInput}
          onChange={(e) => setMinDurationInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 w-28 focus:outline-none focus:border-zinc-600"
        />
        <button
          onClick={applyFilters}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-md transition-colors"
        >
          Filter
        </button>
      </div>

      {/* Main content — two-panel */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left panel: trace list */}
        <div className="w-96 shrink-0 flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 text-xs text-zinc-500 font-medium">
            Trace List
          </div>
          <div className="flex-1 overflow-auto divide-y divide-zinc-800/50">
            {loading ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                Loading...
              </div>
            ) : traces.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                No traces found
              </div>
            ) : (
              traces.map((trace) => (
                <TraceRow
                  key={trace.trace_id}
                  trace={trace}
                  isSelected={selectedTraceId === trace.trace_id}
                  onSelect={() => {
                    setSelectedTraceId(trace.trace_id);
                    setSelectedSpan(null);
                  }}
                />
              ))
            )}
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-2 py-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Right panel: waterfall + span detail */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
          {selectedTraceId ? (
            detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                Loading trace...
              </div>
            ) : traceDetail ? (
              <>
                <SpanWaterfall
                  trace={traceDetail}
                  spans={spans}
                  onSelectSpan={setSelectedSpan}
                  selectedSpanId={selectedSpan?.span_id}
                />
                {selectedSpan && <SpanDetail span={selectedSpan} />}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                Trace not found
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
              Select a trace to view its span waterfall
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Trace Row ───────────────────────────────────────────────────────────────

function TraceRow({
  trace,
  isSelected,
  onSelect,
}: {
  trace: Trace;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const durationMs = (trace.duration_ns / 1_000_000).toFixed(1);
  const time = trace.updated_at
    ? new Date(trace.updated_at).toLocaleTimeString()
    : "--";

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 transition-colors ${
        isSelected
          ? "bg-zinc-800"
          : "hover:bg-zinc-800/40"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-zinc-200 truncate font-medium">
          {trace.root_span_name || trace.trace_id.slice(0, 16)}
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ml-2 ${
            trace.status_code === 2
              ? "bg-red-500/20 text-red-400"
              : trace.status_code === 1
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-zinc-700 text-zinc-400"
          }`}
        >
          {STATUS_NAMES[trace.status_code] ?? "Unknown"}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
          {trace.service_name || "unknown"}
        </span>
        <span>{durationMs}ms</span>
        <span>{trace.span_count} spans</span>
        <span className="ml-auto">{time}</span>
      </div>
    </button>
  );
}
