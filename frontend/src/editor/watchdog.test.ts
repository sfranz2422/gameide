/**
 * The game watchdog's patience (gameHost.ts, watchdog). An endless loop in Python is
 * still interrupted at HANG_MS, at its line; a worker that doesn't answer the
 * interrupt is busy outside Python (a Chromebook handing a big game's pictures to
 * the graphics chip), and is given KILL_MS before it's stopped — at 1.5 s, Stack
 * Shack and Zoomtown Cup were killed on Chromebooks with nothing looping.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../python/pyodideSource", () => ({ pyodideURLs: () => [] }));

describe("the watchdog", () => {
  it("interrupts at HANG_MS, then waits long for a busy worker before stopping it", async () => {
    const { watchdog, HANG_MS, KILL_MS, NO_INTERRUPT_KILL_MS } = await import("./gameHost");
    expect(watchdog(1000 + HANG_MS - 1, 1000, 0, true)).toBe("fine");
    expect(watchdog(1000 + HANG_MS, 1000, 0, true)).toBe("interrupt");
    const at = 1000 + HANG_MS;
    expect(watchdog(at + 5000, 1000, at, true)).toBe("wait");
    expect(KILL_MS).toBeGreaterThanOrEqual(10_000);
    expect(watchdog(at + KILL_MS + 1, 1000, at, true)).toBe("kill");
    // No shared memory: counting starts at HANG_MS, and a stuck game stops a few seconds later.
    expect(watchdog(at + 3000, 1000, at, false)).toBe("wait");
    expect(watchdog(at + NO_INTERRUPT_KILL_MS + 1, 1000, at, false)).toBe("kill");
    // Held for a question: never stopped, however long the page is busy.
    expect(watchdog(1000 + 60_000, 1000, 0, true, true)).toBe("fine");
    expect(watchdog(at + KILL_MS + 1, 1000, at, true, true)).toBe("fine");
  });
});
