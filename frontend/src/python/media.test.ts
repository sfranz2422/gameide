/**
 * Phase 9a in the real Pyodide: sounds (what Python asks the page to play,
 * and sound_playing worked out from each sound's length), gamepads, save
 * files and fonts — plus the starter sounds and the checks on uploaded files.
 */
import { describe, expect, it } from "vitest";
import type { SoundOrder } from "../engine/game";
import { DEAD_ZONE, readPads, type PadState } from "../engine/input";
import { PAD_AXES, PAD_BUTTONS } from "../engine/layout";
import { sniffType } from "../store/assetTypes";
import { assetIds, blankProject, migrate, newFont, newSound } from "../store/project";
import { STARTER_SOUNDS, wav } from "../store/starterSounds";
import { buildGame } from "./codegen";
import { py, run } from "./testkit";
import { PythonGame } from "./bridge";

/** A game whose one object runs `step` every step (and `create` once), with sounds and fonts. */
async function game(opts: { create?: string; step?: string; sounds?: { name: string; duration: number }[]; fonts?: string[]; save?: Record<string, unknown>; stepsPerSecond?: number }) {
  const sounds: SoundOrder[][] = [];
  const saves: Record<string, unknown>[] = [];
  const body = (code = "pass") => code.split("\n").map((l) => `        ${l}`).join("\n");
  const { game, error } = await PythonGame.load(
    {
      sprites: [],
      objects: [{ name: "Thing" }],
      rooms: [{ name: "R", width: 100, height: 100, instances: [{ object: "Thing", x: 0, y: 0 }] }],
      code: { Thing: `class Thing(GameObject):\n    def on_create(self):\n${body(opts.create)}\n    def on_step(self):\n${body(opts.step)}\n` },
      sounds: opts.sounds ?? [],
      fonts: (opts.fonts ?? []).map((name) => ({ name })),
      ...(opts.save ? { save: opts.save } : {}),
      stepsPerSecond: opts.stepsPerSecond ?? 60,
    },
    { sounds: (o) => sounds.push(o), save: (d) => saves.push(d) },
  );
  return { game, error, sounds, saves };
}

describe("sounds", () => {
  it("sound_play, sound_stop and music go out to the page as orders, in the frame they were made", async () => {
    const g = await game({
      create: 'sound_play("coin")\nsound_play("coin", loop=True, volume=0.5)\nmusic_play("theme")',
      step: 'if self.x == 1:\n    sound_stop("coin")\n    music_stop()\nself.x += 1',
      sounds: [{ name: "coin", duration: 0.5 }, { name: "theme", duration: 30 }],
    });
    expect(g.error).toBeNull();
    run(g.game, 2);
    expect(g.sounds.flat()).toEqual([
      ["play", "coin", 0, 1],
      ["play", "coin", 1, 0.5],
      ["music", "theme", 1, 1],
      ["stop", "coin"],
      ["music_stop"],
    ]);
    g.game.dispose();
  });

  it("sound_playing is worked out from each sound's length — no answer needed from the page", async () => {
    // 0.5 s at 10 steps a second: playing for 5 steps.
    const g = await game({ create: 'sound_play("coin")', sounds: [{ name: "coin", duration: 0.5 }], stepsPerSecond: 10 });
    run(g.game, 3);
    expect(py(g.game, 'sound_playing("coin")')).toBe(true);
    run(g.game, 3);
    expect(py(g.game, 'sound_playing("coin")')).toBe(false);
    // Looping: until stopped.
    py(g.game, 'sound_play("coin", loop=True)');
    run(g.game, 20);
    expect(py(g.game, 'sound_playing("coin")')).toBe(true);
    py(g.game, 'sound_stop()');
    expect(py(g.game, 'sound_playing("coin")')).toBe(false);
    g.game.dispose();
  });

  it("music is one at a time, and the game starting again stops everything", async () => {
    const g = await game({ sounds: [{ name: "a", duration: 9 }, { name: "b", duration: 9 }] });
    py(g.game, 'music_play("a")\nmusic_play("b")');
    expect(py(g.game, '[sound_playing("a"), sound_playing("b")]')).toEqual([false, true]);
    py(g.game, "game_restart()");
    run(g.game, 1);
    expect(g.sounds.flat()).toContainEqual(["stop_all"]);
    expect(g.sounds.flat()).toContainEqual(["music_stop"]);
    expect(py(g.game, 'sound_playing("b")')).toBe(false);
    g.game.dispose();
  });

  it("a sound that isn't in the Sounds folder, or a volume out of range, is a clear error", async () => {
    const g = await game({ sounds: [{ name: "coin", duration: 1 }] });
    expect(() => py(g.game, 'sound_play("coyn")')).toThrow(/There is no sound called 'coyn'. Sounds: coin/);
    expect(() => py(g.game, 'sound_play("coin", volume=2)')).toThrow(/from 0 \(silent\) to 1/);
    g.game.dispose();
  });
});

describe("gamepads", () => {
  const pad = (buttons: string[], axes: number[] = [0, 0, 0, 0], connected = true): PadState => ({
    connected,
    buttons: PAD_BUTTONS.map((b) => buttons.includes(b)),
    axes,
  });

  it("buttons are held, pressed and released per step; sticks and connection read as they are", async () => {
    const g = await game({});
    const input = g.game.engine.input;
    input.pads([pad(["a"], [0.5, -1, 0, 0])]);
    run(g.game, 1);
    expect(py(g.game, '[gamepad_check("a"), gamepad_check_pressed("a"), gamepad_axis("left_x"), gamepad_axis("left_y"), gamepad_connected(), gamepad_connected(1)]')).toEqual([
      true, true, 0.5, -1, true, false,
    ]);
    run(g.game, 1);
    expect(py(g.game, '[gamepad_check("a"), gamepad_check_pressed("a")]')).toEqual([true, false]);
    input.pads([pad([])]);
    run(g.game, 1);
    expect(py(g.game, '[gamepad_check("a"), gamepad_check_released("a")]')).toEqual([false, true]);
    // A tap between two steps still shows as pressed for one step.
    input.pads([pad(["start"])]);
    input.pads([pad([])]);
    run(g.game, 1);
    expect(py(g.game, 'gamepad_check_pressed("start")')).toBe(true);
    // The second pad is pad 1.
    input.pads([pad([]), pad(["b"])]);
    run(g.game, 1);
    expect(py(g.game, '[gamepad_check("b"), gamepad_check("b", 1)]')).toEqual([false, true]);
    expect(() => py(g.game, 'gamepad_check("triangle")')).toThrow(/no gamepad button called 'triangle'/);
    g.game.dispose();
  });

  it("the browser's pads are read with a dead zone, in the standard mapping's order", () => {
    const fake = {
      connected: true,
      buttons: PAD_BUTTONS.map((_, i) => ({ pressed: i === 9, value: i === 6 ? 0.8 : 0 })), // start, and a squeezed trigger
      axes: [DEAD_ZONE / 2, 0.9, -1.5, 0],
    } as unknown as Gamepad;
    const [p0, p1] = readPads([fake, null]);
    expect(p0!.buttons.map((b, i) => (b ? PAD_BUTTONS[i] : null)).filter(Boolean)).toEqual(["lt", "start"]);
    expect(p0!.axes).toEqual([0, 0.9, -1, 0]);
    expect(p1!.connected).toBe(false);
    expect(PAD_AXES).toHaveLength(4);
  });
});

describe("save files", () => {
  it("keep values between plays: handed in at the start, sent out (whole) when they change", async () => {
    const g = await game({ save: { best: 7 }, create: 'self.best = save_get("best", 0)\nsave_set("best", 12)\nsave_set("names", ["ann", "bo"])' });
    expect(g.error).toBeNull();
    expect(py(g.game, "instances('Thing')[0].best")).toBe(7);
    expect(g.saves.at(-1)).toEqual({ best: 12, names: ["ann", "bo"] });
    const sent = g.saves.length;
    run(g.game, 3); // nothing changed: nothing sent
    expect(g.saves.length).toBe(sent);
    py(g.game, 'save_delete("names")');
    run(g.game, 1);
    expect(g.saves.at(-1)).toEqual({ best: 12 });
    g.game.dispose();
  });

  it("are copies: changing a list after saving it doesn't change the save", async () => {
    const g = await game({});
    expect(py(g.game, 'xs = [1]\nsave_set("xs", xs)\nxs.append(2)\nsave_get("xs")')).toEqual([1]);
    expect(py(g.game, 'save_get("missing", "default")')).toBe("default");
    expect(() => py(g.game, 'save_set("me", instances("Thing")[0])')).toThrow(/numbers, text, True\/False, None and lists or dicts/);
    expect(() => py(g.game, 'save_set("big", "x" * 1_100_000)')).toThrow(/about 1 MB/);
    g.game.dispose();
  });
});

describe("fonts", () => {
  it("draw_set_font picks a font from the Fonts folder (by its place in the list) and a size for draw_text", async () => {
    const { game: gd, error } = await PythonGame.load({
      sprites: [],
      objects: [{ name: "Hud" }],
      rooms: [{ name: "R", width: 100, height: 100, instances: [{ object: "Hud", x: 0, y: 0 }] }],
      code: { Hud: 'class Hud(GameObject):\n    def on_draw_gui(self):\n        draw_text(0, 0, "a")\n        draw_set_font("title", 32)\n        draw_text(0, 20, "b")\n        draw_set_font()\n        draw_text(0, 40, "c")\n' },
      fonts: [{ name: "pixel" }, { name: "title" }],
    });
    expect(error).toBeNull();
    run(gd, 1);
    expect(gd.engine.guiList.map((c) => c.slice(4))).toEqual([
      ["a", 0xffffff, -1, 16],
      ["b", 0xffffff, 1, 32],
      ["c", 0xffffff, -1, 16],
    ]);
    expect(() => py(gd, 'draw_set_font("comic")')).toThrow(/no font called 'comic'. Fonts: pixel, title/);
    gd.dispose();
  });
});

describe("starter sounds and files", () => {
  it("starter sounds are real WAV files, each a fraction of a second", () => {
    for (const s of STARTER_SOUNDS) {
      const samples = s.make();
      const bytes = wav(samples);
      expect(sniffType(bytes), s.key).toBe("audio/wav");
      expect(new DataView(bytes.buffer).getUint32(40, true)).toBe(samples.length * 2);
      expect(samples.length / 22050).toBeGreaterThan(0.1);
      expect(samples.length / 22050).toBeLessThan(1);
      expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(1);
    }
  });

  it("files are known by their first bytes, not their names", () => {
    const b = (...xs: (number | string)[]) => new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));
    expect(sniffType(b("ID3", 4, 0))).toBe("audio/mpeg");
    expect(sniffType(b(0xff, 0xfb, 0x90))).toBe("audio/mpeg");
    expect(sniffType(b("OggS", 0))).toBe("audio/ogg");
    expect(sniffType(b("OTTO"))).toBe("font/otf");
    expect(sniffType(b(0, 1, 0, 0))).toBe("font/ttf");
    expect(sniffType(b("wOF2"))).toBe("font/woff2");
    expect(sniffType(b(0x89, "PNG", 13, 10, 26, 10))).toBe("image/png");
    expect(sniffType(b("hello"))).toBeNull();
  });
});

describe("in the project", () => {
  it("sounds and fonts go into the built game, with their files; an older project gets empty folders", async () => {
    const p = blankProject("t");
    const blob = new Blob([wav(STARTER_SOUNDS[0]!.make()) as BlobPart], { type: "audio/wav" });
    p.sounds.push({ ...newSound("coin"), asset: "a1", volume: 0.5 }, newSound("silent"));
    p.fonts.push({ ...newFont("pixel"), asset: "f1" }, newFont("plain"));
    // Their files are part of the project: saved, loaded and exported with it.
    expect(assetIds(p)).toEqual(["a1", "f1"]);
    p.fonts.pop();
    p.fonts[0]!.asset = null;
    const { def } = buildGame(p, new Map([["a1", blob]]));
    expect(def.sounds).toEqual([{ name: "coin", volume: 0.5, sound: blob }, { name: "silent", volume: 1 }]);
    expect(def.fonts).toEqual([{ name: "pixel" }]);
    const old = migrate({ ...structuredClone({ ...p, sounds: undefined, fonts: undefined }), schemaVersion: 7 });
    expect([old.sounds, old.fonts]).toEqual([[], []]);
  });
});

describe("names in quotes", () => {
  it("a room, sprite or sound used without quotes gets a hint saying how to write it", async () => {
    const run1 = async (code: string) => {
      const { game: g, error } = await PythonGame.load({
        sprites: [{ name: "hero", width: 8, height: 8, originX: 0, originY: 0, frameCount: 1 }],
        objects: [{ name: "Thing" }],
        rooms: [
          { name: "Level1", width: 100, height: 100, instances: [{ object: "Thing", x: 0, y: 0 }] },
          { name: "Level2", width: 100, height: 100, instances: [] },
        ],
        code: { Thing: `class Thing(GameObject):\n    def on_step(self):\n        ${code}\n` },
        sounds: [{ name: "jump", duration: 1 }],
      });
      expect(error).toBeNull();
      const e = g.step();
      g.dispose();
      return e?.message ?? "";
    };
    if (process.env["SHOW"]) console.log(await run1("room_goto(Level2)"));
    expect(await run1("room_goto(Level2)")).toContain('Level2 is a room. A room is named in quotes, as text: "Level2" — for example room_goto("Level2").');
    expect(await run1("self.sprite = hero")).toContain('self.sprite = "hero"');
    expect(await run1("sound_play(jump)")).toContain('sound_play("jump")');
    // A name that isn't any of them: Python's own message, nothing added.
    expect(await run1("room_goto(Level9)")).not.toContain("quotes");
  });
});
