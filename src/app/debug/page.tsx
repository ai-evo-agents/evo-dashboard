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
  entryType: "llm" | "bash" | "gateway";
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

const DEFAULT_REASONING_LEVELS = ["low", "medium", "high", "xhigh"];

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

type Mode = "llm" | "bash" | "gateway";

export default function DebugPage() {
  const { agents } = useAgents();
  const { models, byProvider } = useModels();
  const [mode, setMode] = useState<Mode>("llm");
  const [role, setRole] = useState("learning");
  const [model, setModel] = useState("codex-auth:gpt-5.1-codex-mini");
  const [prompt, setPrompt] = useState("");
  const [bashCommand, setBashCommand] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("high");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const responseRef = useRef<HTMLDivElement>(null);

  // Deduplicate roles from agents (filter out empty strings so fallback list is used)
  const roles = [...new Set(agents.map((a) => a.role).filter(Boolean))].sort();

  // Selected model metadata
  const selectedModel = models.find((m) => m.id === model);

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
        // Guard: deleted events may not carry a task object — skip history update
        if (tc.action === "deleted") return;
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
      const res = await api.debugPrompt({
        agent_role: role,
        model,
        prompt,
        ...(selectedModel?.reasoning && { reasoning_effort: reasoningEffort }),
      });
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
  }, [prompt, sending, role, model, selectedModel, reasoningEffort]);

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

  /** Send a request directly to the gateway API (bypasses king pipeline). */
  const sendGateway = useCallback(async () => {
    if (!prompt.trim() || sending) return;
    setSending(true);
    const entryId = crypto.randomUUID();
    const t0 = Date.now();

    setHistory((prev) => [
      {
        id: entryId,
        role: "direct",
        model,
        prompt,
        status: "pending",
        timestamp: new Date().toLocaleTimeString(),
        entryType: "gateway",
      },
      ...prev,
    ]);

    try {
      const messages: { role: string; content: string }[] = [];
      if (systemPrompt.trim()) {
        messages.push({ role: "system", content: systemPrompt.trim() });
      }
      messages.push({ role: "user", content: prompt });

      const res = await fetch("http://localhost:8080/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          model_reasoning_effort: reasoningEffort,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      // Transition to streaming
      setHistory((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, status: "streaming" } : e
        )
      );

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload);
            const delta: string = chunk.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              setHistory((prev) =>
                prev.map((e) =>
                  e.id === entryId
                    ? { ...e, response: (e.response || "") + delta }
                    : e
                )
              );
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }

      setHistory((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, status: "done", latency_ms: Date.now() - t0 }
            : e
        )
      );
      setPrompt("");
    } catch (err) {
      setHistory((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, status: "error", error: String(err) }
            : e
        )
      );
    } finally {
      setSending(false);
    }
  }, [prompt, sending, model, systemPrompt, reasoningEffort]);

  // Shared model picker JSX (used in both LLM and Gateway modes)
  const modelPicker = (
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
        if (
          !selectedModel ||
          (!selectedModel.context_window &&
            !selectedModel.max_tokens &&
            !selectedModel.reasoning &&
            !(
              selectedModel.input_types &&
              selectedModel.input_types.length > 1
            ))
        )
          return null;
        return (
          <div className="flex flex-wrap gap-1 mt-1">
            {selectedModel.context_window && (
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                {selectedModel.context_window >= 1000
                  ? Math.round(selectedModel.context_window / 1000) + "K"
                  : selectedModel.context_window}{" "}
                ctx
              </span>
            )}
            {selectedModel.max_tokens && (
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                {selectedModel.max_tokens >= 1000
                  ? Math.round(selectedModel.max_tokens / 1000) + "K"
                  : selectedModel.max_tokens}{" "}
                out
              </span>
            )}
            {selectedModel.reasoning && (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
                reasoning
              </span>
            )}
            {selectedModel.input_types &&
              selectedModel.input_types.length > 1 && (
                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded">
                  {selectedModel.input_types.join("+")}
                </span>
              )}
          </div>
        );
      })()}
    </div>
  );

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
            <button
              onClick={() => setMode("gateway")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === "gateway"
                  ? "bg-sky-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Gateway
            </button>
          </div>
          <span className="text-sm text-zinc-500">
            {mode === "llm"
              ? "Send prompts to agents via gateway"
              : mode === "bash"
              ? "Run bash commands with VTY — realtime output"
              : "Direct HTTP to gateway — raw SSE, no king pipeline"}
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
              {modelPicker}
            </div>

            {/* Reasoning effort selector — shown only for models with reasoning support */}
            {selectedModel?.reasoning && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  Reasoning Effort
                </label>
                <div className="flex gap-1">
                  {(
                    selectedModel.reasoning_levels ?? DEFAULT_REASONING_LEVELS
                  ).map((level) => (
                    <button
                      key={level}
                      onClick={() => setReasoningEffort(level)}
                      className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                        reasoningEffort === level
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
        ) : mode === "bash" ? (
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
        ) : (
          /* Gateway Direct mode */
          <>
            {/* Model picker (reused) */}
            {modelPicker}

            {/* Reasoning effort selector — shown only for models with reasoning support */}
            {selectedModel?.reasoning && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  Reasoning Effort
                </label>
                <div className="flex gap-1">
                  {(
                    selectedModel.reasoning_levels ?? DEFAULT_REASONING_LEVELS
                  ).map((level) => (
                    <button
                      key={level}
                      onClick={() => setReasoningEffort(level)}
                      className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                        reasoningEffort === level
                          ? "bg-sky-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* System prompt */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                System Prompt{" "}
                <span className="text-zinc-600">(optional)</span>
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={2}
                placeholder="Optional system prompt..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 resize-y focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* User prompt */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    sendGateway();
                }}
                rows={3}
                placeholder="Type a prompt... (Cmd+Enter to send)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 resize-y focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-600">
                POST{" "}
                <code className="text-sky-400 bg-zinc-800 px-1 rounded">
                  localhost:8080/v1/chat/completions
                </code>{" "}
                — model_reasoning_effort passed in body
              </span>
              <button
                onClick={sendGateway}
                disabled={sending || !prompt.trim()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded transition-colors"
              >
                {sending ? "Sending..." : "Send Direct"}
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
              : mode === "bash"
              ? 'No bash commands run yet. Try:  codex exec --ephemeral --full-auto "hello world"'
              : "No direct requests sent yet. Select a model and send a prompt to test the gateway API."}
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
                    : entry.entryType === "gateway"
                    ? "border-sky-500/30"
                    : "border-blue-500/30"
                  : entry.entryType === "bash"
                  ? "border-violet-500/20"
                  : entry.entryType === "gateway"
                  ? "border-sky-500/20"
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
                  ) : entry.entryType === "gateway" ? (
                    <>
                      <span className="bg-sky-900/40 text-sky-400 px-2 py-0.5 rounded text-[10px]">
                        direct
                      </span>
                      <span className="bg-zinc-800 text-sky-400 px-2 py-0.5 rounded font-mono">
                        {entry.model}
                      </span>
                    </>
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
                          : entry.entryType === "gateway"
                          ? "text-sky-400"
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
                          : entry.entryType === "gateway"
                          ? "text-sky-400"
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
                            : entry.entryType === "gateway"
                            ? "bg-sky-400"
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
