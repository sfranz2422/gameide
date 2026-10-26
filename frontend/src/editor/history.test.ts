import { describe, expect, it } from "vitest";
import { blankProject, newEvent, newObject, type Project } from "../store/project";
import { GROUP_MS, History, keepCode } from "./history";

function at(name: string): Project {
  const p = blankProject("t");
  p.name = name;
  return p;
}

describe("undo history", () => {
  it("each change is a step; changes with the same label close together are one", () => {
    const h = new History();
    h.record(at("a"), { label: "width" }, 0);
    h.record(at("b"), { label: "width" }, 300); // typing more of the same number
    h.record(at("c"), { label: "width" }, 300 + GROUP_MS + 1); // later: a new step
    h.record(at("d"), { label: "sprite" }, 300 + GROUP_MS + 2); // something else: a new step
    expect(h.past.map((s) => s.project.name)).toEqual(["a", "c", "d"]);
  });

  it("changes with no label are never merged", () => {
    const h = new History();
    h.record(at("a"), {}, 0);
    h.record(at("b"), {}, 10);
    expect(h.past.map((s) => s.project.name)).toEqual(["a", "b"]);
  });

  it("a group is one step however long it takes, until it is ended", () => {
    const h = new History();
    h.record(at("a"), { group: "stroke1" }, 0);
    h.record(at("b"), { group: "stroke1" }, 60_000);
    h.endGroup();
    h.record(at("c"), { group: "stroke1" }, 60_001);
    expect(h.past.map((s) => s.project.name)).toEqual(["a", "c"]);
  });

  it("undo goes back, redo comes forward, and a new change clears redo", () => {
    const h = new History();
    h.record(at("v1"), {}, 0);
    expect(h.undo(at("v2"))?.name).toBe("v1");
    expect(h.redo(at("v1"))?.name).toBe("v2");
    h.undo(at("v2"));
    h.record(at("v1"), { label: "other" }, 5000);
    expect(h.redo(at("x"))).toBeNull();
  });

  it("never changes code: what was typed since stays", () => {
    const before = blankProject("t");
    const o = { ...newObject("Player"), events: [{ ...newEvent({ type: "step" }), code: "old code" }] };
    before.objects.push(o);
    before.scripts.push({ id: "s", name: "helpers", code: "old script" });
    const now = structuredClone(before);
    now.objects[0]!.sprite = "x"; // the change being undone
    now.objects[0]!.events[0]!.code = "typed since";
    now.scripts[0]!.code = "script typed since";
    const back = keepCode(before, now);
    expect(back.objects[0]!.sprite).toBeNull();
    expect(back.objects[0]!.events[0]!.code).toBe("typed since");
    expect(back.scripts[0]!.code).toBe("script typed since");
  });

  it("never changes blocks either, or whether an event is blocks", () => {
    const before = blankProject("t");
    const python = { ...newEvent({ type: "step" }), id: "p", code: "" };
    const blocks = { ...newEvent({ type: "create" }), id: "b", mode: "blocks" as const, code: "self.x = 1", blocks: { variables: [] } };
    before.objects.push({ ...newObject("Player"), events: [python, blocks] });
    const now = structuredClone(before);
    now.objects[0]!.sprite = "x";
    Object.assign(now.objects[0]!.events[0]!, { mode: "blocks", code: "self.y = 2", blocks: { variables: [1] } }); // Python event became blocks
    Object.assign(now.objects[0]!.events[1]!, { mode: "python", code: "converted" }); // and blocks converted to Python
    delete now.objects[0]!.events[1]!.blocks;
    const back = keepCode(before, now);
    expect(back.objects[0]!.sprite).toBeNull();
    expect(back.objects[0]!.events).toEqual(now.objects[0]!.events);
  });

  it("…in scripts and creation code too", () => {
    const before = blankProject("t");
    before.scripts.push({ id: "s", name: "helpers", code: "" });
    before.rooms[0]!.instances.push({ id: "i", object: "o", layer: "l", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "self.x = 1", mode: "blocks", blocks: {} });
    const now = structuredClone(before);
    now.name = "renamed"; // the change being undone
    Object.assign(now.scripts[0]!, { mode: "blocks", code: "def f():\n    pass", blocks: { variables: [] } });
    Object.assign(now.rooms[0]!.instances[0]!, { mode: "python", code: "converted" });
    delete now.rooms[0]!.instances[0]!.blocks;
    const back = keepCode(before, now);
    expect(back.name).toBe("t");
    expect(back.scripts).toEqual(now.scripts);
    expect(back.rooms[0]!.instances).toEqual(now.rooms[0]!.instances);
  });
});
