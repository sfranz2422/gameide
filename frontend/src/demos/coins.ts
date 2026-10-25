/**
 * Phase 1's hard-coded demo: a player moves with the arrow keys, is stopped
 * by walls, and collects coins. Everything a later phase will let students
 * build in the editor, written out by hand.
 */
import type { GameDefinition, RoomInstance } from "../engine/game";

const T = 32; // one grid square

// A small maze. # wall, c coin, P player.
const MAP = [
  "####################",
  "#P....c.....#.....c#",
  "#.####.####.#.####.#",
  "#.#c.....c#...#c...#",
  "#.#.#####.#####.##.#",
  "#...#..c..#c.....#.#",
  "###.#.###.#.####.#.#",
  "#c..#...#...#..c.#.#",
  "#.#####.#####.####.#",
  "#.c...#.....c.#....#",
  "#.###.#.#####.#.##.#",
  "#...#...#c....#..#c#",
  "#.#.#####.#####.##.#",
  "#c#.......c........#",
  "####################",
];

function layout(): RoomInstance[] {
  const out: RoomInstance[] = [];
  MAP.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const x = c * T, y = r * T;
      if (ch === "#") out.push({ object: "Wall", x, y });
      if (ch === "c") out.push({ object: "Coin", x: x + T / 2, y: y + T / 2 });
      if (ch === "P") out.push({ object: "Player", x: x + 4, y: y + 4 });
    }),
  );
  out.push({ object: "Hud", x: 0, y: 0 });
  return out;
}

export const coinsDemo: GameDefinition = {
  sprites: [
    {
      name: "player",
      width: 24,
      height: 24,
      originX: 0,
      originY: 0,
      frameCount: 1,
      paint(ctx) {
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.roundRect(0, 0, 24, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillRect(6, 7, 4, 5);
        ctx.fillRect(14, 7, 4, 5);
      },
    },
    {
      name: "wall",
      width: T,
      height: T,
      originX: 0,
      originY: 0,
      frameCount: 1,
      paint(ctx) {
        ctx.fillStyle = "#475569";
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = "#64748b";
        ctx.fillRect(1, 1, T - 2, T - 2);
        ctx.fillStyle = "#475569";
        ctx.fillRect(0, T / 2, T, 1);
        ctx.fillRect(T / 2, 0, 1, T / 2);
      },
    },
    {
      // Four frames of a coin turning, so animation is exercised too.
      name: "coin",
      width: 16,
      height: 16,
      originX: 8,
      originY: 8,
      frameCount: 4,
      paint(ctx, frame) {
        const w = [8, 5, 2, 5][frame]!;
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.ellipse(8, 8, w, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#a16207";
        ctx.fillRect(8 - Math.max(1, w / 3), 4, Math.max(1, (2 * w) / 3), 8);
      },
    },
  ],
  objects: [
    { name: "Wall", sprite: "wall", solid: true },
    { name: "Coin", sprite: "coin", depth: 10 },
    { name: "Player", sprite: "player", depth: -10 },
    { name: "Hud", depth: -1000 },
  ],
  rooms: [{ name: "Maze", width: 640, height: 480, background: 0x0f172a, instances: layout() }],
  code: {
    Player: `\
class Player(GameObject):
    def on_create(self):
        self.move_speed = 4

    def on_step(self):
        dx = (keyboard_check("right") - keyboard_check("left")) * self.move_speed
        dy = (keyboard_check("down") - keyboard_check("up")) * self.move_speed
        move_and_collide(dx, dy, "Wall")

    def on_collision_coin(self, other):
        other.destroy()
        global_vars.score += 1
`,
    Coin: `\
class Coin(GameObject):
    def on_create(self):
        self.image_speed = 0.15
`,
    Hud: `\
class Hud(GameObject):
    def on_game_start(self):
        global_vars.score = 0
        global_vars.total = instance_number("Coin")

    def on_draw(self):
        draw_set_color("white")
        draw_text(8, 452, f"Coins: {global_vars.score} / {global_vars.total}")
        if not instance_exists("Coin"):
            draw_set_color("yellow")
            draw_text(250, 220, "You got them all!  (R to play again)")

    def on_key_pressed_r(self):
        game_restart()
`,
  },
};
