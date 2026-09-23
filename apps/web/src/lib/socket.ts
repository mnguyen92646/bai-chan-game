"use client";

import { io, type Socket } from "socket.io-client";
import { getServerUrl } from "@/lib/serverUrl";
import { EdgeSocket } from "@/lib/edgeSocket";

let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;
  const url = getServerUrl();
  if (process.env.NEXT_PUBLIC_TABLE_TRANSPORT === "worker") {
    socket = new EdgeSocket(url) as unknown as Socket;
    return socket;
  }
  socket = io(url, {
    // Allow websocket or polling; some mobile/LAN setups block websocket.
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 50,
    reconnectionDelayMax: 2000
  });
  return socket;
}
