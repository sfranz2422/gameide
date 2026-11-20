/**
 * The checks with no names in them (2026-11-20), for lessons where students choose
 * their own names, pictures and keys. The project ones on a project; "holding a key
 * moves something" played in node's Pyodide, against a player on keys the lesson
 * never mentions and traffic that moves whatever you press.
 */
import { describe, expect, it } from "vitest";
import { checkGame, checkProject, readCheck } from "./checks";
import { blankProject, newEvent, newInstance, newObject, newRoom, type Project } from "../store/project";
import { nodeRunner } from "../tutorials/nodeRunner";

function game(withPlayer: boolean, playerCode = 'if keyboard_check_pressed("w"):\n    self.y -= 32\nif keyboard_check_pressed("d"):\n    self.x += 32\n'): Project {
  const p = blankProject("T");
  const car = newObject("Truck");
  const go = newEvent({ type: "create" });
  go.code = "self.hspeed = 2\n";
  car.events.push(go);
  p.objects.push(car);
  const room = p.rooms[0] ?? newRoom("Room1");      // a blank game has its Room1 already
  room.instances.push(newInstance(room, car.id, 40, 100), newInstance(room, car.id, 300, 140));     // two of one: things, not kinds
  if (withPlayer) {
    // Called Frog, on W and D: names and keys the lesson never gives.
    const frog = newObject("Frog");
    const step = newEvent({ type: "step" });
    step.code = playerCode;
    frog.events.push(step);
    const bump = newEvent({ type: "collision", object: car.id } as never);
    frog.events.push(bump);
    p.objects.push(frog);
    room.instances.push(newInstance(room, frog.id, 200, 300));
  }
  if (!p.rooms.includes(room)) p.rooms.push(room);
  return p;
}

describe("checks with no names in them", () => {
  it("read as what they say, and an unreadable one stays unknown", () => {
    expect(readCheck("some object has a sprite")).toEqual({ kind: "any-sprites", n: 1 });
    expect(readCheck("at least 3 objects have sprites")).toEqual({ kind: "any-sprites", n: 3 });
    expect(readCheck("at least 2 objects exist")).toEqual({ kind: "objects", n: 2 });
    expect(readCheck("some object has event collision")).toEqual({ kind: "any-event", event: "collision" });
    expect(readCheck("some object has an event draw gui")).toEqual({ kind: "any-event", event: "draw gui" });
    expect(readCheck("room Room1 has at least 6 things")).toEqual({ kind: "things", room: "Room1", n: 6 });
    expect(readCheck("holding a key moves something")).toEqual({ kind: "key-moves" });
    // Still the named ones as before.
    expect(readCheck("Player has sprite").kind).toBe("has-sprite");
    expect(readCheck("room Room1 has at least 6 Car").kind).toBe("count");
    expect(readCheck("holding a key moves everything").kind).toBe("unknown");
  });

  it("of the project: whatever the student called things", () => {
    const p = game(true);
    const run = (line: string) => checkProject(p, readCheck(line));
    expect(run("at least 2 objects exist")?.ok).toBe(true);
    expect(run("at least 3 objects exist")).toEqual({ ok: false, detail: "Your game has 2 objects, not 3 yet." });
    expect(run("some object has a sprite")).toEqual({ ok: false, detail: "None of your objects has a sprite yet." });
    p.sprites.push({ id: "s1", name: "frogpic", frames: [] } as never);
    p.objects[1]!.sprite = "s1";
    expect(run("some object has a sprite")?.ok).toBe(true);
    expect(run("at least 2 objects have sprites")).toEqual({ ok: false, detail: "1 of your objects has a sprite, not 2 yet." });
    expect(run("some object has event collision")?.ok).toBe(true);
    expect(run("some object has event step")?.ok).toBe(true);
    expect(run("some object has event draw gui")?.ok).toBe(false);
    expect(run("room Room1 has at least 3 things")?.ok).toBe(true);
    expect(run("room Room1 has at least 4 things")?.ok).toBe(false);
    expect(checkProject(game(false), readCheck("some object has event collision"))?.ok).toBe(false);
    expect(run("holding a key moves something")).toBeNull();
  });

  it("holding a key moves something: the student's own keys pass; traffic alone doesn't", { timeout: 120_000 }, async () => {
    const frog = game(true);
    expect(await checkGame(nodeRunner(() => frog), readCheck("holding a key moves something"))).toEqual({ ok: true, detail: "" });
    const cars = game(false);
    const none = await checkGame(nodeRunner(() => cars), readCheck("holding a key moves something"));
    expect(none.ok).toBe(false);
    expect(none.detail).toContain("didn't move anything");
    // Keys read, but nothing they do: no.
    const deaf = game(true, 'if keyboard_check("q"):\n    self.x += 4\n');
    expect((await checkGame(nodeRunner(() => deaf), readCheck("holding a key moves something"))).ok).toBe(false);
  });

  it("some object's EVENT uses a word: that kind of event in any object", () => {
    const p = game(true);
    const frog = p.objects[1]!;
    frog.events.find((e) => e.key.type === "collision")!.code = "global_vars.lives -= 1\n";
    const run = (line: string) => checkProject(p, readCheck(line));
    expect(readCheck("some object's collision uses lives")).toEqual({ kind: "any-uses", event: "collision", word: "lives" });
    expect(run("some object's collision uses lives")?.ok).toBe(true);
    expect(run("some object's collision uses score")).toEqual({ ok: false, detail: "No collision event uses score yet." });
    expect(run("some object's step uses keyboard_check_pressed")?.ok).toBe(true);
    expect(run("some object's step uses lives")?.ok).toBe(false);
    expect(run("some object's draw gui uses score")).toEqual({ ok: false, detail: "None of your objects has a draw gui event yet." });
  });

  it("how things move: speeds and directions, whatever they're called", { timeout: 120_000 }, async () => {
    const road = (code: string) => {
      const p = game(false);
      p.objects[0]!.events[0]!.code = code;
      const room = p.rooms[0]!;
      for (const y of [160, 200, 240, 280]) room.instances.push(newInstance(room, p.objects[0]!.id, 100, y));
      return p;
    };
    const lanes = road("lane = self.y // 40\nself.hspeed = 1 + lane % 3\nif lane % 2 == 0:\n    self.hspeed = -self.hspeed\n");
    expect(await checkGame(nodeRunner(() => lanes), readCheck("things move at 3 or more speeds"))).toEqual({ ok: true, detail: "" });
    expect(await checkGame(nodeRunner(() => lanes), readCheck("some things move left and some move right"))).toEqual({ ok: true, detail: "" });
    const same = road("self.hspeed = 2\n");
    expect((await checkGame(nodeRunner(() => same), readCheck("things move at 3 or more speeds"))).detail).toBe("What moves goes at 1 speed, not 3 or more yet.");
    expect((await checkGame(nodeRunner(() => same), readCheck("some things move left and some move right"))).detail).toBe("Everything moving goes the same way (right).");
  });
});
