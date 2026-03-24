"use client";

export function getServerUrl() {
  // In dev, users may open the web UI from another device on the LAN.
  // If NEXT_PUBLIC_SERVER_URL is set, use it. Otherwise infer from current hostname.
  const env = process.env.NEXT_PUBLIC_SERVER_URL;
  if (env && env.length > 0) return env;
  if (typeof window === "undefined") return "http://localhost:3001";
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}
