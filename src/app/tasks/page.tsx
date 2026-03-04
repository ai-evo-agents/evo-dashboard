"use client";
import { useState, useEffect, useRef } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useTaskLogs } from "@/hooks/use-task-logs";
import { StatusBadge } from "@/components/shared/status-badge";
import { PIPELINE_STAGES } from "@/lib/types";
import type { Task, TaskLog } from "@/lib/types";
import { api } from "@/lib/api";

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
  const [showCreateForm, setShowCreateForm] = useState(false);

  // When current task changes, auto-select it for log viewing
  const activeTaskId = selectedTaskId || currentTask?.id || null;

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task and all subtasks?")) return;
    try {
      await api.deleteTask(taskId);
    } catch {
      // socket update will handle refresh
    }
  };

  const handleDecompose = async (taskId: string) => {
    try {
      await api.decomposeTask(taskId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="px-3 py-1.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          + New Task
        </button>
      </div>

      {showCreateForm && (
        <CreateTaskForm onClose={() => setShowCreateForm(false)} />
      )}

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
          onDelete={handleDeleteTask}
          onDecompose={handleDecompose}
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
                <div
                  key={task.id}
                  className={`w-full px-4 py-3 flex items-center gap-4 text-sm hover:bg-zinc-800/50 transition-colors ${
                    selectedTaskId === task.id ? "bg-zinc-800/30" : ""
                  }`}
                >
                  <button
                    onClick={() =>
                      setSelectedTaskId(
                        selectedTaskId === task.id ? null : task.id
                      )
                    }
                    className="flex items-center gap-4 flex-1 text-left min-w-0"
                  >
                    <StatusBadge status={task.status} />
                    <span className="text-zinc-400 text-xs shrink-0">
                      {task.current_stage
                        ? STAGE_LABELS[task.current_stage] || task.current_stage
                        : task.task_type}
                    </span>
                    <span className="text-zinc-500 text-xs truncate flex-1">
                      {task.summary || "--"}
                    </span>
                    <span className="text-zinc-600 text-xs shrink-0">
                      {formatDuration(task.created_at, task.updated_at)}
                    </span>
                    <span className="text-zinc-600 text-xs shrink-0">
                      {new Date(task.created_at).toLocaleString()}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTask(task.id);
                    }}
                    className="px-2 py-1 rounded bg-zinc-800 text-red-500/70 hover:text-red-400 text-xs transition-colors shrink-0"
                  >
                    Del
                  </button>
                </div>
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

// ─── Create Task Form ────────────────────────────────────────────────────────

function CreateTaskForm({ onClose }: { onClose: () => void }) {
  const [taskType, setTaskType] = useState("manual");
  const [summary, setSummary] = useState("");
  const [payload, setPayload] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createTask({
        task_type: taskType,
        summary: summary.trim() || undefined,
        payload: payload.trim() || undefined,
      });
      if (!res.success) throw new Error(res.error || "Failed to create task");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">New Task</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-xs"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Task Type</label>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
          >
            <option value="manual">manual</option>
            <option value="pipeline">pipeline</option>
            <option value="debug">debug</option>
            <option value="cron">cron</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Summary</label>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief description..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-zinc-400">
          Payload{" "}
          <span className="text-zinc-600">(JSON, optional)</span>
        </label>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder='{"key": "value"}'
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono resize-none"
        />
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-1.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
        >
          {submitting ? "Creating..." : "Create Task"}
        </button>
      </div>
    </form>
  );
}

// ─── Current Task Card ───────────────────────────────────────────────────────

function CurrentTaskCard({
  task,
  isSelected,
  onSelect,
  onDelete,
  onDecompose,
}: {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (taskId: string) => void;
  onDecompose: (taskId: string) => void;
}) {
  const isRunning = task.status === "running";

  return (
    <div
      className={`w-full text-left bg-zinc-900 border rounded-lg p-5 space-y-4 transition-colors ${
        isSelected
          ? "border-blue-500/40"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* Header row */}
      <button onClick={onSelect} className="w-full text-left">
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
            className={`text-sm font-medium mt-3 ${
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
          <div className="mt-3">
            <TaskStageBar
              currentStage={task.current_stage}
              status={task.status}
            />
          </div>
        )}
      </button>

      {/* Recovery status indicator */}
      {task.status === "recovering" && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2 mt-2">
          <span className="animate-pulse">&#9889;</span>
          <span>Error recovery in progress — evaluation agent is analyzing the failure...</span>
        </div>
      )}

      {/* Subtask list */}
      <SubtaskList taskId={task.id} />

      {/* Action buttons */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onDecompose(task.id)}
          className="px-3 py-1 rounded bg-purple-500/10 text-purple-400 text-xs hover:bg-purple-500/20 transition-colors"
          disabled={task.status === "recovering"}
        >
          Decompose
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="px-3 py-1 rounded bg-red-500/10 text-red-500/70 hover:text-red-400 text-xs transition-colors"
        >
          {task.status === "running" || task.status === "recovering" ? "Abort + Del" : "Del"}
        </button>
      </div>
    </div>
  );
}

// ─── Subtask List ────────────────────────────────────────────────────────────

function SubtaskList({ taskId }: { taskId: string }) {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState({ total: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.taskSubtasks(taskId).then((res) => {
      setSubtasks(res.subtasks || []);
      setProgress(res.progress || { total: 0, completed: 0 });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [taskId]);

  if (loading || progress.total === 0) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200"
      >
        <span>{expanded ? "\u25BC" : "\u25B6"}</span>
        <span>Subtasks ({progress.completed}/{progress.total})</span>
        <div className="flex-1 h-1.5 bg-zinc-800 rounded overflow-hidden max-w-32">
          <div
            className="h-full bg-emerald-500/60 rounded transition-all"
            style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
          />
        </div>
      </button>
      {expanded && (
        <div className="mt-2 ml-4 border-l border-zinc-700 pl-3 space-y-1">
          {subtasks.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2 text-xs py-1">
              <span className={`inline-block w-2 h-2 rounded-full ${
                sub.status === "completed" ? "bg-emerald-500" :
                sub.status === "running" ? "bg-blue-500 animate-pulse" :
                sub.status === "failed" ? "bg-red-500" :
                sub.status === "recovering" ? "bg-amber-500 animate-pulse" :
                sub.status === "decomposed" ? "bg-purple-500" :
                "bg-zinc-500"
              }`} />
              <span className="text-zinc-400 truncate flex-1">{sub.summary || sub.task_type}</span>
              <span className="text-zinc-600 shrink-0">{new Date(sub.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
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
