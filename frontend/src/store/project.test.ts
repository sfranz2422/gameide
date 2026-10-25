import { describe, expect, it } from "vitest";
import { blankProject, deleteResource, nameProblem, newEvent, newObject, quotedUses, replaceQuoted, wouldLoop, type Project } from "./project";

function withObjects(...names: string[]): Project {
  const p = blankProject("t");
  for (const n of names) p.objects.push({ ...newObject(n), id: n });
  return p;
}

describe("names", () => {
  it("objects must be Python names, unique ignoring case, and not GameIDE's own", () => {
    const p = withObjects("Coin");
    expect(nameProblem(p, "objects", "Player")).toBeNull();
    expect(nameProblem(p, "objects", "coin")).toMatch(/already one called "Coin"/);
    expect(nameProblem(p, "objects", "2fast")).toMatch(/letters, digits/);
    expect(nameProblem(p, "objects", "class")).toMatch(/Python word/);
    expect(nameProblem(p, "objects", "GameObject")).toMatch(/already used by GameIDE/);
    expect(nameProblem(p, "objects", "Coin", "Coin")).toBeNull(); // renaming to itself
  });
});

describe("deleting", () => {
  it("an object takes its room instances, collision events aimed at it, and children's parent link", () => {
    const p = withObjects("Coin", "Player", "Gem");
    p.objects[2]!.parent = "Coin";
    p.objects[1]!.events.push(newEvent({ type: "collision", object: "Coin" }), newEvent({ type: "step" }));
    p.rooms[0]!.instances.push({ id: "a", object: "Coin", x: 0, y: 0 }, { id: "b", object: "Player", x: 0, y: 0 });
    const effects = deleteResource(p, "objects", "Coin");
    expect(p.objects.map((o) => o.id)).toEqual(["Player", "Gem"]);
    expect(p.rooms[0]!.instances.map((i) => i.id)).toEqual(["b"]);
    expect(p.objects[0]!.events.map((e) => e.key.type)).toEqual(["step"]);
    expect(p.objects[1]!.parent).toBeNull();
    expect(effects).toEqual(["1 instance in Room1", "Player's collision event with it", "Gem's parent"]);
  });
});

describe("parents", () => {
  it("refuses a parent that would make a loop", () => {
    const p = withObjects("A", "B", "C");
    p.objects[1]!.parent = "A"; // B → A
    p.objects[2]!.parent = "B"; // C → B → A
    expect(wouldLoop(p, "A", "C")).toBe(true);
    expect(wouldLoop(p, "A", "A")).toBe(true);
    expect(wouldLoop(p, "C", "A")).toBe(false);
  });
});

describe("renaming references in code", () => {
  it("finds and replaces the name in quotes only", () => {
    const p = withObjects("Coin", "Player");
    const ev = { ...newEvent({ type: "step" }), code: `if place_meeting(x, y, "Coin") or instance_exists('Coin'):\n    Coin = "Coins"\n` };
    p.objects[1]!.events.push(ev);
    expect(quotedUses(p, "Coin")).toEqual([{ where: "Player → Step", count: 2 }]);
    replaceQuoted(p, "Coin", "Gem");
    expect(p.objects[1]!.events[0]!.code).toBe(`if place_meeting(x, y, "Gem") or instance_exists('Gem'):\n    Coin = "Coins"\n`);
  });
});
