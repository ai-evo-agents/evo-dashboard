"use client";
import { useState } from "react";

export function JsonViewer({ data }: { data: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const str =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);

  if (!str || str === "null" || str === "{}") {
    return <span className="text-zinc-500 text-xs">--</span>;
  }

  const preview = str.length > 80 ? str.slice(0, 80) + "..." : str;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-zinc-400 hover:text-zinc-200 font-mono text-left"
      >
        {expanded ? "[-]" : "[+]"} {expanded ? "" : preview}
      </button>
      {expanded && (
        <pre className="mt-1 text-xs font-mono text-zinc-300 bg-zinc-900 rounded p-2 overflow-auto max-h-64">
          {str}
        </pre>
      )}
    </div>
  );
}
