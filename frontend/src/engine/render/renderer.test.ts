/**
 * Which renderer the game asks Pixi for. WebGL only: asked merely to prefer it,
 * Pixi fell back to WebGPU whenever its WebGL check failed, which Chrome on a Mac
 * sometimes did, and GameIDE's drawing broke there at once ("Cannot read
 * properties of undefined (reading 'location')", Mix Lab, 2026-11-16). With no
 * WebGL at all, the player is told in words a teacher can act on.
 */
import { describe, expect, it, vi } from "vitest";

const asked: Record<string, unknown>[] = [];
vi.mock("pixi.js", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Application: class {
    init(options: Record<string, unknown>) {
      asked.push(options);
      // What Pixi throws when nothing on its list will start.
      return Promise.reject(new Error("No available renderer for the current environment"));
    }
  },
}));

describe("the game's renderer", () => {
  it("is WebGL and nothing else, and says so in words when there's none", async () => {
    const { PixiRenderer } = await import("./pixiRenderer");
    const def = { sprites: [], rooms: [{ width: 320, height: 180, background: "#000000" }] };
    const engine = { camera: { w: 320, h: 180 } };
    await expect(PixiRenderer.create({} as OffscreenCanvas, def as never, engine as never)).rejects.toThrow(
      "This browser couldn't start the game's graphics (WebGL)",
    );
    expect(asked[0]!.preference).toEqual(["webgl"]);
  });
});
