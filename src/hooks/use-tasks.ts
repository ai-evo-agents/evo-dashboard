"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Task } from "@/lib/types";

/** Fetches the current (running or most recent) task + task history. */
export function useTasks() {
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [currentRes, historyRes] = await Promise.all([
        api.taskCurrent(),
        api.tasks({ limit: 20 }),
      ]);
      setCurrentTask(currentRes.task);
      setHistory(historyRes.tasks);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);

    const socket = getSocket();
    const handler = (data: { action: string; task?: Task; task_id?: string; task_ids?: string[] }) => {
      // Handle deleted action: remove from history, clear current task if needed
      if (data.action === "deleted") {
        const deletedIds = data.task_ids
          ? data.task_ids
          : data.task_id
          ? [data.task_id]
          : [];
        if (deletedIds.length > 0) {
          setHistory((prev) => prev.filter((t) => !deletedIds.includes(t.id)));
          setCurrentTask((prev) =>
            prev && deletedIds.includes(prev.id) ? null : prev
          );
        }
        return;
      }

      // On any task change, update current task + refresh history
      if (data.task) {
        setCurrentTask((prev) => {
          // If the changed task is the current one, update it
          if (prev && prev.id === data.task!.id) return data.task!;
          // If the changed task is running, recovering, or decomposed, treat as current
          if (
            data.task!.status === "running" ||
            data.task!.status === "recovering" ||
            data.task!.status === "decomposed"
          )
            return data.task!;
          return prev;
        });
      }
      // Refresh history in the background
      api.tasks({ limit: 20 }).then((res) => setHistory(res.tasks)).catch(() => {});
    };
    socket.on("task:changed", handler);

    return () => {
      clearInterval(interval);
      socket.off("task:changed", handler);
    };
  }, [refresh]);

  return { currentTask, history, loading, refresh };
}
