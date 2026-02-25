import { io, Socket } from "socket.io-client";

const KING_URL = process.env.NEXT_PUBLIC_KING_URL || "";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(KING_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => {
      // Subscribe to dashboard events room
      socket!.emit("dashboard:subscribe", {});
    });
  }
  return socket;
}
