/**
 * Points in a tutorial, read and rewritten (points.ts) for New assignment's "a
 * tutorial": every built-in comes back word for word when its points don't
 * change, and with new points, the server's own readers (checks.py, quiz.py,
 * counted as grades.py counts them) find exactly the total asked for.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pointItems, spread, sumPoints, withPoints } from "./points";

const DIR = resolve(__dirname, "../../public/tutorials");
const BUILTINS = readdirSync(DIR).filter((f) => f.endsWith(".md"));
const BACKEND = resolve(__dirname, "../../../backend");

const SAMPLE = [
  "# Step one",
  "```check",
  "object Player exists",
  "game runs 2 seconds without errors",
  "```",
  "",
  "````quiz",
  "What does this print?",
  "```py",
  "points: 7",
  "print(1)",
  "```",
  "answer: 1",
  "points: 2",
  "````",
  "---",
  "```check",
  "Player has event step (3 points)",
  "game runs 2 seconds without errors",
  "```",
].join("\n");

/** What the server would count: checks.py's tests (each label once) and quiz.py's questions (each id once). */
function serverPossible(md: string): number {
  const code = `
import sys, json
sys.path.insert(0, ${JSON.stringify(BACKEND)})
import checks, quiz
md = sys.stdin.read()
seen, total = set(), 0.0
for t in checks.tests(md) + checks.tests(md, "check"):
    if t["label"] not in seen:
        seen.add(t["label"])
        total += t["points"]
qs = {}
for q in quiz.keys(md):
    qs.setdefault(q["qid"], q)
total += sum(q["points"] for q in qs.values())
print(json.dumps(round(total, 2)))`;
  return JSON.parse(execFileSync("python3", ["-c", code], { input: md }).toString()) as number;
}

describe("a tutorial's points", () => {
  it("lists each check once (however many steps repeat it) and each question, with what it's worth", () => {
    expect(pointItems(SAMPLE)).toEqual([
      { kind: "check", label: "object Player exists", points: 1 },
      { kind: "check", label: "game runs 2 seconds without errors", points: 1 },
      { kind: "question", label: "What does this print?", points: 2 },
      { kind: "check", label: "Player has event step", points: 3 },
    ]);
  });

  it("rewrites only the points: a repeated check everywhere it's written, a question's line, never code inside a question", () => {
    const md = withPoints(SAMPLE, [1, 2, 1, 4]);
    expect(md).toContain("object Player exists\n");
    expect(md.match(/game runs 2 seconds without errors \(2 points\)/g)).toHaveLength(2);
    expect(md).toContain("Player has event step (4 points)");
    expect(md).toContain("points: 7\nprint(1)");          // inside the question's code: not a points line
    expect(md).not.toContain("points: 2");               // the question is worth 1 now: no line needed
    expect(pointItems(md).map((i) => i.points)).toEqual([1, 2, 1, 4]);
    expect(serverPossible(md)).toBe(8);
  });

  it("shares a total out in whole points while there are enough, in parts when there aren't", () => {
    expect(spread(20, 6)).toEqual([3, 3, 3, 3, 4, 4]);
    expect(sumPoints(spread(20, 6))).toBe(20);
    expect(spread(5, 8)).toEqual([0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.66]);
    expect(sumPoints(spread(5, 8))).toBe(5);
    expect(spread(10, 0)).toEqual([]);
  });

  it("every built-in comes back word for word with its own points", () => {
    for (const f of BUILTINS) {
      const md = readFileSync(resolve(DIR, f), "utf8");
      expect(withPoints(md, pointItems(md).map((i) => i.points)), f).toBe(md);
    }
  });

  it("every built-in, set to be worth 20, is worth exactly 20 to the server", () => {
    const totals: Record<string, number> = {};
    const want: Record<string, number> = {};
    for (const f of BUILTINS) {
      const md = readFileSync(resolve(DIR, f), "utf8");
      const n = pointItems(md).length;
      if (!n) continue;
      totals[f] = serverPossible(withPoints(md, spread(20, n)));
      want[f] = 20;
      // and as it ships, what the page says it's worth is what the server says
      expect(sumPoints(pointItems(md).map((i) => i.points)), f).toBe(serverPossible(md));
    }
    expect(totals).toEqual(want);
  }, 120_000);
});
