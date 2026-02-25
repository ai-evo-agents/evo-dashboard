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
    const handler = (data: { action: string; task?: Task }) => {
      // On any task change, update current task + refresh history
      if (data.task) {
        setCurrentTask((prev) => {
          // If the changed task is the current one, update it
          if (prev && prev.id === data.task!.id) return data.task!;
          // If the changed task is running, it's the new current
          if (data.task!.status === "running") return data.task!;
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
