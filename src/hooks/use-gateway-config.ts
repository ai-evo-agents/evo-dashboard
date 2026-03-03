"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { GatewayConfig } from "@/lib/types";

export function useGatewayConfig() {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.gatewayConfig();
      // Only store if it's a valid config (not an error response)
      if (data && data.providers) {
        setConfig(data);
      }
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (updated: GatewayConfig) => {
      setSaving(true);
      try {
        const res = await api.updateGateway(updated);
        if (res.success) {
          setConfig(updated);
        }
        return res;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  useEffect(() => {
    refresh();

    // Auto-refresh when gateway config changes
    const socket = getSocket();
    const handler = () => {
      refresh();
    };
    socket.on("king:config_update", handler);

    return () => {
      socket.off("king:config_update", handler);
    };
  }, [refresh]);

  return { config, loading, saving, save, refresh };
}
