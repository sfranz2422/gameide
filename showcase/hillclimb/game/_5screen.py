# script: screen
# Drawing. The world (Draw): the sky and two hills drawn further back that
# move slower than the road (parallax), the road itself, worked out from
# the stage's heights each frame, what's on it, and the car. Over it
# (Draw GUI, 640 x 360): fuel, coins, distance, and the menus.
import math

VIEW_W, VIEW_H = 640, 360
INK, SHADOW, GOLD, RED, MINT = "#ffffff", "#1b1b2a", "#ffd23f", "#ff5a4f", "#9ff0c0"
BACK_W = 1024          # the back layers' pictures are this wide, and repeat


def text(x, y, words, colour=INK, size=16, align="left", shadow=True):
    draw_set_font(None, size)
    draw_set_halign(align)
    if shadow:
        draw_set_color(SHADOW)
        draw_text(x + 2, y + 2, words)
    draw_set_color(colour)
    draw_text(x, y, words)
    draw_set_halign("left")


def panel(x1, y1, x2, y2, alpha=0.7, colour="#16213a"):
    draw_set_alpha(alpha)
    draw_set_color(colour)
    draw_rect(x1, y1, x2, y2)
    draw_set_alpha(1)


def stage_index(stage):
    return STAGES.index(stage) if stage in STAGES else 0


# ---------------------------------------------------------------- the world

def draw_backdrop(stage, cx, cy):
    """The sky, then the far hills, then the near ones: each moves slower the further back it is."""
    n = stage_index(stage)
    draw_sprite(f"sky_{n}", 0, cx, cy)
    lift = clamp((cy - (BASE - 230)) * -0.05, -30, 60)
    for layer, k, drop in (("far", 0.12, 0.6), ("near", 0.35, 1.0)):
        off = (cx * k) % BACK_W
        y = cy + (30 if layer == "far" else 70) + lift * drop
        draw_sprite(f"{layer}_{n}", 0, cx - off, y)
        draw_sprite(f"{layer}_{n}", 0, cx - off + BACK_W, y)


def in_bridge(road, x):
    for a, b in road["bridges"]:
        if a <= x <= b:
            return True
    return False


def draw_road(stage, road, cx, cy):
    """The road, as a strip of four-sided pieces: dirt, a darker band under it, grass on top."""
    look = stage["look"]
    hs = road["heights"]
    i0 = max(0, int(cx // STEP) - 1)
    i1 = min(len(hs) - 2, int((cx + VIEW_W) // STEP) + 1)
    bottom = cy + VIEW_H + 20
    # Under a bridge the ground drops away into a ravine.
    tops = []
    for i in range(i0, i1 + 2):
        tops.append(hs[i] + (160 if in_bridge(road, i * STEP) and in_bridge(road, (i - 1) * STEP)
                             and in_bridge(road, (i + 1) * STEP) else 0))
    for colour, down in ((look["dirt"], 0), (look["deep"], 34)):
        draw_set_color(colour)
        for k in range(i1 - i0 + 1):
            x0, x1 = (i0 + k) * STEP, (i0 + k + 1) * STEP
            y0, y1 = tops[k] + down, tops[k + 1] + down
            low = max(y0, y1)
            if y0 != y1:
                draw_triangle(x0, y0, x1, y1, x0 if y0 < y1 else x1, low)
            draw_rect(x0, low, x1 + 0.5, bottom)
    draw_set_color(look["grass"])
    for k in range(i1 - i0 + 1):
        x0, x1 = (i0 + k) * STEP, (i0 + k + 1) * STEP
        if tops[k] == hs[i0 + k] and tops[k + 1] == hs[i0 + k + 1]:      # not down a ravine's wall
            draw_line(x0, tops[k] + 5, x1, tops[k + 1] + 5, 11)
            draw_circle(x1, tops[k + 1] + 5, 5.5)
    draw_set_color(look["grass_top"])
    for k in range(i1 - i0 + 1):
        x0, x1 = (i0 + k) * STEP, (i0 + k + 1) * STEP
        if tops[k] == hs[i0 + k] and tops[k + 1] == hs[i0 + k + 1]:
            draw_line(x0, tops[k] + 1, x1, tops[k + 1] + 1, 3)
    # Little things on the grass: tufts, flowers, rocks (the same every time, from the point's number).
    n = stage_index(stage)
    for i in range(i0, i1 + 1):
        if (i * 37) % 11 == 0 and not in_bridge(road, i * STEP):
            draw_sprite(f"deco_{n}", (i * 7) % 4, i * STEP + 10, ground_y(road, i * STEP + 10) + 4)
    for a, b in road["bridges"]:
        if b >= cx and a <= cx + VIEW_W:
            draw_bridge(road, a, b)


def draw_bridge(road, a, b):
    y = ground_y(road, a + 1)
    draw_set_color("#5a3a22")
    for x in range(int(a), int(b), 48):                    # posts
        draw_rect(x, y - 16, x + 4, y + 14)
    draw_rect(b - 4, y - 16, b, y + 14)
    draw_line(a, y - 14, b, y - 14, 3)                    # the rail
    for x in range(int(a), int(b), 12):                    # planks
        draw_set_color("#b07a48" if (x // 12) % 2 else "#9c6a3c")
        draw_rect(x, y, x + 11, y + 8)
    draw_set_color("#5a3a22")
    draw_line(a, y + 8, b, y + 8, 2)


def draw_things(road, cx, t):
    finish = road["finish"]
    for m in RUN["signs"]:
        x = START_X + m * METRE
        if cx - 60 < x < cx + VIEW_W + 60:
            y = ground_y(road, x)
            draw_sprite("sign", 0, x, y)
            text(x, y - 58, f"{m} m", "#3a2410", 13, "center", shadow=False)
    if cx - 60 < finish < cx + VIEW_W + 60:
        draw_sprite("finish", 0, finish, ground_y(road, finish))
    best_m = best(RUN["stage"]["name"])
    if best_m:
        x = START_X + best_m * METRE
        if cx - 60 < x < cx + VIEW_W + 60:
            draw_sprite("best_flag", 0, x, ground_y(road, x))
            text(x + 4, ground_y(road, x) - 62, "Best", GOLD, 13)
    spin = (t // 5) % 6
    for c in RUN["coins"]:
        if c[2] and cx - 20 < c[0] < cx + VIEW_W + 20:
            draw_sprite("coin", spin, c[0], c[1])
    for f in RUN["fuel"]:
        if f[2] and cx - 20 < f[0] < cx + VIEW_W + 20:
            draw_sprite("fuel", 0, f[0], f[1] + math.sin(t / 12) * 2)


def draw_car(car, alpha=1.0, crashed=False, t=0):
    deg = -math.degrees(car.a)
    for w in car.wheels:
        mx, my = car.to_world(*w.mount)
        draw_set_alpha(alpha)
        draw_set_color("#3a3a46")
        draw_line(mx, my, w.x, w.y, 5)
        draw_set_alpha(1)
    for w in car.wheels:
        draw_sprite_ext(f"wheel_{car.kind}", 0, w.x, w.y, 1, 1, -math.degrees(w.spin), "white", alpha)
    draw_sprite_ext(f"body_{car.kind}", 0, car.x, car.y, 1, 1, deg, "white", alpha)
    if crashed:
        hx, hy, r = car.head()
        for k in range(3):
            a = t / 10 + k * 2.1
            draw_sprite("star", 0, hx + math.cos(a) * 14, hy - 12 + math.sin(a) * 5)


def draw_ghost(steps):
    g = RUN["ghost"]
    if not g:
        return
    path = g["path"]
    k = steps // GHOST_EVERY
    if k >= len(path):
        return
    x, y, a = path[k]
    s = VEHICLES[g["car"]]
    deg = -math.degrees(a)
    c, si = math.cos(a), math.sin(a)
    for lx, ly in s["wheels"]:
        draw_sprite_ext(f"wheel_{g['car']}", 0, x + lx * c - ly * si, y + lx * si + ly * c, 1, 1, 0, "#bfe3ff", 0.35)
    draw_sprite_ext(f"body_{g['car']}", 0, x, y, 1, 1, deg, "#bfe3ff", 0.35)


# ---------------------------------------------------------------- over it

def draw_hud(t):
    car = RUN["car"]
    # Fuel: a can and a gauge, red and blinking when it's nearly empty.
    share = car.fuel / car.stats["tank"]
    panel(6, 6, 170, 32, 0.55)
    draw_sprite("fuel_icon", 0, 12, 9)
    draw_set_color("#2a2a3a")
    draw_rect(36, 13, 162, 25)
    low = share < 0.25
    if not low or (t // 15) % 2:
        draw_rect_gradient(36, 13, 36 + 126 * share, 25, RED if low else "#ffb02e", RED if low else "#7ee05a", False)
    draw_set_color(INK)
    draw_rect(36, 13, 162, 25, True)
    if car.fuel <= 0:
        text(36, 36, "Out of fuel!", RED, 15)
    elif low:
        text(36, 36, "Low fuel", RED, 13)
    # Coins this run.
    panel(6, 56, 120, 80, 0.55)
    draw_sprite("coin", 0, 19, 68)
    text(32, 59, f"{RUN['got']}", GOLD, 16)
    # Distance, the best, and where they are on the stage.
    m = metres(car.x)
    text(VIEW_W / 2, 6, f"{m} m", INK, 24, "center")
    total = metres(RUN["road"]["finish"])
    best_m = best(RUN["stage"]["name"])
    x1, x2, y = 220, 420, 42
    draw_set_alpha(0.4)
    draw_set_color("#000000")
    draw_line(x1, y, x2, y, 4)
    draw_set_alpha(1)
    draw_set_color(INK)
    draw_line(x1, y, x1 + (x2 - x1) * min(1, m / total), y, 4)
    draw_sprite("flag_icon", 0, x2, y)
    if best_m:
        bx = x1 + (x2 - x1) * min(1, best_m / total)
        draw_set_color(GOLD)
        draw_line(bx, y - 6, bx, y + 6, 2)
        text(VIEW_W / 2, 50, f"Best {best_m} m", GOLD, 13, "center")
    draw_set_color(INK)
    draw_circle(x1 + (x2 - x1) * min(1, m / total), y, 5)
    # Bonuses, as they happen.
    for k, (words, left) in enumerate(RUN["words"]):
        draw_set_alpha(min(1, left / 20))
        text(VIEW_W / 2, 110 + k * 28, words, GOLD, 22, "center")
        draw_set_alpha(1)
    if RUN["steps"] < 240:
        text(VIEW_W - 10, VIEW_H - 26, "Right: gas    Left: brake", MINT, 14, "right")


def draw_title(t):
    panel(0, 0, VIEW_W, VIEW_H, 0.15, "#000000")
    bob = math.sin(t / 30) * 3
    text(VIEW_W / 2, 50 + bob, "RIDGELINE RALLY", GOLD, 52, "center")
    text(VIEW_W / 2, 116, "Drive as far as you can, and keep your head off the ground!", INK, 16, "center")
    panel(170, 160, 470, 250, 0.6)
    text(VIEW_W / 2, 168, "Right arrow (or G): gas", INK, 16, "center")
    text(VIEW_W / 2, 192, "Left arrow (or B): brake", INK, 16, "center")
    text(VIEW_W / 2, 216, "In the air they tip the car", MINT, 14, "center")
    if (t // 30) % 2:
        text(VIEW_W / 2, 280, "Space to start", INK, 22, "center")


def pips(x, y, n, most):
    for k in range(most):
        draw_set_color(GOLD if k < n else "#4a5470")
        draw_rect(x + k * 14, y, x + k * 14 + 10, y + 12)


def draw_garage(game, t):
    stage = STAGES[game.stage_i]
    kind = list(VEHICLES)[game.kind_i]
    draw_sprite(f"sky_{game.stage_i}", 0, 0, 0)
    draw_sprite(f"far_{game.stage_i}", 0, -((t * 0.3) % BACK_W), 60)
    draw_sprite(f"far_{game.stage_i}", 0, -((t * 0.3) % BACK_W) + BACK_W, 60)
    draw_sprite("garage", 0, 0, 0)
    # The car on its stand, big.
    v = VEHICLES[kind]
    k = 2.0
    cx, cy = 150, 236 - (v["wheels"][0][1] + v["wheel_r"]) * k
    for lx, ly in v["wheels"]:
        draw_sprite_ext(f"wheel_{kind}", 0, cx + lx * k, cy + ly * k, k, k, -t * 2, "white", 1)
    draw_sprite_ext(f"body_{kind}", 0, cx, cy, k, k, 0, "white", 1)
    text(150, 262, kind, INK, 22, "center")
    if kind not in owned_vehicles():
        text(150, 290, f"{v['price']} coins", GOLD, 16, "center")
    # The coins.
    panel(VIEW_W - 150, 8, VIEW_W - 8, 36, 0.7)
    draw_sprite("coin", 0, VIEW_W - 134, 22)
    text(VIEW_W - 118, 12, f"{wallet()}", GOLD, 18)
    # The menu.
    panel(300, 46, 632, 330, 0.78)
    levels = levels_of(kind)
    for r, row in enumerate(ROWS):
        y = 54 + r * 35
        if r == game.row:
            draw_set_alpha(0.15)
            draw_set_color("#ffffff")
            draw_rect(304, y - 4, 628, y + 30)
            draw_set_alpha(1)
            draw_set_color(GOLD)
            draw_triangle(308, y + 4, 308, y + 20, 318, y + 12)
        if row == "stage":
            text(326, y, f"<  {stage['name']}  >", INK, 18)
            if stage["name"] in owned_stages():
                if best(stage["name"]):
                    text(624, y + 3, f"Best {best(stage['name'])} m", MINT, 14, "right")
            else:
                text(624, y + 3, f"Unlock: {stage['price']}", GOLD, 14, "right")
        elif row == "vehicle":
            text(326, y, f"<  {kind}  >", INK, 18)
            if kind not in owned_vehicles():
                text(624, y + 3, f"Buy: {v['price']}", GOLD, 14, "right")
        elif row == "go":
            ready = stage["name"] in owned_stages() and kind in owned_vehicles()
            draw_set_color("#3ec46d" if ready else "#555a66")
            draw_rect(326, y - 2, 470, y + 26)
            text(398, y + 1, "DRIVE!", INK, 20, "center")
        else:
            text(326, y + 2, row.capitalize(), INK, 16)
            n = levels.get(row, 0)
            pips(440, y + 5, n, len(UPGRADES[row]["prices"]))
            price = upgrade_price(kind, row)
            text(624, y + 3, "MAX" if price is None else f"{price}", GOLD, 14, "right")
    if game.msg:
        text(466, 304, game.msg, RED if game.msg_bad else MINT, 15, "center")
    text(150, 312, "Up/down: pick a row   Left/right: change", "#e8ecf4", 12, "center")
    text(150, 330, "Space: buy, or drive!", "#e8ecf4", 12, "center")


def draw_over(game, t):
    panel(140, 60, 500, 300, 0.85)
    text(VIEW_W / 2, 74, end_words(), RED if RUN["end"] in ("head", "fuel") else GOLD, 20, "center")
    text(VIEW_W / 2, 112, f"{RUN['furthest']} m", INK, 40, "center")
    if RUN["new_best"]:
        text(VIEW_W / 2, 162, "New best distance!", GOLD, 18, "center")
    else:
        text(VIEW_W / 2, 162, f"Best {best(RUN['stage']['name'])} m", MINT, 16, "center")
    draw_sprite("coin", 0, 270, 206)
    text(288, 195, f"+{RUN['got']} coins", GOLD, 20)
    if RUN["flips"]:
        text(VIEW_W / 2, 228, f"{RUN['flips']} flip{'s' if RUN['flips'] > 1 else ''}", MINT, 14, "center")
    if t > 30:
        text(VIEW_W / 2, 264, "Space for the garage", INK, 16, "center")
