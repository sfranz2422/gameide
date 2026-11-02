# script: screen
# Drawing. The world is one floor (draw_floor: the track's picture, seen from
# just behind the kart), the sky over it, and everything standing on the
# track drawn furthest first, each at the size floor_point says. The numbers
# and menus are Draw GUI.
import math

VIEW_W, VIEW_H = 640, 360
HORIZON = 118          # the screen row where the road ends and the sky starts
CAM_HEIGHT = 30        # the camera's height over the road, in picture pixels
CAM_BACK = 62          # how far behind the kart it follows
FOCAL = 300
KART_WORLD = 22        # a kart is this many picture pixels wide
KART_W = 96            # its picture is this many pixels wide
SKY_W = 1024           # the sky's picture is this wide, and repeats
INK, SHADOW, GOLD, RED, MINT = "#ffffff", "#17172a", "#ffd23f", "#ff5a4f", "#9ff0c0"
FRAMES = 16            # one view of a kart for every 22.5 degrees
HEDGE_LOW = 0.62       # how squat a hedge is drawn
BUSH_W, TREE_W = 192, 128  # the width of those pictures


def scenery_of(track):
    """What stands beside the road: a hedge down each side, and trees behind it.
    Worked out from the road, so it moves with it. Each is [x, y, sprite, frame,
    width on the track, width of its picture]."""
    line = centre_line(track)
    n = len(line)
    wall = track["half"] + track["verge"]
    out = []
    for i in range(0, n, 4):
        ax, ay = line[i]
        bx, by = line[(i + 1) % n]
        nx, ny = -(by - ay) / STEP, (bx - ax) / STEP
        for side in (-1, 1):
            for far, sprite, world, width in ((wall + 22, "bush", 72, BUSH_W), (wall + 90 + (i * 13) % 70, "tree", 92, TREE_W)):
                if sprite == "tree" and (i + side) % 12:
                    continue
                x, y = ax + nx * side * far, ay + ny * side * far
                # A bend's inside or another stretch of road: nothing stands on the road.
                near = min((x - p[0]) ** 2 + (y - p[1]) ** 2 for p in line[::3])
                if near < (wall + 12) ** 2 or not (0 < x < track["size"] and 0 < y < track["size"]):
                    continue
                out.append([x, y, sprite, (i // 4) % 3, world, width])
    return out


SCENERY = [scenery_of(t) for t in TRACKS]


def text(x, y, words, colour=INK, size=16, align="left"):
    draw_set_font(None, size)
    draw_set_halign(align)
    draw_set_color(SHADOW)
    draw_text(x + 2, y + 2, words)
    draw_set_color(colour)
    draw_text(x, y, words)
    draw_set_halign("left")


def clock(steps):
    s = steps / 60
    return f"{int(s // 60)}:{s % 60:05.2f}"


def ordinal(n):
    return {1: "1st", 2: "2nd", 3: "3rd"}.get(n, f"{n}th")


def move_camera(cam, kart, snap=False):
    """The camera swings after the kart rather than turning with it: that lag is
    what shows the kart's side as it turns, and more of it on a drift."""
    d = angle_diff(kart.a, cam["a"])
    cam["a"] = (kart.a if snap else cam["a"] + d * 0.11) % 360
    r = math.radians(cam["a"])
    cam["x"], cam["y"] = kart.x - math.cos(r) * CAM_BACK, kart.y + math.sin(r) * CAM_BACK


def draw_world(cam, t):
    track_i = RACE["track_i"]
    # The sky slides as you turn: a whole turn is a whole picture.
    sx = -(cam["a"] / 360 * SKY_W * 2) % SKY_W
    draw_sprite(f"sky_{track_i}", 0, sx - SKY_W, 0)
    draw_sprite(f"sky_{track_i}", 0, sx, 0)
    draw_floor(f"track_{track_i}", 0, cam["x"], cam["y"], cam["a"], CAM_HEIGHT, HORIZON, FOCAL, RACE["track"]["look"]["hedge"])

    things = []
    fx, fy = math.cos(math.radians(cam["a"])), -math.sin(math.radians(cam["a"]))
    for kart in RACE["karts"]:
        things.append(((kart.x - cam["x"]) * fx + (kart.y - cam["y"]) * fy, 0, kart))
    for s in SCENERY[track_i]:
        dx, dy = s[0] - cam["x"], s[1] - cam["y"]
        d = dx * fx + dy * fy
        # Only what's in view: a hundred sprites a frame is fine, four hundred isn't.
        if 12 < d < 900 and abs(dx * -fy + dy * fx) < d * (VIEW_W / 2 / FOCAL) + 60:
            things.append((d, 1, s))
    things.sort(key=lambda th: -th[0])
    for d, kind, thing in things:
        if kind == 0:
            draw_kart(thing, cam, t)
        else:
            at = floor_point(thing[0], thing[1])
            if at:
                sprite, frame, world, width = thing[2], thing[3], thing[4], thing[5]
                k = at[2] * world / width
                # A hedge is lower than the camera, or it would hide everything beyond it.
                draw_sprite_ext(sprite, frame, at[0], at[1], k, k * (HEDGE_LOW if sprite == "bush" else 1))


def kart_frame(kart, cam_x, cam_y):
    """Which of the 16 views: how far its nose is turned from the line the camera sees it along."""
    seen = math.degrees(math.atan2(-(kart.y - cam_y), kart.x - cam_x))
    return round(((kart.a - seen) % 360) / (360 / FRAMES)) % FRAMES


def draw_kart(kart, cam, t):
    at = floor_point(kart.x, kart.y)
    if not at:
        return
    sx, sy, scale = at
    if sx < -80 or sx > VIEW_W + 80 or sy < HORIZON:
        return
    k = scale * KART_WORLD / KART_W
    # Its shadow, then a little bounce on a bumpy surface.
    draw_set_alpha(0.3)
    draw_set_color("black")
    w = 9.5 * scale
    draw_ellipse(sx - w, sy - w * 0.16, sx + w, sy + w * 0.16)
    draw_set_alpha(1)
    hop = -scale * 0.6 if kart.on_grass and t % 6 < 3 and kart.v > 0.6 else 0
    draw_sprite_ext(f"kart_{kart.who}", kart_frame(kart, cam["x"], cam["y"]), sx, sy + hop, k, k)
    # Sparks from the back wheels: a drift's colour says the boost it has earned.
    if kart.drift and kart.charge >= SPARK_1:
        colour = "#ff9a2e" if kart.charge >= SPARK_2 else "#58c8ff"
        draw_set_color(colour)
        for q in range(4):
            px = sx + (-1 if q % 2 else 1) * (6 + (t * 7 + q * 5) % 7) * scale
            py = sy - (t * 5 + q * 3) % 8 * scale * 0.4
            draw_circle(px, py, 1 + scale * 0.25)


def draw_map(track_i, t):
    draw_set_alpha(0.85)
    draw_sprite(f"map_{track_i}", 0, VIEW_W - 118, 8)
    draw_set_alpha(1)
    k = 110 / RACE["track"]["size"]
    for kart in reversed(RACE["karts"]):
        draw_set_color(RACERS[kart.who]["paint"])
        draw_circle(VIEW_W - 118 + 4 + kart.x * k, 8 + 4 + kart.y * k, 4 if kart.who == 0 else 2.5)


def draw_hud(t):
    r = RACE
    you = r["karts"][0]
    laps = r["track"]["laps"]
    text(14, 10, ordinal(you.place), GOLD if you.place <= 3 else INK, 38)
    text(14, 56, f"Lap {min(laps, max(1, you.lap))}/{laps}", INK, 18)
    text(14, 80, clock(r["steps"]), INK, 16)
    draw_map(r["track_i"], t)
    # Speed, as a bar: it goes orange on a boost.
    draw_set_color(SHADOW)
    draw_rect(14, VIEW_H - 24, 134, VIEW_H - 12)
    draw_set_color("#ff9a2e" if you.boost > 0 else MINT)
    draw_rect(16, VIEW_H - 22, 16 + 116 * min(1, abs(you.v) / STATS["boost_top"]), VIEW_H - 14)
    if r["wrong_way"] > 50 and t % 40 < 26:
        text(VIEW_W / 2, 150, "WRONG WAY", RED, 34, "center")
    if r["count"] > 0:
        n = math.ceil(r["count"] / 60)
        text(VIEW_W / 2, 130, str(n), GOLD, 72, "center")
    elif r["steps"] < 50:
        text(VIEW_W / 2, 130, "GO!", MINT, 72, "center")


def draw_title(t):
    draw_set_alpha(0.55)
    draw_set_color(SHADOW)
    draw_rect(0, 60, VIEW_W, 196)
    draw_set_alpha(1)
    text(VIEW_W / 2, 72, "Zoomtown Cup", GOLD, 58, "center")
    text(VIEW_W / 2, 146, "Press Space to race", INK if t % 60 < 42 else MINT, 20, "center")
    text(VIEW_W / 2, VIEW_H - 62, "Arrows steer. Up or X is the gas, Down is the brake.", INK, 14, "center")
    text(VIEW_W / 2, VIEW_H - 40, "Hold Z through a corner to drift, and let go for a boost.", INK, 14, "center")


def draw_results(game, t):
    r = RACE
    draw_set_alpha(0.72)
    draw_set_color(SHADOW)
    draw_rect(120, 34, VIEW_W - 120, VIEW_H - 34)
    draw_set_alpha(1)
    you = r["karts"][0]
    text(VIEW_W / 2, 44, f"You came {ordinal(you.place)}!", GOLD, 30, "center")
    y = 88
    for kart in sorted(r["karts"], key=lambda c: c.place):
        racer = RACERS[kart.who]
        c = GOLD if kart.who == 0 else INK
        text(170, y, f"{kart.place}.  {racer['name']}", c, 16)
        text(VIEW_W - 170, y, clock(kart.done) if kart.done else "...", c, 16, "right")
        y += 22
    if game.new_best:
        text(VIEW_W / 2, VIEW_H - 74, "A new best time!", MINT, 16, "center")
    elif game.best:
        text(VIEW_W / 2, VIEW_H - 74, "Your best: " + clock(game.best), INK, 14, "center")
    if t > 40:
        text(VIEW_W / 2, VIEW_H - 52, "Press Space", INK if t % 60 < 42 else MINT, 16, "center")
