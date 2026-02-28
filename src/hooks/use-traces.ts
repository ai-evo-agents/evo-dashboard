"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Trace, Span } from "@/lib/types";

export interface TraceFilters {
  service?: string;
  status?: number;
  minDurationMs?: number;
}

export function useTraces(filters: TraceFilters = {}) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const refresh = useCallback(async () => {
    try {
      const res = await api.traces({
        service: filters.service || undefined,
        status: filters.status,
        min_duration_ms: filters.minDurationMs,
        limit,
        offset,
      });
      setTraces(res.traces);
      setCount(res.count);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, [filters.service, filters.status, filters.minDurationMs, offset]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { traces, count, loading, refresh, offset, setOffset, limit };
}

export function useTraceDetail(traceId: string | null) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!traceId) {
      setTrace(null);
      setSpans([]);
      return;
    }
    setLoading(true);
    api
      .traceDetail(traceId)
      .then((res) => {
        setTrace(res.trace);
        setSpans(res.spans);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [traceId]);

  return { trace, spans, loading };
}
