"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import type { DashboardEvent } from "@/lib/types";

const MAX_EVENTS = 500;

export function useEvents() {
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const bufferRef = useRef<DashboardEvent[]>([]);

  const clear = useCallback(() => {
    bufferRef.current = [];
    setEvents([]);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handler = (data: { event: string; data: unknown }) => {
      const entry: DashboardEvent = {
        event: data.event,
        data: data.data,
        timestamp: new Date().toISOString(),
      };

      bufferRef.current = [entry, ...bufferRef.current].slice(0, MAX_EVENTS);
      setEvents([...bufferRef.current]);
    };

    socket.on("dashboard:event", handler);

    // Also capture task:changed events
    const taskHandler = (data: unknown) => {
      const entry: DashboardEvent = {
        event: "task:changed",
        data,
        timestamp: new Date().toISOString(),
      };
      bufferRef.current = [entry, ...bufferRef.current].slice(0, MAX_EVENTS);
      setEvents([...bufferRef.current]);
    };

    socket.on("task:changed", taskHandler);

    return () => {
      socket.off("dashboard:event", handler);
      socket.off("task:changed", taskHandler);
    };
  }, []);

  return { events, clear };
}
