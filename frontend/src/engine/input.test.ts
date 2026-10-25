import { describe, expect, it } from "vitest";
import { G, G_SIZE, KEY_COUNT } from "./layout";
import { InputState, KEY_CODE } from "./input";

const keys = () => new Uint8Array(3 * KEY_COUNT);
const LEFT = KEY_CODE.get("left")!;

describe("InputState", () => {
  it("holds a key until it is released, and reports the press once", () => {
    const i = new InputState(), k = keys(), g = new Float64Array(G_SIZE);
    i.keyDown(LEFT);
    i.commit(k, g);
    expect([k[LEFT], k[KEY_COUNT + LEFT], k[2 * KEY_COUNT + LEFT]]).toEqual([1, 1, 0]);
    i.keyDown(LEFT); // auto-repeat: still not a new press
    i.commit(k, g);
    expect([k[LEFT], k[KEY_COUNT + LEFT]]).toEqual([1, 0]);
    i.keyUp(LEFT);
    i.commit(k, g);
    expect([k[LEFT], k[2 * KEY_COUNT + LEFT]]).toEqual([0, 1]);
  });

  it('sets "any" while any key is held', () => {
    const i = new InputState(), k = keys(), g = new Float64Array(G_SIZE);
    i.keyDown(KEY_CODE.get("q")!);
    i.commit(k, g);
    expect([k[0], k[KEY_COUNT]]).toEqual([1, 1]);
  });

  it("lets go of everything when the window loses focus", () => {
    const i = new InputState(), k = keys(), g = new Float64Array(G_SIZE);
    i.keyDown(LEFT);
    i.mouseDown(0);
    i.commit(k, g);
    i.releaseAll();
    i.commit(k, g);
    expect([k[LEFT], k[2 * KEY_COUNT + LEFT], g[G.MOUSE_DOWN], g[G.MOUSE_RELEASED]]).toEqual([0, 1, 0, 1]);
  });
});
