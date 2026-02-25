"use client";
import { useState, useEffect, useRef } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useTaskLogs } from "@/hooks/use-task-logs";
import { StatusBadge } from "@/components/shared/status-badge";
import { PIPELINE_STAGES } from "@/lib/types";
import type { Task, TaskLog } from "@/lib/types";

const STAGE_LABELS: Record<string, string> = {
  learning: "Learning",
  building: "Building",
  pre_load: "Pre-load",
  evaluation: "Evaluation",
  skill_manage: "Skill Manage",
};

const LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-amber-400",
  error: "text-red-400",
  debug: "text-zinc-500",
};

const LEVEL_BG: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  debug: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

export default function TasksPage() {
  const { currentTask, history, loading } = useTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // When current task changes, auto-select it for log viewing
  const activeTaskId = selectedTaskId || currentTask?.id || null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
      </div>

      {/* Section A: Current Task Hero */}
      {loading ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center text-zinc-500">
          Loading...
        </div>
      ) : currentTask ? (
        <CurrentTaskCard
          task={currentTask}
          isSelected={activeTaskId === currentTask.id}
          onSelect={() => setSelectedTaskId(null)}
        />
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <div className="text-zinc-500 text-sm">No active task</div>
          <div className="text-zinc-600 text-xs mt-1">
            Start a pipeline run to see task progress here
          </div>
        </div>
      )}

      {/* Section B: Task Logs */}
      {activeTaskId && <TaskLogViewer taskId={activeTaskId} />}

      {/* Section C: Task History */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm hover:bg-zinc-800/50 transition-colors"
        >
          <span className="font-medium text-zinc-300">Task History</span>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-xs">
              {history.filter((t) => t.id !== currentTask?.id).length} past
              tasks
            </span>
            <span className="text-zinc-600">
              {showHistory ? "▼" : "▶"}
            </span>
          </div>
        </button>
        {showHistory && (
          <div className="border-t border-zinc-800 divide-y divide-zinc-800">
            {history
              .filter((t) => t.id !== currentTask?.id)
              .map((task) => (
                <button
                  key={task.id}
                  onClick={() =>
                    setSelectedTaskId(
                      selectedTaskId === task.id ? null : task.id
                    )
                  }
                  className={`w-full px-4 py-3 flex items-center gap-4 text-sm hover:bg-zinc-800/50 transition-colors text-left ${
                    selectedTaskId === task.id ? "bg-zinc-800/30" : ""
                  }`}
                >
                  <StatusBadge status={task.status} />
                  <span className="text-zinc-400 text-xs">
                    {task.current_stage
                      ? STAGE_LABELS[task.current_stage] || task.current_stage
                      : task.task_type}
                  </span>
                  <span className="text-zinc-500 text-xs truncate flex-1">
                    {task.summary || "--"}
                  </span>
                  <span className="text-zinc-600 text-xs">
                    {formatDuration(task.created_at, task.updated_at)}
                  </span>
                  <span className="text-zinc-600 text-xs">
                    {new Date(task.created_at).toLocaleString()}
                  </span>
                </button>
              ))}
            {history.filter((t) => t.id !== currentTask?.id).length === 0 && (
              <div className="px-4 py-6 text-center text-zinc-600 text-xs">
                No past tasks
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Current Task Card ───────────────────────────────────────────────────────

function CurrentTaskCard({
  task,
  isSelected,
  onSelect,
}: {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isRunning = task.status === "running";

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left bg-zinc-900 border rounded-lg p-5 space-y-4 transition-colors ${
        isSelected
          ? "border-blue-500/40"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={task.status} />
          {task.run_id && (
            <span className="text-xs text-zinc-600 font-mono">
              {task.run_id.slice(0, 8)}
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-500">
          {new Date(task.created_at).toLocaleString()}
        </span>
      </div>

      {/* Summary */}
      {task.summary && (
        <div
          className={`text-sm font-medium ${
            isRunning ? "text-blue-300" : "text-zinc-300"
          }`}
        >
          {task.summary}
          {isRunning && (
            <span className="inline-block ml-1 animate-pulse">...</span>
          )}
        </div>
      )}

      {/* Pipeline Stage Progress Bar */}
      {task.task_type === "pipeline" && (
        <TaskStageBar
          currentStage={task.current_stage}
          status={task.status}
        />
      )}
    </button>
  );
}

// ─── Pipeline Stage Progress Bar ─────────────────────────────────────────────

function TaskStageBar({
  currentStage,
  status,
}: {
  currentStage: string;
  status: string;
}) {
  const currentIdx = PIPELINE_STAGES.indexOf(
    currentStage as (typeof PIPELINE_STAGES)[number]
  );
  const isFailed = status === "failed";
  const isCompleted = status === "completed";

  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const isPast = isCompleted || i < currentIdx;
        const isCurrent = i === currentIdx && !isCompleted;
        const isFailedStage = isCurrent && isFailed;

        return (
          <div key={stage} className="flex items-center gap-1 flex-1">
            <div
              className={`flex-1 h-7 rounded flex items-center justify-center text-xs font-medium transition-all ${
                isFailedStage
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : isPast
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : isCurrent
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                  : "bg-zinc-800/50 text-zinc-600 border border-zinc-700/50"
              }`}
            >
              {STAGE_LABELS[stage] || stage}
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <span
                className={`text-xs ${
                  isPast ? "text-emerald-600" : "text-zinc-700"
                }`}
              >
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Task Log Viewer ────────────────────────────────────────────────────────

function TaskLogViewer({ taskId }: { taskId: string }) {
  const { logs, loading, levelFilter, setLevelFilter } = useTaskLogs(taskId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If user scrolled up more than 50px from bottom, disable auto-scroll
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  const levels = ["all", "info", "warn", "error"];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Task Logs</h3>
        <div className="flex items-center gap-1">
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                levelFilter === level
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-80 overflow-y-auto font-mono text-xs"
      >
        {loading ? (
          <div className="p-4 text-zinc-500 text-center">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-4 text-zinc-600 text-center">No log entries</div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {logs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {!autoScroll && logs.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="w-full py-1.5 text-xs text-blue-400 hover:bg-zinc-800/50 transition-colors border-t border-zinc-800"
        >
          ↓ Scroll to latest
        </button>
      )}
    </div>
  );
}

function LogEntry({ log }: { log: TaskLog }) {
  const time = new Date(log.created_at).toLocaleTimeString();
  const levelColor = LEVEL_COLORS[log.level] || "text-zinc-500";
  const levelBg = LEVEL_BG[log.level] || LEVEL_BG.debug;

  return (
    <div className="px-4 py-2 flex items-start gap-3 hover:bg-zinc-800/20">
      <span className="text-zinc-600 shrink-0 w-20 pt-0.5">{time}</span>
      <span
        className={`shrink-0 inline-flex rounded border px-1.5 py-0 text-[10px] font-medium uppercase ${levelBg}`}
      >
        {log.level}
      </span>
      {log.stage && (
        <span className="shrink-0 text-zinc-500 bg-zinc-800 rounded px-1.5 py-0 text-[10px]">
          {STAGE_LABELS[log.stage] || log.stage}
        </span>
      )}
      <span className={`${levelColor} flex-1`}>{log.message}</span>
      {log.agent_id && (
        <span className="text-zinc-600 text-[10px] shrink-0">
          {log.agent_id.slice(0, 12)}
        </span>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0 || isNaN(ms)) return "--";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}
