/**
 * Every showcase game reports to the school's board (high_score), each in its
 * own way. Played headless: what ends a level or a season runs for real, and
 * this reads what reached the board. A game not built here is skipped. Thornwood
 * and Greymire can't be built without their art, so this reads their patched
 * copies (showcase/patch_zip.py) if there are any.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

function builtAt(folder: string, patched?: string) {
  const dir = resolve(__dirname, "../../../showcase", folder, "out");
  const p = patched && resolve(dir, `${patched}-patched.json`);
  return p && existsSync(p) ? p : resolve(dir, "project.json");
}

async function start(file: string, save: Record<string, unknown> = {}, net?: { code: string; number: number; name: string; state: Record<string, unknown> }) {
  const project = JSON.parse(readFileSync(file, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  const scores: number[] = [];
  const { game, error } = await PythonGame.load({ ...def, save, ...(net ? { net } : {}) } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined, score: (n) => scores.push(n),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      const e = game.step();
      if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
    }
  };
  step(2);
  return { game, step, scores, project, py: (code: string) => game.evalPython(code) as never };
}

const on = (folder: string, patched?: string) => describe.runIf(existsSync(builtAt(folder, patched)));

on("towers")("Fort Bramble's board", () => {
  it("is lives and gold, each level's best added up", async () => {
    const g = await start(builtAt("towers"));
    expect(g.project.settings.scoreboard).toEqual({ unit: "points" });
    g.py('room_goto(LEVELS[0]["name"])');
    g.step(3);
    g.py("global_vars.lives = 5; global_vars.gold = 120; finish_level(global_vars.director, True)");
    g.step();
    expect(g.scores).toEqual([620]);
    g.py('room_goto(LEVELS[1]["name"])');
    g.step(3);
    g.py("global_vars.lives = 2; global_vars.gold = 10; finish_level(global_vars.director, True)");
    g.step();
    expect(g.scores).toEqual([620, 830]);
    g.py('room_goto(LEVELS[0]["name"])');
    g.step(3);
    g.py("global_vars.lives = 1; global_vars.gold = 0; finish_level(global_vars.director, True)");
    g.step();
    expect(g.scores).toEqual([620, 830]);
  }, 60_000);
  it("sends nothing for losing", async () => {
    const g = await start(builtAt("towers"));
    g.py('room_goto(LEVELS[0]["name"])');
    g.step(3);
    g.py("global_vars.lives = 0; finish_level(global_vars.director, False)");
    g.step();
    expect(g.scores).toEqual([]);
  }, 60_000);
});

on("hillclimb")("Ridgeline Rally's board", () => {
  it("is the best distance on each stage, added up", async () => {
    const g = await start(builtAt("hillclimb"));
    expect(g.project.settings.scoreboard).toEqual({ unit: "metres" });
    // keep_best reads the run for its ghost; the title's own demo run needs putting back.
    const best = (i: number, m: number) => {
      g.py(`_was = dict(RUN); RUN["car"] = type("C", (), {"kind": "jeep"})(); RUN["path"] = []; keep_best(STAGES[${i}]["name"], ${m}); RUN.clear(); RUN.update(_was)`);
      g.step();
    };
    best(0, 300);
    best(1, 50);
    best(0, 200);
    expect(g.scores).toEqual([300, 350]);
  }, 60_000);
});

on("baseball")("Moonshot's board", () => {
  it("is the most home runs in a Derby", async () => {
    const g = await start(builtAt("baseball"));
    expect(g.project.settings.scoreboard).toEqual({ unit: "home runs" });
    g.py('DERBY.update(homers=7, longest=400); derby_save()');
    g.step();
    g.py('DERBY.update(homers=3, longest=500); derby_save()');
    g.step();
    expect(g.scores).toEqual([7]);
  }, 60_000);
});

on("football")("Under the Lights' board", () => {
  const season = 'SEASON.clear(); SEASON.update(team="us", weeks=[], week=0, table={}, final=["us", "them"], champion=None, games=[[0, "us", "b", 21, 7], [1, "c", "us", 10, 14], [2, "c", "b", 99, 99]])';
  it("is the points your team scored in a season, the final too", async () => {
    const g = await start(builtAt("football"));
    expect(g.project.settings.scoreboard).toEqual({ unit: "points in a season" });
    g.py(season);
    g.py("finish_week(28, 3)");
    g.step();
    expect(g.scores).toEqual([21 + 14 + 28]);
  }, 60_000);
  it("counts a season even if you miss the final", async () => {
    const g = await start(builtAt("football"));
    g.py('new_season_for_test = None');
    g.py(`SEASON.clear(); SEASON.update(team="us", weeks=[[["us", "b"]]], week=0, final=None, champion=None, games=[[0, "c", "us", 10, 14]],
      table={t: {"w": 0, "l": 0, "t": 0, "pf": 0, "pa": 0} for t in ["us", "b"]})`);
    g.py('standings_real = standings; globals()["standings"] = lambda: ["x", "y"]; globals()["sim_game"] = lambda a, b, no_ties=False: (1, 0); globals()["record"] = lambda *a: None');
    g.py("finish_week(3, 0)");
    g.step();
    expect(g.scores).toEqual([14]);
  }, 60_000);
  it("sends nothing mid-season", async () => {
    const g = await start(builtAt("football"));
    g.py(`SEASON.clear(); SEASON.update(team="us", weeks=[[["us", "b"]], [["us", "c"]]], week=0, final=None, champion=None, games=[], table={})`);
    g.py('globals()["sim_game"] = lambda a, b, no_ties=False: (1, 0); globals()["record"] = lambda *a: None');
    g.py("finish_week(3, 0)");
    g.step();
    expect(g.scores).toEqual([]);
  }, 60_000);
});

on("golf")("Greenside's board", () => {
  const finish = async (players: number) => {
    const g = await start(builtAt("golf"));
    g.py(`new_round(${players}); ROUND["cards"][0] = [41] + [None] * (len(HOLES) - 1); ROUND["hole"] = len(HOLES) - 1; game = instances("Game")[0]; game.mode = "scores"; game.since = game.t - 100`);
    g.game.engine.input.keyDown(KEY_CODE.get("space")!);
    g.step(2);
    return g;
  };
  it("is your strokes for a whole round, and lowest wins", async () => {
    const g = await finish(1);
    expect(g.project.settings.scoreboard).toEqual({ lowest: true, unit: "strokes" });
    expect(g.py("instances('Game')[0].mode")).toBe("final");
    expect(g.scores).toEqual([41]);
  }, 60_000);
  it("isn't for a round shared between players", async () => {
    const g = await finish(2);
    expect(g.py("instances('Game')[0].mode")).toBe("final");
    expect(g.scores).toEqual([]);
  }, 60_000);
});

on("kart")("Zoomtown Cup's board", () => {
  it("is all four tracks' best times added up, once there are four, and lowest wins", async () => {
    const g = await start(builtAt("kart"));
    expect(g.project.settings.scoreboard).toEqual({ lowest: true, unit: "time" });
    // The first cup's four: the later cups' tracks (TRACKS[4:]) don't count towards it.
    const n = g.py("len(CUPS[0]['tracks'])") as number;
    expect(n).toBe(4);
    expect(g.py("CUPS[0]['tracks']")).toEqual([0, 1, 2, 3]);
    g.py('keep_best(TRACKS[4]["name"], 3600)');
    for (let i = 0; i < n - 1; i++) g.py(`keep_best(TRACKS[${i}]["name"], 3600)`);
    g.step();
    expect(g.scores).toEqual([]);
    g.py('keep_best(TRACKS[3]["name"], 1800)');
    g.step();
    expect(g.scores).toEqual([210]);
    g.py('keep_best(TRACKS[3]["name"], 2400)');
    g.step();
    expect(g.scores).toEqual([210]);
    g.py('keep_best(TRACKS[3]["name"], 1200)');
    g.step();
    expect(g.scores).toEqual([210, 200]);
  }, 60_000);
});

on("mystery")("the mystery's board", () => {
  it("is the time it took, only while playing, and lowest wins", async () => {
    const g = await start(builtAt("mystery"));
    expect(g.project.settings.scoreboard).toEqual({ lowest: true, unit: "time" });
    g.step(120); // on the title: not playing yet
    g.py('new_game(); QUEUE.clear(); instances("Game")[0].mode = "play"');
    g.step(600);
    expect(g.py('STATE["time"]')).toBe(600);
    g.py("ending()");
    g.step(3);
    expect(g.py('STATE.get("ended")')).toBe(true);
    expect(g.scores.length).toBe(1);
    expect(g.scores[0]).toBeCloseTo(10, 0);
    const at = g.py('STATE["time"]') as number;
    g.step(60);
    expect(g.py('STATE["time"]')).toBe(at);
  }, 60_000);
  it("a new game starts its clock again, and a saved one carries on", async () => {
    const g = await start(builtAt("mystery"));
    g.py('new_game(); STATE["time"] = 500; keep(); load_game()');
    expect(g.py('STATE["time"]')).toBe(500);
    g.py("new_game()");
    expect(g.py('STATE.get("time", 0)')).toBe(0);
  }, 60_000);
});

on("rpg")("Hollowmere's board", () => {
  it("is the time the whole journey took, once, and lowest wins", async () => {
    const g = await start(builtAt("rpg"));
    expect(g.project.settings.scoreboard).toEqual({ lowest: true, unit: "time" });
    g.py('new_game(); S["steps"] = 36000; S["lit"] = 4; room_goto("Ending")');
    g.step(3);
    expect(g.scores).toEqual([600]);
    // Seeing the ending again later doesn't send a slower time.
    g.py('S["steps"] = 72000; room_goto("Ending")');
    g.step(3);
    expect(g.scores).toEqual([600]);
  }, 60_000);
  it("sends nothing before the end", async () => {
    const g = await start(builtAt("rpg"));
    g.py('new_game(); S["steps"] = 36000; room_goto("Town")');
    g.step(30);
    expect(g.scores).toEqual([]);
  }, 60_000);
});

on("smash")("Jelly Jailbreak's board", () => {
  it("is points", async () => {
    const g = await start(builtAt("smash"));
    expect(g.project.settings.scoreboard).toEqual({ unit: "points" });
  }, 60_000);
});

on("sand")("Pour Decisions' board", () => {
  it("is each level's best added up: bigger levels and fewer pours count for more", async () => {
    const g = await start(builtAt("sand"));
    expect(g.project.settings.scoreboard).toEqual({ unit: "points" });
    const finish = (level: number, pours: number) => {
      g.py(`global_vars.level = ${level}; room_goto("Play")`);
      g.step(3);
      g.py(`global_vars.director.pours = ${pours}; finish(global_vars.director)`);
      g.step();
    };
    const par = (n: number): number => g.py(`LEVELS[${n}]["par"]`);
    finish(0, 999); // one star
    expect(g.scores).toEqual([10 * par(0)]);
    finish(3, 0); // three stars
    expect(g.scores.at(-1)).toBe(10 * par(0) + 30 * par(3));
    finish(0, 0); // level 1 again, better
    expect(g.scores.at(-1)).toBe(30 * par(0) + 30 * par(3));
    finish(3, 999); // worse: the best stays
    expect(g.scores.at(-1)).toBe(30 * par(0) + 30 * par(3));
  }, 60_000);
});

on("greymire", "Greymire")("Greymire's board", () => {
  it("is how many endings you've found", async () => {
    const g = await start(builtAt("greymire", "Greymire"));
    expect(g.project.settings.scoreboard).toEqual({ unit: "endings found" });
    const endings = g.py("list(ENDINGS)") as unknown as string[];
    g.py("new_journey()");
    g.py(`go_to("end:${endings[0]}")`);
    g.step();
    expect(g.scores).toEqual([1]);
    g.py(`go_to("end:${endings[0]}")`);
    g.step();
    expect(g.scores).toEqual([1]);
    g.py(`go_to("end:${endings[1]}")`);
    g.step();
    expect(g.scores).toEqual([1, 2]);
  }, 60_000);
});

on("", "Thornwood")("Thornwood's board", () => {
  it("is coins, when you finish", async () => {
    const g = await start(builtAt("", "Thornwood"));
    expect(g.project.settings.scoreboard).toEqual({ unit: "coins" });
    g.py('global_vars.coins = 12; global_vars.kills = 0; global_vars.deaths = 0; global_vars.frames = 0; room_goto("Ending")');
    g.step(3);
    expect(g.scores).toEqual([12]);
  }, 60_000);
});

on("climber")("Snowcap Scramble's board", () => {
  it("is the best height in metres, only when it's a new best", async () => {
    const g = await start(builtAt("climber"), { best: 30 });
    expect(g.project.settings.scoreboard).toEqual({ unit: "m" });
    g.py('room_goto("Mountain")');
    g.step(3);
    g.py("me = global_vars.player\nme.y = GROUND_Y - 20 * METER\nme.on = None");
    g.step(2);
    expect(g.scores).toEqual([]);
    g.py("me = global_vars.player\nme.y = GROUND_Y - 45 * METER\nme.on = None");
    g.step();
    expect(g.scores.length).toBe(1);
    expect(g.scores[0]).toBeGreaterThanOrEqual(44);
    expect(g.scores[0]).toBe(g.py("global_vars.best"));
  });
});

on("siege")("Tabletop Siege's board", () => {
  it("is wins against other players, all told: never wins against the computer", async () => {
    const alone = await start(builtAt("siege"));
    expect(alone.project.settings.scoreboard).toEqual({ unit: "wins" });
    alone.py('room_goto("Field")');
    alone.step(3);
    alone.py("end_match(0)");
    alone.step(3);
    expect(alone.scores).toEqual([]);
    // In a room (as the host, alone for the moment: the match is the game's own), wins count.
    const g = await start(builtAt("siege"), { wins: 4 }, { code: "KXTD", number: 1, name: "Ana", state: {} });
    g.py('room_goto("Field")');
    g.step(3);
    g.py("end_match(0)");
    g.step(3);
    expect(g.scores).toEqual([5]);
    g.py("new_match()\nend_match(1)");
    g.step(3);
    expect(g.scores).toEqual([5]);
  });
});

on("flags")("Snowfort Flags' board", () => {
  it("is the flags you've captured, all told: never the computer's", async () => {
    const g = await start(builtAt("flags"), { captures: 6 });
    expect(g.project.settings.scoreboard).toEqual({ unit: "captures" });
    g.py('room_goto("Field")');
    g.step(3);
    g.py("for b in instances('Bot'): b.destroy()");
    g.step();
    // A computer kid's capture: nothing on the board.
    g.py("k = instance_create(*stand_of('blue'), 'Kid')\nk.team = 'blue'\nf = flag_of('red')\nf.state, f.carrier, k.carry = 'carried', k, f");
    g.step(2);
    expect(g.py("global_vars.m['score']['blue']")).toBe(1);
    expect(g.scores).toEqual([]);
    // Yours: the total, kept.
    g.py("me = global_vars.player\nf = flag_of('blue')\nf.state, f.carrier, me.carry = 'carried', me, f\nme.x, me.y = stand_of('red')");
    g.step(2);
    expect(g.scores).toEqual([7]);
  });
});

on("lemon")("Squeeze's board", () => {
  it("is the money each evening, in whole dollars, from the first day on", async () => {
    const g = await start(builtAt("lemon"));
    expect(g.project.settings.scoreboard).toEqual({ unit: "dollars" });
    g.py('global_vars.s = new_summer(4)\nglobal_vars.s["plan"]["buy"] = {"lemons": 0, "sugar": 0, "ice": 0, "cups": 0}\nroom_goto("Morning")');
    g.step(2);
    g.py('do_act("open", None)');
    g.step(2);
    g.py("global_vars.speed = 4");
    for (let k = 0; k < 3000 && (g.py("room_name()") as string) === "Street"; k++) g.step();
    // The first evening: on the board already, with the money tonight.
    expect(g.scores).toEqual([g.py('global_vars.s["money"] // 100')]);
    // The last day: the money, in dollars.
    g.py('do_act("next", None)');
    g.step(2);
    g.py('s = global_vars.s\ns["day"] = DAYS - 1\ns["money"] = 15099\ns["plan"]["buy"] = {"lemons": 0, "sugar": 0, "ice": 0, "cups": 0}\ndo_act("open", None)');
    g.step(2);
    g.py("global_vars.speed = 4");
    for (let k = 0; k < 3000 && (g.py("room_name()") as string) === "Street"; k++) g.step();
    expect(g.scores.at(-1)).toBe(150);
  }, 120_000);
});

on("cooking")("Order Up!'s board", () => {
  it("is every star earned, all days of both restaurants; a day replayed no better sends nothing", async () => {
    const g = await start(builtAt("cooking"), { progress: { coins: 0, stars: [[3, 2, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], ups: [[], []] } });
    expect(g.project.settings.scoreboard).toEqual({ unit: "stars" });
    // Day 3 of the burger shack, closed with coins for two stars.
    g.py('start_day(0, 2)');
    g.step(2);
    g.py('k = global_vars.k\nk["arrivals"] = []\nk["coins"] = star_goals(k["goal"])[1]');
    g.step(3);
    expect(g.scores).toEqual([7]);
    // Day 1 again, with nothing: its three stars stay, and the board hears nothing.
    g.py('start_day(0, 0)');
    g.step(2);
    g.py('global_vars.k["arrivals"] = []');
    g.step(3);
    expect(g.scores).toEqual([7]);
  });
});
