"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { GatewayConfig } from "@/lib/types";

export function useGatewayConfig() {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.gatewayConfig();
      setConfig(data);
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
  }, [refresh]);

  return { config, loading, saving, save, refresh };
}
