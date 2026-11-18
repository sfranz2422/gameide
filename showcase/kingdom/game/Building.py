# object: Building
# One building on the map: its picture for its level (three pictures a kind: levels 1-3,
# 4-6, 7 on), scaffolding while it's first built, a builder's clock while a job runs,
# and gold or food waiting over a mine or farm. Where it is and what level it's at are
# the kingdom's (`b`, its dict), read each step, so a move moves it.

# === create
self.b = None

# === step
b = self.b
self.depth = -building_xy(b["kind"], b["gx"], b["gy"])[1]

# === draw
b = self.b
kind = b["kind"]
x, y = building_xy(kind, b["gx"], b["gy"])
held = global_vars.moving is b
size = info(kind)["size"]
if b["level"] == 0:
    draw_sprite_ext(f"scaffold_{size}", 0, x, y, 1, 1, 0, "white", 0.35 if held else 1)
else:
    draw_sprite_ext(f"{kind}_{tier(b['level'])}", 0, x, y, 1, 1, 0, "white", 0.35 if held else 1)
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
elif maker(b):
    n = waiting(b)
    if n >= stat(kind, "hold", b["level"]) * 0.1 or n >= 500:
        by = top + 10 + math.sin(global_vars.t * 0.08 + b["gx"]) * 4
        draw_set_alpha(0.92)
        draw_set_color("#efe6d2")
        draw_circle(x, by, 18)
        draw_set_alpha(1)
        icon(makes(b), x, by, 28)
