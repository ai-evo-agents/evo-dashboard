"use client";
import type { Trace, Span } from "@/lib/types";
import { SPAN_KIND_NAMES } from "@/lib/types";

const SERVICE_COLORS: Record<string, string> = {
  king: "bg-blue-500/20 text-blue-400",
  gateway: "bg-purple-500/20 text-purple-400",
  learning: "bg-emerald-500/20 text-emerald-400",
  building: "bg-amber-500/20 text-amber-400",
  evaluation: "bg-cyan-500/20 text-cyan-400",
  "pre-load": "bg-rose-500/20 text-rose-400",
  "skill-manage": "bg-orange-500/20 text-orange-400",
  update: "bg-teal-500/20 text-teal-400",
};

function svcColor(name: string): string {
  return SERVICE_COLORS[name] ?? "bg-zinc-700/50 text-zinc-400";
}

interface Props {
  trace: Trace;
  spans: Span[];
  onSelectSpan: (span: Span) => void;
  selectedSpanId?: string;
}

export function SpanWaterfall({ trace, spans, onSelectSpan, selectedSpanId }: Props) {
  const traceStart = trace.start_time_ns;
  const traceDuration = trace.duration_ns || 1;

  // Build parent → children map
  const childMap = new Map<string, Span[]>();
  const roots: Span[] = [];
  for (const span of spans) {
    if (!span.parent_span_id) {
      roots.push(span);
    } else {
      const siblings = childMap.get(span.parent_span_id) || [];
      siblings.push(span);
      childMap.set(span.parent_span_id, siblings);
    }
  }

  function renderSpan(span: Span, depth: number): React.ReactNode[] {
    const left = ((span.start_time_ns - traceStart) / traceDuration) * 100;
    const width = Math.max((span.duration_ns / traceDuration) * 100, 0.5);
    const durationMs = (span.duration_ns / 1_000_000).toFixed(1);
    const isSelected = span.span_id === selectedSpanId;
    const children = childMap.get(span.span_id) || [];

    return [
      <div
        key={span.span_id}
        onClick={() => onSelectSpan(span)}
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer border-b border-zinc-800/50 transition-colors ${
          isSelected ? "bg-zinc-800" : "hover:bg-zinc-800/40"
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <span className="text-[11px] text-zinc-500 w-14 shrink-0 font-mono text-right">
          {durationMs}ms
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${svcColor(span.service_name)}`}
        >
          {span.service_name}
        </span>
        <span className="text-xs text-zinc-300 truncate" title={`${span.name} (${SPAN_KIND_NAMES[span.kind] ?? "?"})`}>
          {span.name}
        </span>
        <div className="flex-1 h-3.5 relative ml-2 bg-zinc-800/30 rounded-sm">
          <div
            className={`absolute h-full rounded-sm ${
              span.status_code === 2 ? "bg-red-500/60" : "bg-emerald-500/40"
            }`}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        </div>
      </div>,
      ...children.flatMap((child) => renderSpan(child, depth + 1)),
    ];
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-auto flex-1 min-h-0">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
        <span className="text-sm font-medium text-zinc-200 truncate">
          {trace.root_span_name}
        </span>
        <span className="text-xs text-zinc-500 shrink-0 ml-2">
          {spans.length} spans &middot; {(trace.duration_ns / 1_000_000).toFixed(1)}ms
        </span>
      </div>
      <div>{roots.flatMap((root) => renderSpan(root, 0))}</div>
    </div>
  );
}
