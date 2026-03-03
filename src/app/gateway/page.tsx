"use client";
import { useState, useEffect } from "react";
import { useGatewayConfig } from "@/hooks/use-gateway-config";
import { useModels } from "@/hooks/use-models";
import { api } from "@/lib/api";
import type { ConfigHistoryEntry, ProviderConfig, ModelEntry } from "@/lib/types";

const typeLabels: Record<string, string> = {
  open_ai_compatible: "OpenAI Compatible",
  anthropic: "Anthropic",
  cursor: "Cursor CLI",
  claude_code: "Claude Code",
  codex_cli: "Codex CLI",
  codex_auth: "Codex Auth",
  google: "Google Gemini",
  github_copilot: "GitHub Copilot",
};

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

export default function GatewayPage() {
  const { config, loading, saving, save } = useGatewayConfig();
  const {
    models,
    byProvider,
    loading: modelsLoading,
    refreshing,
    refresh: refreshModels,
    lastRefresh,
  } = useModels();
  const [history, setHistory] = useState<ConfigHistoryEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api
      .configHistory()
      .then((d) => setHistory(d.history))
      .catch(() => {});
  }, []);

  const toggleProvider = async (name: string) => {
    if (!config) return;
    const updated = {
      ...config,
      providers: config.providers.map((p) =>
        p.name === name ? { ...p, enabled: !p.enabled } : p
      ),
    };
    const res = await save(updated);
    setToast(res.success ? "Config saved" : `Error: ${res.error}`);
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Gateway</h1>
        <div className="text-zinc-500">Loading config...</div>
      </div>
    );
  }

  const enabledCount = config?.providers?.filter((p) => p.enabled).length ?? 0;
  const totalProviders = config?.providers?.length ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Gateway</h1>
          {config?.server && (
            <span className="text-sm text-zinc-500">
              {config.server.host}:{config.server.port}
            </span>
          )}
          <span className="text-xs text-zinc-600">
            {enabledCount}/{totalProviders} providers &middot; {models.length}{" "}
            models
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-zinc-600">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refreshModels}
            disabled={refreshing}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            <span
              className={`inline-block ${refreshing ? "animate-spin" : ""}`}
            >
              &#x21bb;
            </span>
            {refreshing ? "Refreshing..." : "Refresh Models"}
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`px-4 py-2 rounded-md text-sm ${
            toast.startsWith("Error")
              ? "bg-red-500/20 text-red-400"
              : "bg-emerald-500/20 text-emerald-400"
          }`}
        >
          {toast}
        </div>
      )}

      {/* Provider grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {config?.providers?.map((provider) => (
          <ProviderCard
            key={provider.name}
            provider={provider}
            liveModels={byProvider[provider.name] || []}
            modelsLoading={modelsLoading}
            onToggle={() => toggleProvider(provider.name)}
            saving={saving}
          />
        ))}
      </div>

      {/* Config history */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Config History</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
          {history.length === 0 ? (
            <div className="p-4 text-zinc-500 text-sm">
              No changes recorded
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {history.slice(0, 20).map((h) => (
                <div
                  key={h.id}
                  className="px-4 py-3 flex items-center gap-4 text-sm"
                >
                  <span className="text-zinc-500 font-mono text-xs">
                    {new Date(h.timestamp).toLocaleString()}
                  </span>
                  <span className="text-zinc-300">{h.action}</span>
                  <span className="text-zinc-500 font-mono text-xs truncate">
                    {h.config_hash.slice(0, 12)}
                  </span>
                  {h.backup_path && (
                    <span className="text-zinc-600 text-xs truncate ml-auto">
                      {h.backup_path}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProviderCard({
  provider,
  liveModels,
  modelsLoading,
  onToggle,
  saving,
}: {
  provider: ProviderConfig;
  liveModels: ModelEntry[];
  modelsLoading: boolean;
  onToggle: () => void;
  saving: boolean;
}) {
  // Determine which models to show: prefer live data, fall back to config
  const hasLiveModels = liveModels.length > 0;
  const modelCount = hasLiveModels
    ? liveModels.length
    : provider.models?.length ?? 0;

  return (
    <div
      className={`bg-zinc-900 border rounded-lg p-4 ${
        provider.enabled ? "border-emerald-500/20" : "border-zinc-800"
      }`}
    >
      {/* Header: name, model count, toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{provider.name}</h3>
          {modelCount > 0 && (
            <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
              {modelCount} model{modelCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          disabled={saving}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            provider.enabled ? "bg-emerald-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              provider.enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      <div className="space-y-2 text-sm">
        {/* Provider type */}
        <div className="flex justify-between">
          <span className="text-zinc-500">Type</span>
          <span className="text-zinc-300">
            {typeLabels[provider.provider_type] || provider.provider_type}
          </span>
        </div>

        {/* Base URL */}
        {provider.base_url && (
          <div className="flex justify-between">
            <span className="text-zinc-500">URL</span>
            <span className="text-zinc-400 text-xs font-mono truncate max-w-48">
              {provider.base_url}
            </span>
          </div>
        )}

        {/* API key env vars */}
        {provider.api_key_envs.length > 0 && (
          <div>
            <span className="text-zinc-500 text-xs">API Key Env Vars</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {provider.api_key_envs.map((env) => (
                <span
                  key={env}
                  className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono"
                >
                  {env}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rate limit */}
        {provider.rate_limit && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Rate Limit</span>
            <span className="text-zinc-400 text-xs">
              {provider.rate_limit.requests_per_minute} req/min
            </span>
          </div>
        )}

        {/* Models section */}
        <ModelSection
          provider={provider}
          liveModels={liveModels}
          modelsLoading={modelsLoading}
        />
      </div>
    </div>
  );
}

function ModelSection({
  provider,
  liveModels,
  modelsLoading,
}: {
  provider: ProviderConfig;
  liveModels: ModelEntry[];
  modelsLoading: boolean;
}) {
  const hasLiveModels = liveModels.length > 0;
  const configModels = provider.models || [];

  // Show loading state
  if (modelsLoading && !hasLiveModels && configModels.length === 0) {
    return (
      <div className="mt-2">
        <span className="text-zinc-500 text-xs">Models</span>
        <div className="text-zinc-600 text-xs mt-1">Loading...</div>
      </div>
    );
  }

  // Show live-discovered models with metadata
  if (hasLiveModels) {
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">Models</span>
          <span className="text-[10px] text-emerald-500">live</span>
        </div>
        <div className="space-y-1.5 mt-1">
          {liveModels.map((model) => (
            <LiveModelBadge key={model.id} model={model} />
          ))}
        </div>
      </div>
    );
  }

  // Fallback: show config models (static)
  if (configModels.length > 0) {
    return (
      <div className="mt-2">
        <span className="text-zinc-500 text-xs">Models</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {configModels.map((model) => (
            <span
              key={model}
              className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-mono"
            >
              {model}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // No models at all
  if (provider.enabled) {
    return (
      <div className="mt-2">
        <span className="text-zinc-500 text-xs">Models</span>
        <div className="text-zinc-600 text-xs mt-1">
          No models discovered
        </div>
      </div>
    );
  }

  return null;
}

function LiveModelBadge({ model }: { model: ModelEntry }) {
  // Strip "provider:" prefix to show just the model name
  const modelName = model.id.includes(":")
    ? model.id.split(":").slice(1).join(":")
    : model.id;

  const hasMetadata =
    model.context_window ||
    model.max_tokens ||
    model.reasoning ||
    (model.input_types && model.input_types.length > 1) ||
    model.cost;

  return (
    <div>
      <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-mono">
        {modelName}
      </span>
      {hasMetadata && (
        <div className="flex flex-wrap gap-1 mt-0.5 ml-1">
          {model.context_window && (
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
              {formatTokenCount(model.context_window)} ctx
            </span>
          )}
          {model.max_tokens && (
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
              {formatTokenCount(model.max_tokens)} out
            </span>
          )}
          {model.reasoning && (
            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
              reasoning
            </span>
          )}
          {model.input_types && model.input_types.length > 1 && (
            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded">
              {model.input_types.join("+")}
            </span>
          )}
          {model.cost && (
            <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
              ${model.cost.input}/${model.cost.output}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
