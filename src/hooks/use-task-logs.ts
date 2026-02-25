"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { TaskLog } from "@/lib/types";

/** Fetches and streams real-time task log entries for a given task. */
export function useTaskLogs(taskId: string | null | undefined) {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const prevTaskId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api.taskLogs(taskId, 200);
      setLogs(data.logs);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    // Reset logs when task changes
    if (prevTaskId.current !== taskId) {
      setLogs([]);
      setLoading(true);
      prevTaskId.current = taskId ?? null;
    }
    refresh();
  }, [taskId, refresh]);

  useEffect(() => {
    if (!taskId) return;

    const socket = getSocket();
    const handler = (data: { task_id: string; log: TaskLog }) => {
      if (data.task_id === taskId && data.log) {
        setLogs((prev) => {
          // Avoid duplicates
          if (prev.some((l) => l.id === data.log.id)) return prev;
          return [...prev, data.log];
        });
      }
    };
    socket.on("task:log", handler);

    return () => {
      socket.off("task:log", handler);
    };
  }, [taskId]);

  const filteredLogs =
    levelFilter === "all"
      ? logs
      : logs.filter((l) => l.level === levelFilter);

  return { logs: filteredLogs, allLogs: logs, loading, levelFilter, setLevelFilter, refresh };
}
