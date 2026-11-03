# script: screen
# The numbers behind the view, what stands beside the road, and the words
# and map over it. The floor and sky are drawn by the Game object; each kart,
# hedge and tree draws itself on it, in its own Draw event, at the size
# floor_point says.
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
HEDGE_LONG = 72        # how long a hedge is on the track, in picture pixels
HEDGE_GAP = 58         # one every this many pixels: shorter than a hedge, so they overlap
FAR = 0.33             # things smaller than this scale aren't drawn: too far away to see
NEAR = 25              # ...nor bigger than this: the camera is inside them


def place_scenery(track):
    """Makes the track's Hedge and Tree instances, from its road. A hedge is laid
    every HEDGE_GAP pixels along the hedge line itself, not along the road: on
    the outside of a bend the line is longer, and hedges spaced by the road
    left gaps there a kart could drive through."""
    line = centre_line(track)
    n = len(line)
    wall = track["half"] + track["verge"]
    far = wall + 22                # the hedge's middle: its box starts at the wall
    for side in (-1, 1):
        last, count = None, 0
        # A quarter of a road step at a time: on a tight bend's outside one whole
        # step of road is a long way along the hedge line, and hedges laid at whole
        # steps came out further apart than they are long, with gaps between.
        for q in range(n * 4):
            i, part = q // 4, (q % 4) / 4
            ax, ay = line[i]
            bx, by = line[(i + 1) % n]
            tx, ty = (bx - ax) / STEP, (by - ay) / STEP
            cx, cy = ax + (bx - ax) * part, ay + (by - ay) * part
            x, y = cx - ty * side * far, cy + tx * side * far
            if last is not None and math.hypot(x - last[0], y - last[1]) < HEDGE_GAP:
                continue
            # A bend's inside or another stretch of road: nothing stands on the road.
            if min((x - p[0]) ** 2 + (y - p[1]) ** 2 for p in line[::3]) < (wall + 12) ** 2:
                continue
            last = (x, y)
            count += 1
            hedge = instance_create(x, y, "Hedge")
            hedge.image_index = count % 3
            hedge.image_angle = math.degrees(math.atan2(-ty, tx))
            hedge.x = x                # (a box that turned is only seen once it has moved)
            if count % 5 == 0:
                back = far + 68 + (count * 13) % 70
                tree_x, tree_y = cx - ty * side * back, cy + tx * side * back
                clear = min((tree_x - p[0]) ** 2 + (tree_y - p[1]) ** 2 for p in line[::3]) > (wall + 30) ** 2
                if clear and 0 < tree_x < track["size"] and 0 < tree_y < track["size"]:
                    instance_create(tree_x, tree_y, "Tree").image_index = count % 3


def kart_frame(kart, cam_x, cam_y):
    """Which of the 16 views: how far its nose is turned from the line the camera sees it along."""
    seen = math.degrees(math.atan2(-(kart.y - cam_y), kart.x - cam_x))
    return round(((kart.a - seen) % 360) / (360 / FRAMES)) % FRAMES


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


def draw_map(track_i):
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
    draw_map(r["track_i"])
    # Speed, as a bar: it goes orange on a boost.
    draw_set_color(SHADOW)
    draw_rect(14, VIEW_H - 24, 134, VIEW_H - 12)
    draw_set_color("#ff9a2e" if you.boost > 0 else MINT)
    draw_rect(16, VIEW_H - 22, 16 + 116 * min(1, abs(you.v) / STATS["boost_top"]), VIEW_H - 14)
    if r["wrong_way"] > 50 and t % 40 < 26:
        text(VIEW_W / 2, 150, "WRONG WAY", RED, 34, "center")
    if r["count"] > 0:
        text(VIEW_W / 2, 130, str(math.ceil(r["count"] / 60)), GOLD, 72, "center")
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
        c = GOLD if kart.who == 0 else INK
        text(170, y, f"{kart.place}.  {RACERS[kart.who]['name']}", c, 16)
        text(VIEW_W - 170, y, clock(kart.done) if kart.done else "...", c, 16, "right")
        y += 22
    if game.new_best:
        text(VIEW_W / 2, VIEW_H - 74, "A new best time!", MINT, 16, "center")
    elif game.best:
        text(VIEW_W / 2, VIEW_H - 74, "Your best: " + clock(game.best), INK, 14, "center")
    if t > 40:
        text(VIEW_W / 2, VIEW_H - 52, "Press Space", INK if t % 60 < 42 else MINT, 16, "center")
