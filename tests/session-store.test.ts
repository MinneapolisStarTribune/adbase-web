import { expect, it } from "vitest";
import { createMemorySessionStore } from "@/server/auth/session-store";
it("isolates sessions, rejects forged tokens and supports revocation", () => {
  const store = createMemorySessionStore();
  const a = store.create({ subjectId: "a" }),
    b = store.create({ subjectId: "b" });
  expect(store.resolve(a)?.subjectId).toBe("a");
  expect(store.resolve(b)?.subjectId).toBe("b");
  expect(store.resolve("forged")).toBeNull();
  store.revoke(a);
  expect(store.resolve(a)).toBeNull();
  expect(store.resolve(b)?.subjectId).toBe("b");
});
it("enforces both idle and absolute expiry", () => {
  let time = 0;
  const store = createMemorySessionStore(() => time, 10, 25);
  const expired = store.create({ subjectId: "a" });
  time = 10;
  expect(store.resolve(expired)).toBeNull();
  const active = store.create({ subjectId: "b" });
  time = 19;
  expect(store.resolve(active)).not.toBeNull();
  time = 28;
  expect(store.resolve(active)).not.toBeNull();
  time = 35;
  expect(store.resolve(active)).toBeNull();
});
