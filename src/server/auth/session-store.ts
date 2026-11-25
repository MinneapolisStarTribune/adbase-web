import { randomBytes, createHash } from "node:crypto";
import type { Actor } from "@/modules/forecasting/domain/models";
type Session = { actor: Actor; issued: number; lastSeen: number };
export interface SessionStore {
  create(actor: Actor): string;
  resolve(token: string): Actor | null;
  revoke(token: string): void;
}
export function createMemorySessionStore(
  now = Date.now,
  idleMs = 30 * 60_000,
  absoluteMs = 8 * 60 * 60_000,
): SessionStore {
  const records = new Map<string, Session>();
  const key = (token: string) =>
    createHash("sha256").update(token).digest("hex");
  return {
    create(actor) {
      const time = now();
      for (const [id, entry] of records)
        if (
          time - entry.lastSeen >= idleMs ||
          time - entry.issued >= absoluteMs
        )
          records.delete(id);
      const token = randomBytes(32).toString("base64url");
      records.set(key(token), { actor, issued: time, lastSeen: time });
      return token;
    },
    resolve(token) {
      const entry = records.get(key(token)),
        time = now();
      if (!entry) return null;
      if (
        time - entry.lastSeen >= idleMs ||
        time - entry.issued >= absoluteMs
      ) {
        records.delete(key(token));
        return null;
      }
      entry.lastSeen = time;
      return { ...entry.actor };
    },
    revoke(token) {
      records.delete(key(token));
    },
  };
}
