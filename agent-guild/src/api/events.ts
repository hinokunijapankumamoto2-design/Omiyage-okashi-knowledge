export interface GuildEnvelope {
  id: number;
  at: number;
  event: { type: string } & Record<string, unknown>;
}

type Listener = (envelope: GuildEnvelope) => void;

/**
 * Reconnecting event socket. It remembers the last id it saw and asks the
 * server to replay anything missed, so a dropped connection does not require a
 * full page refresh.
 */
export class EventStream {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private lastEventId = 0;
  private retry = 0;
  private closed = false;

  connect(): void {
    if (this.closed) return;
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${location.host}/events`);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.retry = 0;
      if (this.lastEventId) socket.send(JSON.stringify({ type: "resume", lastEventId: this.lastEventId }));
    });
    socket.addEventListener("message", (message) => {
      try {
        const envelope = JSON.parse(message.data) as GuildEnvelope;
        if (typeof envelope.id === "number" && envelope.id > this.lastEventId) this.lastEventId = envelope.id;
        for (const listener of this.listeners) listener(envelope);
      } catch {
        // ignore malformed frames
      }
    });
    const reconnect = () => {
      if (this.closed) return;
      this.retry = Math.min(this.retry + 1, 6);
      setTimeout(() => this.connect(), 400 * 2 ** this.retry);
    };
    socket.addEventListener("close", reconnect);
    socket.addEventListener("error", () => socket.close());
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.closed = true;
    this.socket?.close();
  }
}

export const stream = new EventStream();
