"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Memory, MemoryStats } from "@/lib/types";

export function useMemories(params?: {
  scope?: string;
  category?: string;
  agent_id?: string;
  limit?: number;
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<MemoryStats>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [memRes, statsRes] = await Promise.all([
        api.memories({ ...params, limit: params?.limit ?? 50 }),
        api.memoryStats(),
      ]);
      setMemories(memRes.memories);
      setStats(statsRes);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [params?.scope, params?.category, params?.agent_id, params?.limit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);

    const socket = getSocket();
    const handler = () => {
      refresh();
    };
    socket.on("memory:changed", handler);

    return () => {
      clearInterval(interval);
      socket.off("memory:changed", handler);
    };
  }, [refresh]);

  return { memories, stats, loading, refresh };
}
