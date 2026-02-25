"use client";
import { useState } from "react";
import { usePipeline } from "@/hooks/use-pipeline";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { JsonViewer } from "@/components/shared/json-viewer";
import { PIPELINE_STAGES, type PipelineRow } from "@/lib/types";

export default function PipelinePage() {
  const { runs, loading, startRun } = usePipeline();
  const [starting, setStarting] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineRow[]>([]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startRun();
    } finally {
      setStarting(false);
    }
  };

  const toggleExpand = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);
    try {
      const data = await api.pipelineDetail(runId);
      setStages(data.stages);
    } catch {
      setStages([]);
    }
  };

  // Group runs by run_id
  const runIds = [...new Set(runs.map((r) => r.run_id))];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pipeline</h1>
        <button
          onClick={handleStart}
          disabled={starting}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          {starting ? "Starting..." : "Start Pipeline Run"}
        </button>
      </div>

      {/* Active pipeline stage bar */}
      {runs.filter((r) => r.status === "running").length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">
            Active Pipeline
          </h3>
          <StageBar runs={runs} />
        </div>
      )}

      {/* Run history */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium">Run History</h3>
        </div>
        {loading ? (
          <div className="p-4 text-zinc-500">Loading...</div>
        ) : runIds.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            No pipeline runs yet
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {runIds.map((runId) => {
              const runStages = runs.filter((r) => r.run_id === runId);
              const latest = runStages[0];
              return (
                <div key={runId}>
                  <button
                    onClick={() => toggleExpand(runId)}
                    className="w-full px-4 py-3 flex items-center gap-4 text-sm hover:bg-zinc-800/50 transition-colors text-left"
                  >
                    <span className="font-mono text-xs text-zinc-500 w-64 truncate">
                      {runId}
                    </span>
                    <StatusBadge status={latest.status} />
                    <span className="text-zinc-400">{latest.stage}</span>
                    <span className="text-zinc-500 text-xs ml-auto">
                      {new Date(latest.created_at).toLocaleString()}
                    </span>
                    <span className="text-zinc-600">
                      {expandedRun === runId ? "▼" : "▶"}
                    </span>
                  </button>
                  {expandedRun === runId && (
                    <div className="px-4 pb-4 bg-zinc-950/50">
                      <div className="space-y-2">
                        {stages.map((s) => (
                          <div
                            key={s.id}
                            className="bg-zinc-900 border border-zinc-800 rounded p-3"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-medium text-sm">
                                {s.stage}
                              </span>
                              <StatusBadge status={s.status} />
                              {s.agent_id && (
                                <span className="text-xs text-zinc-500 font-mono">
                                  {s.agent_id}
                                </span>
                              )}
                            </div>
                            {s.error && (
                              <div className="text-xs text-red-400 mb-1">
                                Error: {s.error}
                              </div>
                            )}
                            <JsonViewer data={s.result} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StageBar({ runs }: { runs: PipelineRow[] }) {
  const activeRuns = runs.filter((r) => r.status === "running");
  const completedStages = runs
    .filter((r) => r.status === "completed")
    .map((r) => r.stage);
  const currentStage = activeRuns.length > 0 ? activeRuns[0].stage : null;

  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const isComplete = completedStages.includes(stage);
        const isCurrent = stage === currentStage;
        return (
          <div key={stage} className="flex items-center gap-1 flex-1">
            <div
              className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-medium transition-colors ${
                isComplete
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : isCurrent
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700"
              }`}
            >
              {stage.replace("_", " ")}
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <span className="text-zinc-600 text-xs">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
