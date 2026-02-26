"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import type { ModelEntry } from "@/lib/types";

export function useModels() {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.gatewayModels();
      setModels(data.data || []);
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Group models by provider for dropdown optgroups
  const byProvider = useMemo(
    () =>
      models.reduce<Record<string, ModelEntry[]>>((acc, m) => {
        const provider = m.provider || m.owned_by || "unknown";
        (acc[provider] ||= []).push(m);
        return acc;
      }, {}),
    [models]
  );

  return { models, byProvider, loading, refresh };
}
