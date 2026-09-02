import { all, one, run } from "../db/index.js";
import { ids } from "../core/ids.js";
import { bus } from "../core/events.js";
import { notFound } from "../core/errors.js";

export interface Message {
  id: string;
  channel: string;
  taskId: string | null;
  authorKind: "ceo" | "staff" | "system";
  authorId: string | null;
  authorName?: string | null;
  body: string;
  directive: string;
  createdAt: number;
}

const SELECT = `
  SELECT m.id, m.channel, m.task_id AS taskId, m.author_kind AS authorKind, m.author_id AS authorId,
         s.display_name AS authorName, m.body, m.directive, m.created_at AS createdAt
  FROM messages m LEFT JOIN staff s ON s.id = m.author_id`;

export function listMessages(channel = "lobby", limit = 200): Message[] {
  return all<Message>(
    `${SELECT} WHERE m.channel = ? ORDER BY m.created_at DESC LIMIT ?`,
    channel,
    limit,
  ).reverse();
}

export function listTaskMessages(taskId: string): Message[] {
  return all<Message>(`${SELECT} WHERE m.task_id = ? ORDER BY m.created_at`, taskId);
}

export function getMessage(id: string): Message {
  const row = one<Message>(`${SELECT} WHERE m.id = ?`, id);
  if (!row) throw notFound("message");
  return row;
}

export function postMessage(input: {
  channel?: string;
  taskId?: string | null;
  authorKind?: "ceo" | "staff" | "system";
  authorId?: string | null;
  body: string;
  directive?: string;
}): Message {
  const id = ids.message();
  const channel = input.channel ?? "lobby";
  run(
    `INSERT INTO messages (id, channel, task_id, author_kind, author_id, body, directive)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    channel,
    input.taskId ?? null,
    input.authorKind ?? "staff",
    input.authorId ?? null,
    input.body,
    input.directive ?? "",
  );
  bus.publish({ type: "message.created", messageId: id, channel });
  return getMessage(id);
}

export function listChannels(): Array<{ channel: string; messages: number; lastAt: number }> {
  return all(
    `SELECT channel, COUNT(*) AS messages, MAX(created_at) AS lastAt
     FROM messages GROUP BY channel ORDER BY lastAt DESC`,
  );
}
