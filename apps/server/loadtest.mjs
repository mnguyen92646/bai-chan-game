// Simple local load generator for Bai Chan server (HTTP + Socket.IO)
// Usage: node loadtest.mjs [seconds]

import { io } from 'socket.io-client';

const base = process.env.BAI_CHAN_SERVER_URL || 'http://localhost:3001';
const seconds = Number(process.argv[2] || process.env.DURATION_SECONDS || 120);
const concurrency = Number(process.env.CONCURRENCY || 20);
const sockets = Number(process.env.SOCKETS || 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpWorker(id, stopAt) {
  let n = 0;
  while (Date.now() < stopAt) {
    n++;
    // Mix of endpoints
    const pick = n % 3;
    try {
      if (pick === 0) {
        await fetch(`${base}/health`, { cache: 'no-store' });
      } else if (pick === 1) {
        await fetch(`${base}/room/default`, { cache: 'no-store' });
      } else {
        await fetch(`${base}/socket.io/?EIO=4&transport=polling&t=${Date.now()}-${id}-${n}`, { cache: 'no-store' });
      }
    } catch {
      // ignore
    }
    // Tiny jitter
    if (n % 10 === 0) await sleep(25);
  }
}

function socketClient(i, stopAt) {
  return new Promise((resolve) => {
    const s = io(base, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelayMax: 500,
    });

    const nickname = `bot-${i}-${Math.random().toString(16).slice(2, 6)}`;

    const interval = setInterval(() => {
      if (Date.now() >= stopAt) {
        clearInterval(interval);
        s.close();
        resolve();
      }
    }, 250);

    s.on('connect', async () => {
      // join default room; ignore callbacks
      try {
        s.emit('room:join', { roomId: '000000', nickname }, () => {});
      } catch {}

      // periodically poke a few events that exist in server (best-effort)
      const spam = setInterval(() => {
        if (Date.now() >= stopAt) {
          clearInterval(spam);
          return;
        }
        try {
          s.emit('room:ping', { t: Date.now() }, () => {});
        } catch {}
      }, 500);

      s.on('disconnect', () => clearInterval(spam));
    });

    s.on('connect_error', () => {
      // ignore
    });
  });
}

async function main() {
  const stopAt = Date.now() + seconds * 1000;
  console.log(`[loadtest] base=${base} seconds=${seconds} httpConcurrency=${concurrency} sockets=${sockets}`);

  const http = Array.from({ length: concurrency }, (_, i) => httpWorker(i + 1, stopAt));
  const sock = Array.from({ length: sockets }, (_, i) => socketClient(i + 1, stopAt));

  await Promise.all([...http, ...sock]);
  console.log('[loadtest] done');
}

main().catch((e) => {
  console.error('[loadtest] error', e);
  process.exit(1);
});
