/**
 * The stress test: hundreds of instances, each with a Python Step event,
 * bouncing off the room's edges and off a few walls (Collision events), so
 * all three costs — Python events, engine motion and the spatial hash — are
 * paid every frame. Space adds 100 more; Backspace takes 100 away.
 */
import type { GameDefinition } from "../engine/game";

export const STRESS_START = 300;

export const stressDemo: GameDefinition = {
  sprites: [
    {
      name: "ball",
      width: 12,
      height: 12,
      originX: 6,
      originY: 6,
      frameCount: 1,
      paint(ctx) {
        ctx.fillStyle = "#f472b6";
        ctx.beginPath();
        ctx.arc(6, 6, 6, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    {
      name: "block",
      width: 64,
      height: 64,
      originX: 0,
      originY: 0,
      frameCount: 1,
      paint(ctx) {
        ctx.fillStyle = "#334155";
        ctx.fillRect(0, 0, 64, 64);
      },
    },
  ],
  objects: [
    { name: "Ball", sprite: "ball" },
    { name: "Block", sprite: "block" },
    { name: "Spawner", depth: -100 },
  ],
  rooms: [
    {
      name: "Arena",
      width: 800,
      height: 600,
      background: 0x020617,
      instances: [
        { object: "Block", x: 160, y: 140 },
        { object: "Block", x: 576, y: 140 },
        { object: "Block", x: 368, y: 268 },
        { object: "Block", x: 160, y: 396 },
        { object: "Block", x: 576, y: 396 },
        { object: "Spawner", x: 0, y: 0 },
      ],
    },
  ],
  code: {
    Ball: `\
import random

class Ball(GameObject):
    def on_create(self):
        self.speed = random.uniform(1.5, 4)
        self.direction = random.uniform(0, 360)

    def on_step(self):
        if self.x < 6 or self.x > room_width - 6:
            self.hspeed = -self.hspeed
        if self.y < 6 or self.y > room_height - 6:
            self.vspeed = -self.vspeed

    def on_collision_block(self, other):
        # Bounce off whichever side was hit: the side it came in through.
        if self.xprevious + 6 <= other.x or self.xprevious - 6 >= other.x + 64:
            self.hspeed = -self.hspeed
        else:
            self.vspeed = -self.vspeed
        self.x = self.xprevious
        self.y = self.yprevious
`,
    Spawner: `\
import random

def spawn(n):
    for _ in range(n):
        while True:
            x, y = random.uniform(10, room_width - 10), random.uniform(10, room_height - 10)
            ball = instance_create(x, y, "Ball")
            if not ball.place_meeting(x, y, "Block"):
                break
            ball.destroy()

class Spawner(GameObject):
    def on_create(self):
        spawn(${STRESS_START})

    def on_key_pressed_space(self):
        spawn(100)

    def on_key_pressed_backspace(self):
        for ball in instances("Ball")[:100]:
            ball.destroy()

    def on_draw(self):
        draw_set_color("white")
        draw_text(8, 8, f"{instance_number('Ball')} balls — Space adds 100, Backspace removes 100")
`,
  },
};
