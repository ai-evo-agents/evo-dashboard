"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { PipelineRow } from "@/lib/types";

export function usePipeline() {
  const [runs, setRuns] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.pipelineRuns();
      setRuns(data.runs);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  const startRun = useCallback(async () => {
    const res = await api.pipelineStart();
    if (res.success) {
      await refresh();
    }
    return res;
  }, [refresh]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);

    const socket = getSocket();
    const handler = (data: { event: string }) => {
      if (
        data.event === "pipeline:next" ||
        data.event === "pipeline:stage_result"
      ) {
        refresh();
      }
    };
    socket.on("dashboard:event", handler);

    return () => {
      clearInterval(interval);
      socket.off("dashboard:event", handler);
    };
  }, [refresh]);

  return { runs, loading, refresh, startRun };
}
