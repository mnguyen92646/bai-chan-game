"use client";

type Handler = (data?: never) => void;
type Acknowledgement = (error: Error | null, reply?: unknown) => void;

/** Small client for the Cloudflare room protocol. Local previews keep Socket.IO. */
export class EdgeSocket {
  connected = false;
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Handler>>();
  private pending = new Map<number, { callback: Acknowledgement; timer: ReturnType<typeof setTimeout> }>();
  private nextId = 1;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private wanted = false;

  constructor(private serverUrl: string) {}

  on(event: string, handler: Handler): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return this;
  }

  off(event: string, handler: Handler): this {
    this.listeners.get(event)?.delete(handler);
    return this;
  }

  private notify(event: string, data?: unknown): void {
    for (const handler of this.listeners.get(event) ?? []) handler(data as never);
  }

  connect(): this {
    this.wanted = true;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return this;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const roomId = window.location.pathname.match(/^\/room\/([^/]+)/)?.[1];
    if (!roomId) { this.notify("connect_error"); return this; }
    const url = new URL(this.serverUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `/rooms/${encodeURIComponent(roomId)}/ws`;
    url.search = "";
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.connected = true;
      this.reconnectAttempts = 0;
      this.notify("connect");
    };
    ws.onmessage = event => {
      if (this.ws !== ws) return;
      try {
        const message = JSON.parse(String(event.data)) as { event?: string; data?: unknown; ack?: number };
        if (typeof message.ack === "number") {
          const pending = this.pending.get(message.ack);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(message.ack);
            pending.callback(null, message.data);
          }
        } else if (message.event) this.notify(message.event, message.data);
      } catch { /* ignore an invalid server frame */ }
    };
    ws.onerror = () => { if (this.ws === ws) this.notify("connect_error"); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.connected = false;
      this.notify("disconnect");
      for (const { callback, timer } of this.pending.values()) {
        clearTimeout(timer);
        callback(new Error("Connection closed"));
      }
      this.pending.clear();
      if (this.wanted && this.reconnectAttempts++ < 50) {
        this.reconnectTimer = setTimeout(() => this.connect(), Math.min(2000, 250 * 2 ** Math.min(3, this.reconnectAttempts)));
      }
    };
    return this;
  }

  disconnect(): this {
    this.wanted = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close(1000, "Leaving table");
    this.ws = null;
    this.connected = false;
    return this;
  }

  timeout(milliseconds: number): { emit: (event: string, data: unknown, callback: Acknowledgement) => void } {
    return {
      emit: (event, data, callback) => {
        if (!this.connected || !this.ws) { callback(new Error("Not connected")); return; }
        const id = this.nextId++;
        const timer = setTimeout(() => {
          this.pending.delete(id);
          callback(new Error("Timed out"));
        }, milliseconds);
        this.pending.set(id, { callback, timer });
        this.ws.send(JSON.stringify({ id, event, data }));
      },
    };
  }
}
