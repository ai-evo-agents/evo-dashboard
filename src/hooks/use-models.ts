"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { ModelEntry } from "@/lib/types";

export function useModels() {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.gatewayModels();
      setModels(data.data || []);
      setLastRefresh(new Date());
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      const data = await api.reloadGatewayModels();
      if (data.error) {
        return { success: false, error: data.error };
      }
      setModels(data.data || []);
      setLastRefresh(new Date());
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    } finally {
      setReloading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Auto-refresh when gateway config changes (emitted globally, not via dashboard:event)
    const socket = getSocket();
    const handler = () => {
      // Debounce: wait 1s for gateway to process new config before re-fetching models
      setTimeout(refresh, 1000);
    };
    socket.on("king:config_update", handler);

    return () => {
      socket.off("king:config_update", handler);
    };
  }, [refresh]);

  // Group models by provider for per-card display
  const byProvider = useMemo(
    () =>
      models.reduce<Record<string, ModelEntry[]>>((acc, m) => {
        const provider = m.provider || m.owned_by || "unknown";
        (acc[provider] ||= []).push(m);
        return acc;
      }, {}),
    [models]
  );

  return { models, byProvider, loading, refreshing, reloading, refresh, reload, lastRefresh };
}
