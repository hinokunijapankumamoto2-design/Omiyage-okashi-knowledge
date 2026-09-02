import { EventEmitter } from "node:events";

/** Every realtime event pushed to browsers and to internal subscribers. */
export type GuildEvent =
  | { type: "staff.updated"; staffId: string }
  | { type: "staff.status"; staffId: string; status: string; taskId: string | null }
  | { type: "department.updated" }
  | { type: "project.updated"; projectId: string }
  | { type: "task.created"; taskId: string }
  | { type: "task.updated"; taskId: string; stage: string }
  | { type: "task.log"; taskId: string; stream: "stdout" | "stderr" | "system"; chunk: string }
  | { type: "task.finished"; taskId: string; outcome: "done" | "failed" | "cancelled" }
  | { type: "meeting.updated"; meetingId: string; taskId: string | null }
  | { type: "message.created"; messageId: string; channel: string }
  | { type: "skill.updated"; staffId: string | null }
  | { type: "settings.updated" }
  | { type: "notice"; level: "info" | "warn" | "error"; text: string };

export interface EnvelopedEvent {
  id: number;
  at: number;
  event: GuildEvent;
}

class EventBus {
  private readonly emitter = new EventEmitter();
  private seq = 0;
  private readonly recent: EnvelopedEvent[] = [];
  private readonly recentLimit = 200;

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(event: GuildEvent): EnvelopedEvent {
    const enveloped: EnvelopedEvent = { id: ++this.seq, at: Date.now(), event };
    this.recent.push(enveloped);
    if (this.recent.length > this.recentLimit) this.recent.shift();
    this.emitter.emit("event", enveloped);
    return enveloped;
  }

  subscribe(listener: (enveloped: EnvelopedEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  /** Replay buffer so a reconnecting client can catch up without a full refetch. */
  since(id: number): EnvelopedEvent[] {
    return this.recent.filter((entry) => entry.id > id);
  }
}

export const bus = new EventBus();
