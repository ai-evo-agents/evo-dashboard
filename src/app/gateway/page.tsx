"use client";
import { useState, useEffect } from "react";
import { useGatewayConfig } from "@/hooks/use-gateway-config";
import { api } from "@/lib/api";
import type { ConfigHistoryEntry, ProviderConfig } from "@/lib/types";

export default function GatewayPage() {
  const { config, loading, saving, save } = useGatewayConfig();
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gateway</h1>
        {config?.server && (
          <span className="text-sm text-zinc-500">
            {config.server.host}:{config.server.port}
          </span>
        )}
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
            <div className="p-4 text-zinc-500 text-sm">No changes recorded</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {history.slice(0, 20).map((h) => (
                <div key={h.id} className="px-4 py-3 flex items-center gap-4 text-sm">
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
  onToggle,
  saving,
}: {
  provider: ProviderConfig;
  onToggle: () => void;
  saving: boolean;
}) {
  const typeLabels: Record<string, string> = {
    open_ai_compatible: "OpenAI Compatible",
    anthropic: "Anthropic",
    cursor: "Cursor CLI",
    claude_code: "Claude Code",
    codex_cli: "Codex CLI",
  };

  return (
    <div
      className={`bg-zinc-900 border rounded-lg p-4 ${
        provider.enabled ? "border-emerald-500/20" : "border-zinc-800"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{provider.name}</h3>
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
        <div className="flex justify-between">
          <span className="text-zinc-500">Type</span>
          <span className="text-zinc-300">
            {typeLabels[provider.provider_type] || provider.provider_type}
          </span>
        </div>
        {provider.base_url && (
          <div className="flex justify-between">
            <span className="text-zinc-500">URL</span>
            <span className="text-zinc-400 text-xs font-mono truncate max-w-48">
              {provider.base_url}
            </span>
          </div>
        )}
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
        {provider.rate_limit && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Rate Limit</span>
            <span className="text-zinc-400 text-xs">
              {provider.rate_limit.requests_per_minute} req/min
            </span>
          </div>
        )}
        {provider.models && provider.models.length > 0 && (
          <div className="mt-2">
            <span className="text-zinc-500 text-xs">Models</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {provider.models.map((model) => (
                <span
                  key={model}
                  className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-mono"
                >
                  {model}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
