"use client";

import { io, type Socket } from "socket.io-client";
import { getServerUrl } from "@/lib/serverUrl";

let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;
  const url = getServerUrl();
  socket = io(url, {
    // Allow websocket or polling; some mobile/LAN setups block websocket.
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 50,
    reconnectionDelayMax: 2000
  });
  return socket;
}
