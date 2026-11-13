/**
 * The checks that read a sprite's pictures (drawing lessons): every frame
 * drawn on, every frame different. Pictures are handed in as bytes, as a
 * browser would decode them.
 */
import { describe, expect, it } from "vitest";
import { blankProject, newId } from "../store/project";
import { checkPictures, checkProject, readCheck, type Decode } from "./checks";

/** A project with one 2 × 1 sprite "hero" whose frames are these pixels' alphas. */
function game(frames: number[][]) {
  const p = blankProject("t");
  const pics = new Map<string, Blob>();
  const bytes = new Map<Blob, Uint8ClampedArray>();
  const ids = frames.map((alphas) => {
    const id = newId();
    const b = new Blob([id]);
    const d = new Uint8ClampedArray(alphas.length * 4);
    alphas.forEach((a, i) => d.set([200, 0, 0, a], i * 4));
    bytes.set(b, d);
    pics.set(id, b);
    return id;
  });
  p.sprites.push({ id: newId(), name: "hero", width: 2, height: 1, originX: 0, originY: 0, frames: ids });
  const decode: Decode = async (b) => ({ data: bytes.get(b)!, width: 2, height: 1 });
  return { p, pics, decode };
}

const run = async (line: string, frames: number[][]) => {
  const { p, pics, decode } = game(frames);
  const c = readCheck(line);
  const quick = checkProject(p, c);
  if (quick) return quick;
  if (c.kind !== "drawn" && c.kind !== "frames-differ") throw new Error(`read as ${c.kind}`);
  return checkPictures(p, c, pics, decode);
};

describe("checks that read the pictures", () => {
  it("every frame drawn on: a faint pixel isn't a drawing, and the empty frame is named", async () => {
    expect(await run("sprite hero has a drawing on every frame", [[255, 0], [0, 255]])).toEqual({ ok: true, detail: "" });
    expect(await run("sprite hero has a drawing on every frame", [[255, 0], [0, 40]])).toEqual({ ok: false, detail: "Frame 1 of hero is still empty: draw something on it." });
    expect((await run("sprite villain has a drawing on every frame", [[255, 0]])).detail).toBe("There's no sprite called villain yet.");
  });

  it("frames all different: a copied frame not yet changed is named, and one frame isn't an animation", async () => {
    expect(await run("sprite hero's frames are all different", [[255, 0], [0, 255], [255, 255]])).toEqual({ ok: true, detail: "" });
    expect(await run("sprite hero's frames are all different", [[255, 0], [0, 255], [255, 0]])).toEqual({ ok: false, detail: "Frames 0 and 2 of hero are the same picture: change one a little." });
    expect((await run("sprite hero's frames are all different", [[255, 0]])).detail).toMatch(/only one frame/);
  });

  it("an object's sprite, any or a named one", () => {
    const { p } = game([[255, 0]]);
    p.objects.push({ ...p.objects[0]!, id: "o1", name: "Hero", sprite: p.sprites[0]!.id } as never);
    expect(checkProject(p, readCheck("Hero has sprite"))).toEqual({ ok: true, detail: "" });
    expect(checkProject(p, readCheck("Hero has sprite hero"))).toEqual({ ok: true, detail: "" });
    expect(checkProject(p, readCheck("Hero has sprite climber"))).toEqual({ ok: false, detail: "Hero's sprite is hero, not climber." });
  });

  it("reads both lines, with or without 'a'", () => {
    expect(readCheck("sprite hero has drawing on every frame").kind).toBe("drawn");
    expect(readCheck("Sprite Hero's frames are all different").kind).toBe("frames-differ");
  });
});
