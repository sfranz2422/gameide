/**
 * The sixth showcase game, Ridgeline Rally (a side-view hill-climb), played
 * headless in the real Pyodide. A bot driver drives a whole stage through
 * the game's own keys, from the title through the garage to the finish
 * flag, and is paid for it; another drives with every fuel can taken off
 * the road and runs dry; a third floors it on the moon and lands on its
 * head. Then the rules one at a time: fuel, fuel cans, coins, the garage's
 * upgrades really changing the car, the moon's low gravity, flips, the
 * head, saving between visits, and the build refusing a stage it can't
 * drive. Runs when the game has been built (python3
 * showcase/hillclimb/build.py, which makes all of its art).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/hillclimb/out/project.json");
const have = existsSync(BUILT);

async function start(save: Record<string, unknown> = {}) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  let saved: Record<string, unknown> = save;
  const { game, error } = await PythonGame.load({ ...def, save } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    save: (d) => (saved = d),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  py(game, `g = instances('Game')[0]\n${BOT}`);
  return Object.assign(game, { saved: () => saved });
}

function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}
const py = (g: PythonGame, code: string) => g.evalPython(code) as never;
function press(g: PythonGame, key: string) {
  g.engine.input.keyDown(KEY_CODE.get(key)!);
  step(g);
  g.engine.input.keyUp(KEY_CODE.get(key)!);
  step(g);
}
function hold(g: PythonGame, key: string, down: boolean) {
  if (down) g.engine.input.keyDown(KEY_CODE.get(key)!);
  else g.engine.input.keyUp(KEY_CODE.get(key)!);
}

/**
 * The bot, in Python: what a careful player would press, from what's on
 * the screen. Gas, unless the nose is up so far the car would tip over
 * backwards (then off the gas, or the brake); in the air, gas or brake to
 * tip the car to match the road it will land on.
 */
const BOT = `
import math
def bot_keys():
    car, road = RUN["car"], RUN["road"]
    ahead = math.atan2(ground_y(road, car.x + 30) - ground_y(road, car.x - 30), 60)
    if car.air > 3:
        below = math.atan2(ground_y(road, car.x + 60 + car.vx * 10) - ground_y(road, car.x + car.vx * 10), 60)
        d = car.a - below + car.w * 12
        return "right" if d > 0.05 else "left" if d < -0.05 else ""
    lean = car.a - ahead
    if lean < -0.8:
        return "left"
    return "" if lean < -0.55 else "right"
`;

/** Drives with the bot until the run ends (or `most` steps), holding the keys it asks for. */
function drive(g: PythonGame, most = 12000, policy = "bot_keys()") {
  let held = "";
  for (let i = 0; i < most && py(g, "g.mode") === "race" && !py(g, "RUN['end']"); i++) {
    const want = py(g, policy) as string;
    if (want !== held) {
      if (held) hold(g, held, false);
      if (want) hold(g, want, true);
      held = want;
    }
    step(g);
  }
  if (held) hold(g, held, false);
  for (let i = 0; i < 200 && py(g, "g.mode") === "race"; i++) step(g);
}

/** From the title to the garage, the stage and vehicle picked by pressing, then DRIVE!. */
function toRace(g: PythonGame, stage = 0, vehicle = 0) {
  if (py(g, "g.mode") === "title") press(g, "space");
  step(g, 12);
  expect(py(g, "g.mode")).toBe("garage");
  const goTo = (row: string) => {
    for (let i = 0; i < 8 && py(g, "ROWS[g.row]") !== row; i++) press(g, "down");
    expect(py(g, "ROWS[g.row]")).toBe(row);
  };
  goTo("stage");
  for (let i = 0; i < 5 && py(g, "g.stage_i") !== stage; i++) press(g, "right");
  goTo("vehicle");
  for (let i = 0; i < 5 && py(g, "g.kind_i") !== vehicle; i++) press(g, "right");
  goTo("go");
  press(g, "space");
  expect(py(g, "g.mode")).toBe("race");
}

/** A car of `kind` on its own, on stage `stage`, for the physics alone. */
const newCar = (stage: number, kind = "Jeep", levels = "{}") =>
  `stage = STAGES[${stage}]\nroad = build_ground(stage)\ncar = Car("${kind}", ${levels}, road, START_X)`;

describe.skipIf(!have)("Ridgeline Rally", () => {
  it("is driven up the whole Countryside by a bot, through the keys: paid, and its best and ghost kept", async () => {
    const g = await start();
    toRace(g, 0, 0);
    drive(g);
    expect(py(g, "RUN['end']"), `stopped at ${py(g, "RUN['furthest']")} m`).toBe("finish");
    expect(py(g, "g.mode")).toBe("over");
    const got = py(g, "RUN['got']") as number;
    expect(got).toBeGreaterThan(300);                    // most of the coins on the way
    expect(py(g, "wallet()")).toBe(got);
    const total = py(g, "metres(RUN['road']['finish'])") as number;
    expect(py(g, "best('Countryside')")).toBeGreaterThanOrEqual(total);
    expect(py(g, "len(load_ghost('Countryside')['path'])")).toBeGreaterThan(300);
    expect((g.saved() as { coins: number }).coins).toBe(got);   // and handed out to be kept
    step(g, 35);
    press(g, "space");
    expect(py(g, "g.mode")).toBe("garage");
  }, 600_000);

  it("runs out of fuel with every can taken off the road, and the run ends once the car stops", async () => {
    const g = await start();
    toRace(g, 0, 0);
    py(g, "RUN['fuel'] = []");
    drive(g);
    expect(py(g, "RUN['end']")).toBe("fuel");
    expect(py(g, "RUN['car'].fuel")).toBe(0);
    const far = py(g, "RUN['furthest']") as number;
    // A tank lasts 1000 steps of gas: somewhere in the first few hundred metres.
    expect(far).toBeGreaterThan(200);
    expect(far).toBeLessThan(900);
  }, 300_000);

  it("ends the run when the driver's head hits the ground: flooring a big engine on the moon tips the car over", async () => {
    const g = await start({ coins: 0, stages: ["Countryside", "Moon"], levels: { Jeep: { engine: 5, tires: 5 } } });
    toRace(g, 2, 0);
    drive(g, 6000, "'right'");
    expect(py(g, "RUN['end']"), `drove ${py(g, "RUN['furthest']")} m`).toBe("head");
    expect(py(g, "RUN['car'].head_hit")).toBe(true);
    step(g, 80);
    expect(py(g, "g.mode")).toBe("over");
  }, 300_000);

  it("burns fuel only on the gas, and a can fills the tank", async () => {
    const g = await start();
    py(g, newCar(0));
    expect(py(g, "car.fuel")).toBe(100);
    py(g, "for _ in range(100): car_step(car, False, False, stage, road)");
    expect(py(g, "car.fuel")).toBe(100);
    py(g, "for _ in range(100): car_step(car, True, False, stage, road)");
    expect(py(g, "round(car.fuel, 6)")).toBe(90);
    // Out of fuel, the gas does nothing.
    py(g, `${newCar(0)}\nfor _ in range(60): car_step(car, False, False, stage, road)\ncar.fuel = 0\nx = car.x\nfor _ in range(60): car_step(car, True, False, stage, road)`);
    expect(py(g, "abs(car.x - x) < 5")).toBe(true);
    // A can in front of the car, in a run: the tank is full again.
    py(g, "start_run('Countryside', 'Jeep', {})\nRUN['car'].fuel = 20\nRUN['fuel'] = [[RUN['car'].x + 5, RUN['car'].y, True]]");
    expect(py(g, "run_step(False, False)")).toContain("fuel");
    expect(py(g, "RUN['car'].fuel")).toBe(100);
    expect(py(g, "RUN['fuel'][0][2]")).toBe(false);
  });

  it("picks up coins worth the stage's coin value, once each, and banks them when the run ends", async () => {
    const g = await start({ coins: 40 });
    py(g, "start_run('Desert', 'Jeep', {})\ncar = RUN['car']\nRUN['coins'] = [[car.x + 4, car.y, True], [car.x + 10, car.y - 6, True], [car.x + 400, car.y, True]]");
    const happened = py(g, "run_step(False, False)") as string[];
    expect(happened.filter((h) => h === "coin").length).toBe(2);
    expect(py(g, "RUN['got']")).toBe(20); // 2 desert coins, 10 each
    expect(py(g, "run_step(False, False)")).not.toContain("coin");
    expect(py(g, "RUN['got']")).toBe(20);
    expect(py(g, "wallet()")).toBe(40); // not until the run is over
    py(g, "RUN['end'] = 'quit'\nfinish_run(g)");
    expect(py(g, "wallet()")).toBe(60);
    // Reaching the finish flag pays a bonus too: 20 coins' worth.
    py(g, "start_run('Desert', 'Jeep', {})\ncar = RUN['car']\nRUN['coins'] = []\ndx = RUN['road']['finish'] - car.x + 1\ndy = ground_y(RUN['road'], car.x + dx) - ground_y(RUN['road'], car.x)\nfor o in [car] + car.wheels: o.x, o.y = o.x + dx, o.y + dy");
    expect(py(g, "run_step(False, False)")).toContain("finish");
    expect(py(g, "(RUN['end'], RUN['got'])")).toEqual(["finish", 200]);
  });

  it("sells upgrades in the garage, and each one changes the car: engine, suspension, tyres and tank", async () => {
    const g = await start({ coins: 5000 });
    press(g, "space");
    step(g, 12);
    const buy = (row: string) => {
      for (let i = 0; i < 8 && py(g, "ROWS[g.row]") !== row; i++) press(g, "down");
      press(g, "space");
    };
    buy("engine");
    buy("engine");
    buy("tires");
    buy("suspension");
    buy("fuel tank");
    expect(py(g, "levels_of('Jeep')")).toEqual({ engine: 2, tires: 1, suspension: 1, "fuel tank": 1 });
    expect(py(g, "wallet()")).toBe(5000 - 150 - 300 - 120 - 100 - 100);
    // The numbers the physics reads.
    const stock = py(g, "car_stats('Jeep', {})") as Record<string, number>;
    const better = py(g, "car_stats('Jeep', levels_of('Jeep'))") as Record<string, number>;
    expect(better.power).toBeCloseTo(stock.power! * 1.24);
    expect(better.grip).toBeCloseTo(stock.grip! * 1.1);
    expect(better.spring).toBeCloseTo(stock.spring! * 1.15);
    expect(better.tank).toBeCloseTo(stock.tank! * 1.2);
    // And the car itself: the upgraded engine pulls further in the same time.
    const reach = (levels: string) =>
      py(g, `${newCar(0, "Jeep", levels)}\nfor _ in range(240): car_step(car, True, False, stage, road)\ncar.x`) as number;
    expect(reach("{'engine': 2}")).toBeGreaterThan(reach("{}") + 80);
    // A steep made-up hill (26 degrees, on the desert): the stock engine can't hold it, five upgrades can.
    const climbs = (levels: string) =>
      py(g, `stage = STAGES[1]\nroad = {'heights': [3000 - max(0, i - 15) * 10 for i in range(200)], 'bridges': [], 'finish': 99999}
car = Car('Jeep', ${levels}, road, 250)
for _ in range(400): car_step(car, True, False, stage, road)
car.x > 600`) as boolean;
    expect(climbs("{}")).toBe(false);
    expect(climbs("{'engine': 5}")).toBe(true);
    // Tyres: on the moon's dust a standing start is held back by grip, not the engine,
    // so better tyres pull away harder and a bigger engine alone doesn't.
    const pull = (levels: string) =>
      py(g, `stage = STAGES[2]\nroad = {'heights': [3000] * 400, 'bridges': [], 'finish': 99999}
car = Car('Jeep', ${levels}, road, 200)
for _ in range(60): car_step(car, False, False, stage, road)
for _ in range(30): car_step(car, True, False, stage, road)
car.vx`) as number;
    const stockPull = pull("{}");
    expect(pull("{'tires': 5}")).toBeGreaterThan(stockPull * 1.05);
    expect(pull("{'engine': 5}")).toBeLessThan(stockPull * 1.02);
    expect(pull("{'engine': 5, 'tires': 5}")).toBeGreaterThan(stockPull * 1.3);
    // Suspension: stiffer springs sag less under the car's weight.
    const sag = (levels: string) =>
      py(g, `${newCar(0, "Jeep", levels)}\nfor _ in range(200): car_step(car, False, False, stage, road)
w = car.wheels[0]
car.to_world(*w.mount)[1] - w.y`) as number;
    expect(sag("{'suspension': 5}")).toBeLessThan(sag("{}") * 0.7);
    // The tank: a run starts with the bigger tank full.
    py(g, "start_run('Countryside', 'Jeep', levels_of('Jeep'))");
    expect(py(g, "RUN['car'].fuel")).toBe(120);
    // Not enough coins: nothing bought, and it says so.
    py(g, "save_set('coins', 10)");
    buy("engine");
    expect(py(g, "levels_of('Jeep')['engine']")).toBe(2);
    expect(py(g, "g.msg")).toContain("Not enough");
  });

  it("has the moon's low gravity: the same drop takes far longer to land", async () => {
    const g = await start();
    const fall = (stage: number) =>
      py(g, `${newCar(stage)}\ncar.y -= 200\nfor w in car.wheels: w.y -= 200
n = 0
while not any(w.on for w in car.wheels) and n < 2000:
    car_step(car, False, False, stage, road); n += 1
n`) as number;
    const earth = fall(0);
    const moon = fall(2);
    expect(py(g, "STAGES[2]['gravity'] < STAGES[0]['gravity'] / 2")).toBe(true);
    expect(moon).toBeGreaterThan(earth * 1.5);
  });

  it("tips the car in the air: gas back, brake forward, and pays for a flip", async () => {
    const g = await start();
    const spin = (gas: string, brake: string) =>
      py(g, `${newCar(0)}\nfor o in [car] + car.wheels: o.y -= 400
for _ in range(30): car_step(car, ${gas}, ${brake}, stage, road)
car.a`) as number;
    expect(spin("True", "False")).toBeLessThan(-0.3);
    expect(spin("False", "True")).toBeGreaterThan(0.3);
    expect(Math.abs(spin("False", "False"))).toBeLessThan(0.05);
    // A whole turn in the air, landed on the wheels: a flip, and its coins.
    py(g, `start_run('Countryside', 'Jeep', {})
car = RUN['car']
for o in [car] + car.wheels: o.y -= 300
car.air, car.air_spin = 50, -2 * math.pi
words = []
for _ in range(200):
    words += run_step(False, False)
    if 'land' in words or car.air == 0: break`);
    expect(py(g, "words")).toContain("flip");
    expect(py(g, "RUN['flips']")).toBe(1);
    expect(py(g, "RUN['got']")).toBe(50);
  });

  it("ends the run on the driver's head, and not on the wheels or the body", async () => {
    const g = await start();
    // Upside down on flat ground: the head is the first thing down.
    py(g, `start_run('Countryside', 'Jeep', {})
car = RUN['car']
car.a = math.pi
for w in car.wheels: w.x, w.y = car.to_world(*w.mount)
for o in [car] + car.wheels: o.y -= 40
for _ in range(120):
    run_step(False, False)
    if RUN['end']: break`);
    expect(py(g, "RUN['end']")).toBe("head");
    // Dropped right way up from the same height: it bounces on its springs and drives on.
    py(g, `start_run('Countryside', 'Jeep', {})
car = RUN['car']
for o in [car] + car.wheels: o.y -= 60
for _ in range(120): run_step(False, False)`);
    expect(py(g, "RUN['end'] is None")).toBe(true);
    // Nose down onto the road: the body scrapes, but that's not the head.
    py(g, `start_run('Countryside', 'Jeep', {})
car = RUN['car']
car.a = 1.2
for w in car.wheels: w.x, w.y = car.to_world(*w.mount)
for o in [car] + car.wheels: o.y -= 30
scraped = False
for _ in range(60):
    run_step(False, False)
    scraped = scraped or car.scrape`);
    expect(py(g, "scraped")).toBe(true);
    expect(py(g, "RUN['end'] is None")).toBe(true);
  });

  it("keeps coins, upgrades, stages, vehicles and bests between visits", async () => {
    const g = await start({ coins: 4000 });
    press(g, "space");
    step(g, 12);
    py(g, "buy_stage('Desert')\nbuy_vehicle('Truck')\nbuy_upgrade('Truck', 'engine')\nRUN['furthest'] = 0\nkeep_best('Desert', 321)");
    step(g); // the save goes out with the next frame
    const saved = g.saved();
    const again = await start(saved);
    expect(py(again, "owned_stages()")).toEqual(["Countryside", "Desert"]);
    expect(py(again, "owned_vehicles()")).toEqual(["Jeep", "Truck"]);
    expect(py(again, "levels_of('Truck')")).toEqual({ engine: 1 });
    expect(py(again, "wallet()")).toBe(4000 - 600 - 2500 - 150);
    expect(py(again, "best('Desert')")).toBe(321);
    expect(py(again, "load_ghost('Desert')['car']")).toBe("Jeep");
  });

  it("won't build a stage that leaves the room, is longer than the room, or has a hill the jeep can't climb", () => {
    const BUILD = resolve(__dirname, "../../../showcase/hillclimb/build.py");
    const refuses = (change: string) => {
      const script = `import importlib.util
spec = importlib.util.spec_from_file_location("hc_build", ${JSON.stringify(BUILD)})
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
s = b.STAGES[0]
${change}
try:
    b.check_stages()
    print("built")
except SystemExit as e:
    print(e)`;
      return execFileSync("python3", ["-c", script], { encoding: "utf8" }).trim();
    };
    expect(refuses("pass")).toBe("built");
    expect(refuses('s["pieces"] = s["pieces"] + [("climb", 100, 60)]')).toContain("too steep for the jeep");
    expect(refuses('s["pieces"] = s["pieces"] + [("flat", 6000)]')).toContain("but the room fits");
    expect(refuses('s["pieces"] = s["pieces"] + [("climb", 3000, 300)]')).toContain("the road goes above the room");
    expect(refuses('s["pieces"] = s["pieces"] + [("loop", 30)]')).toContain("No such piece of road");
  });
});
