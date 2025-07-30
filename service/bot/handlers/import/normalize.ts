// service/bot/handlers/import/normalize.ts

import { config } from "$shared";
import { ChatData, ChatMessage } from "../../../../types.ts";

export interface NormalizedMessage {
  id: number;
  fromId: string;
  from: string;
  text: string;
  date: Date;
  threadId?: number;
  replyToMessageId?: number;
}

export interface MessageGroup {
  id: string;
  messages: NormalizedMessage[];
}
export interface Chunk {
  id: string;
  text: string;
  sourceMessageIds: number[];
}

export function parseJson(text: string): ChatData | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function normalizeMessages(raw: ChatMessage[]): NormalizedMessage[] {
  return raw
    .filter((m) =>
      m.type === "message" &&
      typeof m.text === "string" &&
      m.text.trim().length > 0
    )
    .map((m) => ({
      id: Number(m.id),
      fromId: m.from_id ?? "unknown",
      from: m.from ?? "анон",
      text: m.text.trim(),
      date: new Date(m.date),
      threadId: m.thread_id ? Number(m.thread_id) : undefined,
      replyToMessageId: m.reply_to_message_id
        ? Number(m.reply_to_message_id)
        : undefined,
    }));
}

// Использует параметры из config.data.chunking!
export function groupMessages(
  messages: NormalizedMessage[],
  maxGapMs: number = config.data.chunking.max_gap_ms,
): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let current: MessageGroup | null = null;
  for (const m of messages) {
    if (
      !current ||
      current.messages[current.messages.length - 1].fromId !== m.fromId ||
      (m.date.getTime() -
          current.messages[current.messages.length - 1].date.getTime()) >
        maxGapMs ||
      current.messages[0].threadId !== m.threadId
    ) {
      current = { id: `g_${groups.length}`, messages: [] };
      groups.push(current);
    }
    current.messages.push(m);
  }
  return groups;
}

export function createChunks(
  groups: MessageGroup[],
  maxTokens: number = config.data.chunking.max_tokens,
  overlap: number = config.data.chunking.overlap,
  minWords: number = config.data.chunking.min_words,
): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkId = 0;
  for (const group of groups) {
    const texts = group.messages.map((m) => m.text);
    let tokens: string[] = [];
    let ids: number[] = [];
    for (let i = 0; i < texts.length; i++) {
      const msgTokens = texts[i].split(/\s+/);
      tokens.push(...msgTokens);
      ids.push(group.messages[i].id);
      while (tokens.length >= maxTokens) {
        const chunkTokens = tokens.slice(0, maxTokens);
        const chunkIds = ids.slice(0, Math.min(ids.length, maxTokens));
        if (chunkTokens.length >= minWords) {
          chunks.push({
            id: `c_${chunkId++}`,
            text: chunkTokens.join(" "),
            sourceMessageIds: chunkIds,
          });
        }
        tokens = tokens.slice(maxTokens - overlap);
        ids = ids.slice(Math.max(0, ids.length - overlap));
      }
    }
    if (tokens.length >= minWords) {
      chunks.push({
        id: `c_${chunkId++}`,
        text: tokens.join(" "),
        sourceMessageIds: ids,
      });
    }
  }
  return chunks;
}
