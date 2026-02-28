"use client";
import type { Span } from "@/lib/types";
import { SPAN_KIND_NAMES, STATUS_NAMES } from "@/lib/types";
import { JsonViewer } from "@/components/shared/json-viewer";

export function SpanDetail({ span }: { span: Span }) {
  const durationMs = (span.duration_ns / 1_000_000).toFixed(2);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3 max-h-72 overflow-auto shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-200 truncate">{span.name}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            span.status_code === 2
              ? "bg-red-500/20 text-red-400"
              : span.status_code === 1
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-zinc-700 text-zinc-400"
          }`}
        >
          {STATUS_NAMES[span.status_code] ?? "Unknown"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-zinc-500">Service: </span>
          <span className="text-zinc-300">{span.service_name}</span>
        </div>
        <div>
          <span className="text-zinc-500">Kind: </span>
          <span className="text-zinc-300">{SPAN_KIND_NAMES[span.kind] ?? span.kind}</span>
        </div>
        <div>
          <span className="text-zinc-500">Duration: </span>
          <span className="text-zinc-300">{durationMs}ms</span>
        </div>
        <div>
          <span className="text-zinc-500">Span ID: </span>
          <span className="text-zinc-300 font-mono">{span.span_id.slice(0, 8)}</span>
        </div>
        {span.parent_span_id && (
          <div>
            <span className="text-zinc-500">Parent: </span>
            <span className="text-zinc-300 font-mono">{span.parent_span_id.slice(0, 8)}</span>
          </div>
        )}
        {span.status_message && (
          <div className="col-span-2">
            <span className="text-zinc-500">Message: </span>
            <span className="text-red-400">{span.status_message}</span>
          </div>
        )}
      </div>

      {Array.isArray(span.attributes) && span.attributes.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-1">Attributes</h4>
          <JsonViewer data={span.attributes} />
        </div>
      )}

      {span.events.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-1">
            Events ({span.events.length})
          </h4>
          {span.events.map((ev, i) => (
            <div key={i} className="ml-2 mb-1.5">
              <span className="text-xs text-zinc-300 font-medium">{ev.name}</span>
              {Array.isArray(ev.attributes) && ev.attributes.length > 0 && (
                <div className="mt-0.5">
                  <JsonViewer data={ev.attributes} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
