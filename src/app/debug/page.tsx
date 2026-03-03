"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useAgents } from "@/hooks/use-agents";
import { useModels } from "@/hooks/use-models";
import { getSocket } from "@/lib/socket";
import type { DebugResponse, DebugStreamChunk, TaskChangedEvent } from "@/lib/types";

interface HistoryEntry {
  id: string;
  taskId?: string;
  role: string;
  model: string;
  prompt: string;
  response?: string;
  error?: string;
  latency_ms?: number;
  status: "pending" | "streaming" | "done" | "error";
  timestamp: string;
  entryType: "llm" | "bash";
  evaluationSummary?: string;
  evaluationScore?: number;
}

const FALLBACK_PRESETS = [
  { label: "Codex Auth (gpt-5.3-codex)", value: "codex-auth:gpt-5.3-codex" },
  { label: "Codex Auth (gpt-5.1-codex-mini)", value: "codex-auth:gpt-5.1-codex-mini" },
  { label: "Codex CLI (default)", value: "codex-cli:default" },
  { label: "Claude Code", value: "claude-code:claude-sonnet-4-5" },
  { label: "GPT-4o Mini", value: "openai:gpt-4o-mini" },
  { label: "GPT-4o", value: "openai:gpt-4o" },
];

/** Strip ANSI/VT escape sequences so raw PTY output displays as plain text. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return (
    str
      // CSI sequences: ESC [ ... letter  (colors, cursor, erase, etc.)
      .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
      // OSC sequences: ESC ] ... ST or BEL
      .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "")
      // Other two-char ESC sequences
      .replace(/\x1b[^[]/g, "")
      // Non-printable control chars (keep \n \r \t)
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
      // Normalize CRLF / CR to LF
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
  );
}

type Mode = "llm" | "bash";

export default function DebugPage() {
  const { agents } = useAgents();
  const { models, byProvider } = useModels();
  const [mode, setMode] = useState<Mode>("llm");
  const [role, setRole] = useState("learning");
  const [model, setModel] = useState("codex-auth:gpt-5.1-codex-mini");
  const [prompt, setPrompt] = useState("");
  const [bashCommand, setBashCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const responseRef = useRef<HTMLDivElement>(null);

  // Deduplicate roles from agents
  const roles = [...new Set(agents.map((a) => a.role))].sort();

  // Listen for debug:stream (incremental tokens / PTY bytes), debug:response (final),
  // and task:changed (evaluation results)
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: {
      event: string;
      data: DebugResponse | DebugStreamChunk | TaskChangedEvent;
    }) => {
      if (data.event === "debug:stream") {
        const chunk = data.data as DebugStreamChunk;
        setHistory((prev) =>
          prev.map((entry) =>
            entry.id === chunk.request_id
              ? {
                  ...entry,
                  taskId: entry.taskId || chunk.task_id,
                  response: (entry.response || "") + chunk.delta,
                  status:
                    entry.status === "pending" || entry.status === "streaming"
                      ? "streaming"
                      : entry.status,
                }
              : entry
          )
        );
      } else if (data.event === "debug:response") {
        const dr = data.data as DebugResponse;
        setHistory((prev) =>
          prev.map((entry) =>
            entry.id === dr.request_id
              ? {
                  ...entry,
                  taskId: entry.taskId || dr.task_id,
                  // Append the final response to accumulated streaming content
                  response:
                    dr.response && dr.response !== "\n[exit 0]"
                      ? (entry.response || "") + dr.response
                      : entry.response || dr.response,
                  error: dr.error,
                  latency_ms: dr.latency_ms,
                  status: dr.error ? "error" : "done",
                }
              : entry
          )
        );
      } else if (data.event === "task:changed") {
        const tc = data.data as TaskChangedEvent;
        if (tc.action === "evaluated" && tc.task?.summary) {
          // Match by task_id — update the history entry that has this task_id
          setHistory((prev) =>
            prev.map((entry) =>
              entry.taskId === tc.task.id
                ? {
                    ...entry,
                    evaluationSummary: tc.task.summary,
                  }
                : entry
            )
          );
        }
      }
    };
    socket.on("dashboard:event", handler);
    return () => {
      socket.off("dashboard:event", handler);
    };
  }, []);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    responseRef.current?.scrollTo(0, responseRef.current.scrollHeight);
  }, [history]);

  const sendLlm = useCallback(async () => {
    if (!prompt.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.debugPrompt({ agent_role: role, model, prompt });
      if (res.success && res.request_id) {
        setHistory((prev) => [
          {
            id: res.request_id!,
            taskId: res.task_id,
            role,
            model,
            prompt,
            status: "pending",
            timestamp: new Date().toLocaleTimeString(),
            entryType: "llm",
          },
          ...prev,
        ]);
        setPrompt("");
      }
    } catch (e) {
      setHistory((prev) => [
        {
          id: crypto.randomUUID(),
          role,
          model,
          prompt,
          error: String(e),
          status: "error",
          timestamp: new Date().toLocaleTimeString(),
          entryType: "llm",
        },
        ...prev,
      ]);
    } finally {
      setSending(false);
    }
  }, [prompt, sending, role, model]);

  const sendBash = useCallback(async () => {
    if (!bashCommand.trim() || sending) return;
    setSending(true);
    const requestId = crypto.randomUUID();
    try {
      const res = await api.debugBash({
        command: bashCommand,
        request_id: requestId,
      });
      if (res.success) {
        setHistory((prev) => [
          {
            id: res.request_id || requestId,
            taskId: res.task_id,
            role: "bash",
            model: "bash-pty",
            prompt: bashCommand,
            status: "pending",
            timestamp: new Date().toLocaleTimeString(),
            entryType: "bash",
          },
          ...prev,
        ]);
        setBashCommand("");
      }
    } catch (e) {
      setHistory((prev) => [
        {
          id: requestId,
          role: "bash",
          model: "bash-pty",
          prompt: bashCommand,
          error: String(e),
          status: "error",
          timestamp: new Date().toLocaleTimeString(),
          entryType: "bash",
        },
        ...prev,
      ]);
    } finally {
      setSending(false);
    }
  }, [bashCommand, sending]);

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Debug Prompt</h1>
        <div className="flex items-center gap-4">
          {/* Mode toggle */}
          <div className="flex bg-zinc-800 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setMode("llm")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === "llm"
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              LLM
            </button>
            <button
              onClick={() => setMode("bash")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === "bash"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Bash PTY
            </button>
          </div>
          <span className="text-sm text-zinc-500">
            {mode === "llm"
              ? "Send prompts to agents via gateway"
              : "Run bash commands with VTY — realtime output"}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
        {mode === "llm" ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              {/* Agent Role */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  Agent Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  {roles.length > 0
                    ? roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))
                    : [
                        "learning",
                        "building",
                        "evaluation",
                        "pre-load",
                        "skill-manage",
                      ].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                </select>
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  Model (provider:model)
                </label>
                <div className="flex gap-2">
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="provider:model (e.g. codex-auth:gpt-5.3-codex)"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <select
                    onChange={(e) => {
                      if (e.target.value) setModel(e.target.value);
                    }}
                    value=""
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-zinc-400 focus:outline-none"
                  >
                    <option value="">Models</option>
                    {models.length > 0
                      ? Object.entries(byProvider).map(
                          ([provider, providerModels]) => (
                            <optgroup key={provider} label={provider}>
                              {providerModels.map((m) => {
                                const name = m.id.split(":")[1] || m.id;
                                const meta: string[] = [];
                                if (m.context_window)
                                  meta.push(
                                    `${m.context_window >= 1000 ? Math.round(m.context_window / 1000) + "K" : m.context_window} ctx`
                                  );
                                if (m.reasoning) meta.push("reasoning");
                                const suffix =
                                  meta.length > 0
                                    ? ` (${meta.join(", ")})`
                                    : "";
                                return (
                                  <option key={m.id} value={m.id}>
                                    {name}
                                    {suffix}
                                  </option>
                                );
                              })}
                            </optgroup>
                          )
                        )
                      : FALLBACK_PRESETS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                  </select>
                </div>
                {/* Selected model metadata badges */}
                {(() => {
                  const selected = models.find((m) => m.id === model);
                  if (
                    !selected ||
                    (!selected.context_window &&
                      !selected.max_tokens &&
                      !selected.reasoning &&
                      !(
                        selected.input_types &&
                        selected.input_types.length > 1
                      ))
                  )
                    return null;
                  return (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selected.context_window && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                          {selected.context_window >= 1000
                            ? Math.round(selected.context_window / 1000) +
                              "K"
                            : selected.context_window}{" "}
                          ctx
                        </span>
                      )}
                      {selected.max_tokens && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                          {selected.max_tokens >= 1000
                            ? Math.round(selected.max_tokens / 1000) + "K"
                            : selected.max_tokens}{" "}
                          out
                        </span>
                      )}
                      {selected.reasoning && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
                          reasoning
                        </span>
                      )}
                      {selected.input_types &&
                        selected.input_types.length > 1 && (
                          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded">
                            {selected.input_types.join("+")}
                          </span>
                        )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendLlm();
                }}
                rows={3}
                placeholder="Type a prompt... (Cmd+Enter to send)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 resize-y focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-600">
                Agent uses its soul.md behavior as system prompt
              </span>
              <button
                onClick={sendLlm}
                disabled={sending || !prompt.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded transition-colors"
              >
                {sending ? "Sending..." : "Send Prompt"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Bash command input */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                Bash Command
              </label>
              <input
                value={bashCommand}
                onChange={(e) => setBashCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendBash();
                }}
                placeholder='e.g.  codex exec --ephemeral --full-auto "check if playwright is available"'
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-600">
                Runs via{" "}
                <code className="text-violet-400 bg-zinc-800 px-1 rounded">
                  bash -c
                </code>{" "}
                in a PTY — full terminal output streamed in realtime
              </span>
              <button
                onClick={sendBash}
                disabled={sending || !bashCommand.trim()}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded transition-colors"
              >
                {sending ? "Running..." : "Run Command"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* History */}
      <div ref={responseRef} className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {history.length === 0 ? (
          <div className="text-center text-zinc-600 py-12">
            {mode === "llm"
              ? "No debug prompts sent yet. Send one above to test the gateway pipeline."
              : 'No bash commands run yet. Try:  codex exec --ephemeral --full-auto "hello world"'}
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className={`bg-zinc-900 border rounded-lg p-4 ${
                entry.status === "error"
                  ? "border-red-500/40"
                  : entry.status === "pending"
                  ? "border-yellow-500/30"
                  : entry.status === "streaming"
                  ? entry.entryType === "bash"
                    ? "border-violet-500/30"
                    : "border-blue-500/30"
                  : entry.entryType === "bash"
                  ? "border-violet-500/20"
                  : "border-emerald-500/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">{entry.timestamp}</span>

                  {entry.entryType === "bash" ? (
                    <span className="bg-violet-900/40 text-violet-400 px-2 py-0.5 rounded font-mono">
                      bash-pty
                    </span>
                  ) : (
                    <>
                      <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                        {entry.role}
                      </span>
                      <span className="bg-zinc-800 text-blue-400 px-2 py-0.5 rounded font-mono">
                        {entry.model}
                      </span>
                    </>
                  )}

                  {entry.status === "pending" && (
                    <span className="text-yellow-400 animate-pulse">
                      waiting...
                    </span>
                  )}
                  {entry.status === "streaming" && (
                    <span
                      className={`animate-pulse ${
                        entry.entryType === "bash"
                          ? "text-violet-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {entry.entryType === "bash" ? "running..." : "streaming..."}
                    </span>
                  )}
                  {entry.latency_ms !== undefined && (
                    <span className="text-zinc-500">{entry.latency_ms}ms</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {entry.taskId && (
                    <span className="text-xs font-mono bg-zinc-800 text-cyan-400 px-1.5 py-0.5 rounded" title={`Task: ${entry.taskId}`}>
                      task:{entry.taskId.slice(0, 6)}
                    </span>
                  )}
                  <span
                    className={`text-xs font-mono ${
                      entry.status === "error"
                        ? "text-red-400"
                        : entry.status === "done"
                        ? entry.entryType === "bash"
                          ? "text-violet-400"
                          : "text-emerald-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {entry.id.slice(0, 8)}
                  </span>
                </div>
              </div>

              {/* Command / Prompt */}
              <div className="mb-2">
                <span className="text-xs text-zinc-500 block mb-1">
                  {entry.entryType === "bash" ? "Command" : "Prompt"}
                </span>
                <div className="text-sm text-zinc-300 bg-zinc-800 rounded p-2 font-mono whitespace-pre-wrap">
                  {entry.prompt}
                </div>
              </div>

              {/* Output / Response */}
              {(entry.response || entry.error || entry.status === "streaming") && (
                <div>
                  <span className="text-xs text-zinc-500 block mb-1">
                    {entry.error
                      ? "Error"
                      : entry.entryType === "bash"
                      ? "Output"
                      : "Response"}
                  </span>
                  <div
                    className={`text-sm rounded p-2 font-mono whitespace-pre-wrap leading-relaxed ${
                      entry.error
                        ? "bg-red-900/20 text-red-300"
                        : entry.entryType === "bash"
                        ? "bg-zinc-950 text-zinc-200 border border-zinc-800"
                        : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {entry.error
                      ? entry.error
                      : entry.entryType === "bash"
                      ? stripAnsi(entry.response || "")
                      : entry.response}
                    {entry.status === "streaming" && (
                      <span
                        className={`inline-block w-2 h-4 animate-pulse ml-0.5 align-middle ${
                          entry.entryType === "bash"
                            ? "bg-violet-400"
                            : "bg-emerald-400"
                        }`}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Evaluation summary badge */}
              {entry.evaluationSummary && (
                <div className="mt-2 flex items-start gap-2 bg-amber-900/20 border border-amber-500/30 rounded-lg p-2">
                  <span className="text-xs font-medium text-amber-400 shrink-0 mt-0.5">
                    ✦ Eval
                  </span>
                  <span className="text-xs text-amber-200/80 leading-relaxed">
                    {entry.evaluationSummary}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
