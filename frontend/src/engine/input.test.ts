import { describe, expect, it } from "vitest";
import { G, G_SIZE, KEY_COUNT } from "./layout";
import { InputState, KEY_CODE, WHEEL_STEP, attachInput } from "./input";

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

  it("the wheel's notches are counted for one step, then cleared", () => {
    const i = new InputState(), k = keys(), g = new Float64Array(G_SIZE);
    i.wheel(1);
    i.wheel(1);
    i.commit(k, g);
    expect(g[G.WHEEL]).toBe(2);
    i.commit(k, g);
    expect(g[G.WHEEL]).toBe(0);
  });
});

describe("the wheel on the page", () => {
  it("adds scrolling up into notches (a trackpad's little scrolls too), up positive, and doesn't scroll the page", () => {
    const on: Record<string, (e: unknown) => void> = {};
    const target = { addEventListener: (t: string, f: (e: unknown) => void) => (on[t] = f), removeEventListener: () => undefined };
    const g = globalThis as unknown as { window?: unknown };
    const had = g.window;
    g.window = { addEventListener: () => undefined, removeEventListener: () => undefined };
    try {
      const turned: number[] = [];
      const sink = { keyDown() {}, keyUp() {}, mouseDown() {}, mouseUp() {}, mouseMove() {}, releaseAll() {}, pads() {},
                     wheel: (n: number) => turned.push(n) };
      attachInput(sink, target as unknown as HTMLElement, () => true, () => ({ x: 0, y: 0 }));
      let stopped = 0;
      const scroll = (deltaY: number, deltaMode = 0) => on.wheel!({ deltaY, deltaMode, preventDefault: () => stopped++ });
      scroll(-2 * WHEEL_STEP);                 // a mouse wheel's click, up: two notches' worth
      for (let n = 0; n < 5; n++) scroll(WHEEL_STEP / 5);    // a trackpad: five little scrolls down make one
      scroll(1, 1);                            // one line (Firefox counts lines): not a notch yet
      expect(turned).toEqual([2, -1]);
      expect(stopped).toBe(7);
    } finally {
      g.window = had;
    }
  });
});

