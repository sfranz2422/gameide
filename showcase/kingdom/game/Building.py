# object: Building
# One building on the map: its picture for its level (a new look every two levels),
# scaffolding while it's first built, a builder's clock while a job runs,
# and gold or food waiting over a mine or farm. Where it is and what level it's at are
# the kingdom's (`b`, its dict), read each step, so a move moves it. A level going up is
# celebrated (the teacher: you couldn't tell anything had been upgraded).

# === create
self.b = None
self.seen = None        # the level last drawn: a higher one is an upgrade just finished
self.shine = 0          # steps left of its "Level 5!" moment

# === step
b = self.b
self.depth = -building_xy(b["kind"], b["gx"], b["gy"])[1]
if self.seen is not None and b["level"] > self.seen:
    # Finished: built, or a level up. (Not on the first step: a kingdom just loaded isn't news.)
    self.shine = UPGRADE_SHOW
    x, y = building_xy(b["kind"], b["gx"], b["gy"])
    high = info(b["kind"])["size"] * TILE_H
    effect("sparkle", x, y - high, None, 2)
    effect("confetti", x, y - high * 1.5, None, 1)
    sound_play("levelup", volume=0.5)
self.seen = b["level"]
if self.shine > 0:
    self.shine -= 1

# === draw
b = self.b
kind = b["kind"]
x, y = building_xy(kind, b["gx"], b["gy"])
held = global_vars.moving is b
size = info(kind)["size"]
if b["level"] == 0:
    draw_sprite_ext(f"scaffold_{size}", 0, x, y, 1, 1, 0, "white", 0.35 if held else 1)
else:
    # Just upgraded: a little bounce as it changes.
    pop = 1 + 0.1 * max(0, self.shine - (UPGRADE_SHOW - 20)) / 20
    # (No level badge: the teacher found the numbers over everything too busy, 2026-11-20;
    # the look changing every two levels shows it. A building's window says its level.)
    draw_sprite_ext(f"{kind}_{tier(b['level'])}", 0, x, y, pop, pop, 0, "white", 0.35 if held else 1)
if global_vars.chosen is b and not held:
    diamond(x, y, GOLD, 0.9, size, True)
top = y - size * TILE_H / 2 - 70
if b["job"] is not None:
    # The builder's clock: a bar filling up, and the time left.
    left = time_left(b)
    total = max(1, info(kind)["time"][b["job"]["to"] - 1])
    draw_set_color("#0c0b0a")
    draw_rect(x - 40, top, x + 40, top + 8)
    draw_set_color(MINT)
    draw_rect(x - 40, top, x - 40 + 80 * clamp(1 - left / total, 0, 1), top + 8)
    text(x, top - 20, clock_words(left), INK, 13, "center")
    if global_vars.t % 30 < 15:
        icon("hammer", x + 52, top + 4, 24)
else:
    bb = bubble(b)
    if bb:
        # Bobbing; full, it pulses red and says so (it has stopped making anything).
        z = zoom()
        by = bb["y"] + math.sin(global_vars.t * 0.08 + b["gx"]) * 4 / z
        grow = 1 + (0.12 * math.sin(global_vars.t * 0.2) if bb["full"] else 0)
        if bb["full"]:
            draw_set_alpha(0.85)
            draw_set_color(RED)
            draw_circle(x, by, bb["r"] * grow + 3 / z)
        draw_set_alpha(0.95)
        draw_set_color("#efe6d2")
        draw_circle(x, by, bb["r"] * grow)
        draw_set_alpha(1)
        icon(makes(b), x, by, bb["r"] * 1.55 * grow)
        if bb["full"]:
            text(x, by + bb["r"] + 2 / z, "Full!", RED, 13 / z, "center")
# The moment an upgrade finishes: "Level 5!" rising and fading over the building.
if self.shine > 0 and b["level"] > 0:
    z = zoom()
    rise = (UPGRADE_SHOW - self.shine) * 0.6 / z
    draw_set_alpha(min(1, self.shine / 30))
    text(x, top - 30 / z - rise, "Built!" if b["level"] == 1 else f"Level {b['level']}!", GOLD, 18 / z, "center")
    draw_set_alpha(1)
