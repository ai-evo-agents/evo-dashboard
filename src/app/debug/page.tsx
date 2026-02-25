"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useAgents } from "@/hooks/use-agents";
import { getSocket } from "@/lib/socket";
import type { DebugResponse } from "@/lib/types";

interface HistoryEntry {
  id: string;
  role: string;
  model: string;
  prompt: string;
  response?: string;
  error?: string;
  latency_ms?: number;
  status: "pending" | "done" | "error";
  timestamp: string;
}

const MODEL_PRESETS = [
  { label: "Codex (default)", value: "codex-cli:default" },
  { label: "Claude Code", value: "claude-code:claude-sonnet-4-5" },
  { label: "GPT-4o Mini", value: "openai:gpt-4o-mini" },
  { label: "GPT-4o", value: "openai:gpt-4o" },
];

export default function DebugPage() {
  const { agents } = useAgents();
  const [role, setRole] = useState("learning");
  const [model, setModel] = useState("codex-cli:default");
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const responseRef = useRef<HTMLDivElement>(null);

  // Deduplicate roles from agents
  const roles = [...new Set(agents.map((a) => a.role))].sort();

  // Listen for debug:response events
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: { event: string; data: DebugResponse }) => {
      if (data.event !== "debug:response") return;
      const dr = data.data;
      setHistory((prev) =>
        prev.map((entry) =>
          entry.id === dr.request_id
            ? {
                ...entry,
                response: dr.response,
                error: dr.error,
                latency_ms: dr.latency_ms,
                status: dr.error ? "error" : "done",
              }
            : entry
        )
      );
    };
    socket.on("dashboard:event", handler);
    return () => {
      socket.off("dashboard:event", handler);
    };
  }, []);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    responseRef.current?.scrollTo(0, responseRef.current.scrollHeight);
  }, [history]);

  const send = useCallback(async () => {
    if (!prompt.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.debugPrompt({ agent_role: role, model, prompt });
      if (res.success && res.request_id) {
        setHistory((prev) => [
          {
            id: res.request_id!,
            role,
            model,
            prompt,
            status: "pending",
            timestamp: new Date().toLocaleTimeString(),
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
        },
        ...prev,
      ]);
    } finally {
      setSending(false);
    }
  }, [prompt, sending, role, model]);

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Debug Prompt</h1>
        <span className="text-sm text-zinc-500">
          Send prompts to agents via gateway
        </span>
      </div>

      {/* Controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
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
                : ["learning", "building", "evaluation", "pre-load", "skill-manage"].map((r) => (
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
                placeholder="provider:model (e.g. codex:default)"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
              />
              <select
                onChange={(e) => {
                  if (e.target.value) setModel(e.target.value);
                }}
                value=""
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm text-zinc-400 focus:outline-none"
              >
                <option value="">Presets</option>
                {MODEL_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
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
            onClick={send}
            disabled={sending || !prompt.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded transition-colors"
          >
            {sending ? "Sending..." : "Send Prompt"}
          </button>
        </div>
      </div>

      {/* History */}
      <div ref={responseRef} className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {history.length === 0 ? (
          <div className="text-center text-zinc-600 py-12">
            No debug prompts sent yet. Send one above to test the gateway
            pipeline.
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
                  : "border-emerald-500/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">{entry.timestamp}</span>
                  <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    {entry.role}
                  </span>
                  <span className="bg-zinc-800 text-blue-400 px-2 py-0.5 rounded font-mono">
                    {entry.model}
                  </span>
                  {entry.status === "pending" && (
                    <span className="text-yellow-400 animate-pulse">
                      waiting...
                    </span>
                  )}
                  {entry.latency_ms !== undefined && (
                    <span className="text-zinc-500">
                      {entry.latency_ms}ms
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs font-mono ${
                    entry.status === "error"
                      ? "text-red-400"
                      : entry.status === "done"
                      ? "text-emerald-400"
                      : "text-yellow-400"
                  }`}
                >
                  {entry.id.slice(0, 8)}
                </span>
              </div>

              {/* Prompt */}
              <div className="mb-2">
                <span className="text-xs text-zinc-500 block mb-1">
                  Prompt
                </span>
                <div className="text-sm text-zinc-300 bg-zinc-800 rounded p-2 font-mono whitespace-pre-wrap">
                  {entry.prompt}
                </div>
              </div>

              {/* Response */}
              {(entry.response || entry.error) && (
                <div>
                  <span className="text-xs text-zinc-500 block mb-1">
                    {entry.error ? "Error" : "Response"}
                  </span>
                  <div
                    className={`text-sm rounded p-2 font-mono whitespace-pre-wrap ${
                      entry.error
                        ? "bg-red-900/20 text-red-300"
                        : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {entry.error || entry.response}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
