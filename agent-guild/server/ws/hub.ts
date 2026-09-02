import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { bus } from "../core/events.js";
import { createLogger } from "../core/logger.js";

const log = createLogger("ws");

/**
 * One WebSocket endpoint carries every realtime update. Clients send
 * `{ type: "resume", lastEventId }` on reconnect and get the replay buffer.
 */
export function attachEventSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/events" });

  wss.on("connection", (socket: WebSocket) => {
    const unsubscribe = bus.subscribe((enveloped) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(enveloped));
    });

    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(String(raw));
        if (payload?.type === "resume" && Number.isFinite(payload.lastEventId)) {
          for (const missed of bus.since(Number(payload.lastEventId))) socket.send(JSON.stringify(missed));
        }
        if (payload?.type === "ping") socket.send(JSON.stringify({ type: "pong", at: Date.now() }));
      } catch {
        // Ignore malformed frames rather than dropping the connection.
      }
    });

    socket.on("close", unsubscribe);
    socket.on("error", (error) => log.warn("socket error", error.message));
    socket.send(JSON.stringify({ id: 0, at: Date.now(), event: { type: "notice", level: "info", text: "connected" } }));
  });

  // A heartbeat keeps proxies from silently dropping an idle office view.
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) if (client.readyState === client.OPEN) client.ping();
  }, 30_000);
  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}
