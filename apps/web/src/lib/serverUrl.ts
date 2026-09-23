"use client";

export function getServerUrl() {
  // In dev, users may open the web UI from another device on the LAN.
  // If NEXT_PUBLIC_SERVER_URL is set, use it. Otherwise infer from current hostname.
  const env = process.env.NEXT_PUBLIC_SERVER_URL;
  if (env && env.length > 0) return env;
  // Funnel terminates HTTPS and reverse-proxies the web app and Socket.IO
  // backend on the same public origin. Internal LAN/Tailscale users keep the
  // existing direct-to-server path below.
  if (typeof window !== "undefined" && window.location.hostname.endsWith(".ts.net") && (window.location.protocol === "https:" || window.location.port === "8080")) {
    return window.location.origin;
  }
  const port = process.env.NEXT_PUBLIC_SERVER_PORT ?? "3001";
  if (typeof window === "undefined") return `http://localhost:${port}`;
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}
