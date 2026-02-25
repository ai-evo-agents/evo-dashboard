"use client";
import { useState, useCallback } from "react";
import { useMemories } from "@/hooks/use-memories";
import { api } from "@/lib/api";
import type { Memory, MemoryDetail, MemoryTier } from "@/lib/types";

const SCOPE_COLORS: Record<string, string> = {
  system: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  agent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pipeline: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  skill: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const CATEGORY_COLORS: Record<string, string> = {
  case: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  pattern: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  fact: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  preference: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  resource: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  event: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  general: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

function Badge({
  label,
  colorClass,
}: {
  label: string;
  colorClass: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium uppercase ${colorClass}`}
    >
      {label}
    </span>
  );
}

export default function MemoriesPage() {
  const [scopeFilter, setScopeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Memory[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<MemoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const { memories, stats, loading, refresh } = useMemories({
    scope: scopeFilter || undefined,
    category: categoryFilter || undefined,
    limit: 100,
  });

  const displayMemories = searchResults ?? memories;

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await api.searchMemories({
        query: searchQuery,
        scope: scopeFilter || undefined,
        category: categoryFilter || undefined,
        limit: 50,
      });
      setSearchResults(res.memories);
    } catch {
      // keep stale
    } finally {
      setSearching(false);
    }
  }, [searchQuery, scopeFilter, categoryFilter]);

  const handleExpand = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedDetail(null);
        return;
      }
      setExpandedId(id);
      setDetailLoading(true);
      try {
        const detail = await api.memoryDetail(id);
        setExpandedDetail(detail);
      } catch {
        setExpandedDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [expandedId]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this memory?")) return;
      try {
        await api.deleteMemory(id);
        if (expandedId === id) {
          setExpandedId(null);
          setExpandedDetail(null);
        }
        setSearchResults(null);
        refresh();
      } catch {
        // ignore
      }
    },
    [expandedId, refresh]
  );

  const totalMemories = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Memories</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Agent learning store — L0/L1/L2 progressive disclosure
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          + New Memory
        </button>
      </div>

      {/* Stats badges */}
      <div className="flex flex-wrap gap-2">
        <StatBadge
          label="all"
          count={totalMemories}
          active={!scopeFilter}
          onClick={() => { setScopeFilter(""); setSearchResults(null); }}
        />
        {Object.entries(stats).map(([scope, count]) => (
          <StatBadge
            key={scope}
            label={scope}
            count={count}
            active={scopeFilter === scope}
            onClick={() => { setScopeFilter(scopeFilter === scope ? "" : scope); setSearchResults(null); }}
          />
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search memory content..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value) setSearchResults(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <select
          value={scopeFilter}
          onChange={(e) => { setScopeFilter(e.target.value); setSearchResults(null); }}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500"
        >
          <option value="">All scopes</option>
          <option value="system">system</option>
          <option value="agent">agent</option>
          <option value="pipeline">pipeline</option>
          <option value="skill">skill</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setSearchResults(null); }}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500"
        >
          <option value="">All categories</option>
          <option value="case">case</option>
          <option value="pattern">pattern</option>
          <option value="fact">fact</option>
          <option value="preference">preference</option>
          <option value="resource">resource</option>
          <option value="event">event</option>
        </select>
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm transition-colors disabled:opacity-50"
        >
          {searching ? "..." : "Search"}
        </button>
        {searchResults !== null && (
          <button
            onClick={() => { setSearchResults(null); setSearchQuery(""); }}
            className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Memory list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-sm">Loading...</div>
        ) : displayMemories.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-zinc-500 text-sm">No memories found</div>
            <div className="text-zinc-600 text-xs mt-1">
              Pipeline runs auto-extract memories. Use + New Memory to add manually.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {displayMemories.map((memory) => (
              <MemoryRow
                key={memory.id}
                memory={memory}
                expanded={expandedId === memory.id}
                detail={expandedId === memory.id ? expandedDetail : null}
                detailLoading={expandedId === memory.id && detailLoading}
                onExpand={() => handleExpand(memory.id)}
                onDelete={() => handleDelete(memory.id)}
                onRefresh={refresh}
              />
            ))}
          </div>
        )}
      </div>

      {searchResults !== null && (
        <p className="text-xs text-zinc-600">
          {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
        </p>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateMemoryModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Stat Badge ──────────────────────────────────────────────────────────────

function StatBadge({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-zinc-700 text-zinc-100 border-zinc-600"
          : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-zinc-300"
      }`}
    >
      {label}: {count}
    </button>
  );
}

// ─── Memory Row ──────────────────────────────────────────────────────────────

function MemoryRow({
  memory,
  expanded,
  detail,
  detailLoading,
  onExpand,
  onDelete,
  onRefresh,
}: {
  memory: Memory;
  expanded: boolean;
  detail: MemoryDetail | null;
  detailLoading: boolean;
  onExpand: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [activeTier, setActiveTier] = useState<string>("l0");
  const [editing, setEditing] = useState(false);

  return (
    <div className={`${expanded ? "bg-zinc-800/30" : ""}`}>
      {/* Row header */}
      <button
        onClick={onExpand}
        className="w-full px-4 py-3 flex items-center gap-3 text-sm text-left hover:bg-zinc-800/30 transition-colors"
      >
        <span className="text-zinc-600 text-xs w-4">{expanded ? "▼" : "▶"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              label={memory.scope}
              colorClass={SCOPE_COLORS[memory.scope] || SCOPE_COLORS.system}
            />
            <Badge
              label={memory.category}
              colorClass={CATEGORY_COLORS[memory.category] || CATEGORY_COLORS.general}
            />
            <span className="text-zinc-300 font-mono text-xs truncate max-w-xs">
              {memory.key}
            </span>
          </div>
          {memory.agent_id && (
            <div className="text-zinc-600 text-xs mt-0.5 font-mono">
              {memory.agent_id}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0 text-xs text-zinc-500">
          <span title="Relevance score">
            ★ {memory.relevance_score.toFixed(2)}
          </span>
          <span title="Access count">
            ↗ {memory.access_count}
          </span>
          {memory.tags.length > 0 && (
            <span className="text-zinc-600">
              {memory.tags.slice(0, 2).join(", ")}
              {memory.tags.length > 2 ? ` +${memory.tags.length - 2}` : ""}
            </span>
          )}
          <span className="text-zinc-600">
            {new Date(memory.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              if (!expanded) onExpand();
            }}
            className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
          >
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="px-2 py-1 rounded bg-zinc-800 text-red-500/70 hover:text-red-400 text-xs transition-colors"
          >
            Del
          </button>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/50">
          {detailLoading ? (
            <div className="py-4 text-center text-zinc-500 text-xs">Loading detail...</div>
          ) : detail ? (
            <>
              {/* Tier tabs */}
              {detail.tiers && detail.tiers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-1 pt-2">
                    {detail.tiers.map((t) => (
                      <button
                        key={t.tier}
                        onClick={() => setActiveTier(t.tier)}
                        className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
                          activeTier === t.tier
                            ? "bg-zinc-700 text-zinc-100"
                            : "text-zinc-500 hover:text-zinc-300 bg-zinc-800"
                        }`}
                      >
                        {t.tier.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {detail.tiers
                    .filter((t) => t.tier === activeTier)
                    .map((t) => (
                      <TierContent key={t.id} tier={t} />
                    ))}
                </div>
              )}

              {/* Metadata */}
              {Object.keys(detail.metadata).length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Metadata
                  </div>
                  <pre className="bg-zinc-900 rounded p-2 text-xs text-zinc-400 font-mono overflow-auto max-h-32">
                    {JSON.stringify(detail.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Tags */}
              {detail.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {detail.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Bound tasks */}
              {detail.task_ids && detail.task_ids.length > 0 && (
                <div className="text-xs text-zinc-600">
                  Bound tasks:{" "}
                  {detail.task_ids.map((id) => (
                    <span key={id} className="font-mono bg-zinc-800 rounded px-1 ml-1">
                      {id.slice(0, 8)}
                    </span>
                  ))}
                </div>
              )}

              {/* Edit form */}
              {editing && (
                <EditMemoryForm
                  memory={detail}
                  onCancel={() => setEditing(false)}
                  onSaved={() => { setEditing(false); onRefresh(); }}
                />
              )}
            </>
          ) : (
            <div className="py-4 text-center text-zinc-600 text-xs">
              Failed to load detail
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tier Content ────────────────────────────────────────────────────────────

function TierContent({ tier }: { tier: MemoryTier }) {
  const isJson = tier.content.trim().startsWith("{") || tier.content.trim().startsWith("[");
  return (
    <pre
      className={`bg-zinc-900 rounded p-3 text-xs font-mono overflow-auto max-h-64 ${
        tier.tier === "l0" ? "text-zinc-300" : "text-zinc-400"
      }`}
    >
      {isJson && tier.tier !== "l0"
        ? (() => { try { return JSON.stringify(JSON.parse(tier.content), null, 2); } catch { return tier.content; } })()
        : tier.content || <span className="text-zinc-600">empty</span>}
    </pre>
  );
}

// ─── Edit Memory Form ────────────────────────────────────────────────────────

function EditMemoryForm({
  memory,
  onCancel,
  onSaved,
}: {
  memory: MemoryDetail;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [tags, setTags] = useState(memory.tags.join(", "));
  const [score, setScore] = useState(String(memory.relevance_score));
  const [tiers, setTiers] = useState<Record<string, string>>(
    Object.fromEntries(memory.tiers.map((t) => [t.tier, t.content]))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateMemory(memory.id, {
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        relevance_score: parseFloat(score) || 0,
        tiers: Object.entries(tiers).map(([tier, content]) => ({ tier, content })),
      });
      onSaved();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-zinc-700 pt-3">
      <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Edit Memory</div>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-zinc-500">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div className="w-32 space-y-1">
          <label className="text-xs text-zinc-500">Relevance score</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>
      {Object.entries(tiers).map(([tier, content]) => (
        <div key={tier} className="space-y-1">
          <label className="text-xs text-zinc-500 font-mono">{tier.toUpperCase()} content</label>
          <textarea
            rows={tier === "l2" ? 6 : 3}
            value={content}
            onChange={(e) => setTiers((prev) => ({ ...prev, [tier]: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 resize-y"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Create Memory Modal ─────────────────────────────────────────────────────

function CreateMemoryModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [scope, setScope] = useState("system");
  const [category, setCategory] = useState("fact");
  const [key, setKey] = useState("memory://system/");
  const [tags, setTags] = useState("");
  const [score, setScore] = useState("0.5");
  const [l0, setL0] = useState("");
  const [l1, setL1] = useState("");
  const [l2, setL2] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      const tiers = [];
      if (l0) tiers.push({ tier: "l0", content: l0 });
      if (l1) tiers.push({ tier: "l1", content: l1 });
      if (l2) tiers.push({ tier: "l2", content: l2 });

      await api.createMemory({
        scope,
        category,
        key: key.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        relevance_score: parseFloat(score) || 0.5,
        tiers,
      });
      onCreated();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">New Memory</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-zinc-500">Scope</label>
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setKey(`memory://${e.target.value}/`);
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
              >
                <option value="system">system</option>
                <option value="agent">agent</option>
                <option value="pipeline">pipeline</option>
                <option value="skill">skill</option>
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-zinc-500">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
              >
                <option value="case">case</option>
                <option value="pattern">pattern</option>
                <option value="fact">fact</option>
                <option value="preference">preference</option>
                <option value="resource">resource</option>
                <option value="event">event</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Key (memory://scope/path)</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-zinc-500">Tags (comma-separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div className="w-28 space-y-1">
              <label className="text-xs text-zinc-500">Relevance (0–1)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">L0 — Abstract (1 line)</label>
            <textarea
              rows={2}
              value={l0}
              onChange={(e) => setL0(e.target.value)}
              placeholder="One-line summary of this memory"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">L1 — Overview (~2k tokens)</label>
            <textarea
              rows={3}
              value={l1}
              onChange={(e) => setL1(e.target.value)}
              placeholder="Medium detail overview"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 resize-y"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">L2 — Full content</label>
            <textarea
              rows={4}
              value={l2}
              onChange={(e) => setL2(e.target.value)}
              placeholder="Full detail / raw data"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 resize-y"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !key.trim()}
            className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Memory"}
          </button>
        </div>
      </div>
    </div>
  );
}
