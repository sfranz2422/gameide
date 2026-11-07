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


SCENE_SHOWN = [None]   # which track's scenery is standing now: a new race on it keeps it


def place_scenery(track_i):
    """Makes the track's hedges, trees, item boxes and boost pads, from its numbers. A hedge is laid
    every HEDGE_GAP pixels along the hedge line itself, not along the road: on
    the outside of a bend the line is longer, and hedges spaced by the road
    left gaps there a kart could drive through."""
    if SCENE_SHOWN[0] == track_i:
        for box in instances("ItemBox"):
            box.ready = True
        return
    SCENE_SHOWN[0] = track_i
    for name in ("Scenery", "BoostPad"):
        for old in instances(name):
            old.destroy()
    track = TRACKS[track_i]
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
            hedge.sprite = f"bush_{track_i}"
            hedge.image_index = count % 3
            hedge.image_angle = math.degrees(math.atan2(-ty, tx))
            hedge.x = x                # (a box that turned is only seen once it has moved)
            if count % 5 == 0:
                back = far + 68 + (count * 13) % 70
                tree_x, tree_y = cx - ty * side * back, cy + tx * side * back
                clear = min((tree_x - p[0]) ** 2 + (tree_y - p[1]) ** 2 for p in line[::3]) > (wall + 30) ** 2
                if clear and 0 < tree_x < track["size"] and 0 < tree_y < track["size"]:
                    tree = instance_create(tree_x, tree_y, "Tree")
                    tree.sprite = f"tree_{track_i}"
                    tree.image_index = count % 3
    # Across the road, a row of four boxes; and the pads, where the build paints them.
    for where in track["boxes"]:
        i = int(where * n)
        ax, ay = line[i]
        bx, by = line[(i + 1) % n]
        tx, ty = (bx - ax) / STEP, (by - ay) / STEP
        for lane in (-0.6, -0.2, 0.2, 0.6):
            instance_create(ax - ty * lane * track["half"], ay + tx * lane * track["half"], "ItemBox")
    for x, y, a in pad_places(track):
        pad = instance_create(x, y, "BoostPad")
        pad.image_angle = a
        pad.x = x                      # (a box that turned is only seen once it has moved)


def pad_places(track):
    """Where each boost pad is, and which way it points. The build paints them from this too."""
    line = centre_line(track)
    n = len(line)
    out = []
    for where, lane in track["pads"]:
        i = int(where * n)
        ax, ay = line[i]
        bx, by = line[(i + 1) % n]
        tx, ty = (bx - ax) / STEP, (by - ay) / STEP
        out.append((ax - ty * lane * track["half"], ay + tx * lane * track["half"], math.degrees(math.atan2(-ty, tx))))
    return out


def kart_frame(kart, cam_x, cam_y):
    """Which of the 16 views: how far its nose is turned from the line the camera sees it along."""
    seen = math.degrees(math.atan2(-(kart.y - cam_y), kart.x - cam_x))
    return round(((kart.a + kart.spin_a - seen) % 360) / (360 / FRAMES)) % FRAMES


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
        draw_circle(VIEW_W - 118 + 4 + kart.x * k, 8 + 4 + kart.y * k, 4 if kart.player else 2.5)


def draw_hud(t):
    r = RACE
    you = r["karts"][0]
    laps = r["track"]["laps"]
    if r["rivals"]:
        text(14, 10, ordinal(you.place), GOLD if you.place <= 3 else INK, 38)
    else:
        text(14, 20, "Time trial", MINT, 18)
    text(14, 56, f"Lap {min(laps, max(1, you.lap))}/{laps}", INK, 18)
    text(14, 80, clock(r["steps"]), INK, 16)
    draw_map(r["track_i"])
    # What you're holding, and in a time trial how many turbos are left.
    draw_set_alpha(0.6)
    draw_set_color(SHADOW)
    draw_rect(VIEW_W / 2 - 30, 8, VIEW_W / 2 + 30, 68)
    draw_set_alpha(1)
    held = you.item or ("turbo" if you.turbos else None)
    if held:
        draw_sprite("items", ITEMS.index(held), VIEW_W / 2 - 24, 14)
    if you.turbos:
        text(VIEW_W / 2 + 26, 50, str(you.turbos), INK, 14, "right")
    if r["rivals"] is False and r["lap_times"]:
        text(14, 104, "Last lap " + clock(r["lap_times"][-1]), MINT, 13)
    # Speed, as a bar: it goes orange on a boost.
    draw_set_color(SHADOW)
    draw_rect(14, VIEW_H - 24, 134, VIEW_H - 12)
    draw_set_color("#ff9a2e" if you.boost > 0 else MINT)
    draw_rect(16, VIEW_H - 22, 16 + 116 * min(1, abs(you.v) / STATS["boost_top"]), VIEW_H - 14)
    if question_waiting():
        text(VIEW_W / 2, VIEW_H - 44, "Python question after this race", GOLD, 15, "center")
    if r["wrong_way"] > 50 and t % 40 < 26:
        text(VIEW_W / 2, 150, "WRONG WAY", RED, 34, "center")
    if r["count"] > 0:
        text(VIEW_W / 2, 130, str(math.ceil(r["count"] / 60)), GOLD, 72, "center")
    elif r["steps"] < 50:
        text(VIEW_W / 2, 130, "GO!", MINT, 72, "center")


def draw_title(t, cup_best):
    draw_set_alpha(0.55)
    draw_set_color(SHADOW)
    draw_rect(0, 60, VIEW_W, 196)
    draw_set_alpha(1)
    text(VIEW_W / 2, 72, "Zoomtown Cup", GOLD, 58, "center")
    text(VIEW_W / 2, 146, "Press Space to race", INK if t % 60 < 42 else MINT, 20, "center")
    if cup_best:
        text(VIEW_W / 2, 172, "Best cup: " + ordinal(cup_best), GOLD, 14, "center")
    text(VIEW_W / 2, VIEW_H - 70, "Arrows steer. Up or X is the gas, Down is the brake, Space uses an item.", INK, 13, "center")
    text(VIEW_W / 2, VIEW_H - 48, "Hold Z through a corner to drift, and let go for a boost.", INK, 13, "center")


def bar(x, y, value, colour=MINT):
    draw_set_color(SHADOW)
    draw_rect(x, y, x + 100, y + 8)
    draw_set_color(colour)
    draw_rect(x + 1, y + 1, x + 1 + 98 * max(0.05, min(1, value)), y + 7)


def draw_menu(game, t):
    draw_set_alpha(0.78)
    draw_set_color(SHADOW)
    draw_rect(60, 24, VIEW_W - 60, VIEW_H - 24)
    draw_set_alpha(1)
    text(VIEW_W / 2, 32, "Ready to race", GOLD, 28, "center")
    rows = menu_rows(game)
    words = {"mode": MODES[game.mode_i], "racer": RACERS[game.racer]["name"], "go": "GO!",
             "track": TRACKS[game.track_i]["name"]}
    y = 84
    for i, row in enumerate(rows):
        on = i == game.row
        c = GOLD if on else INK
        if row == "go":
            text(VIEW_W / 2, y + 150 - 40 * i + 40 * (len(rows) - 2), "GO!", MINT if on and t % 40 < 26 else c, 26, "center")
            continue
        text(90, y, row.capitalize(), c, 16)
        text(200, y, ("< " if on else "  ") + words[row] + (" >" if on else ""), c, 16)
        y += 34
    # The racer, turning slowly, and how they drive.
    racer = RACERS[game.racer]
    draw_sprite_ext(f"kart_{game.racer}", t // 12, VIEW_W - 150, 150, 1.5, 1.5)
    for k, (word, value) in enumerate((("Speed", (racer["top"] - 0.9) / 0.16), ("Pick-up", (racer["accel"] - 0.7) / 0.6), ("Turning", (racer["turn"] - 0.8) / 0.4))):
        text(VIEW_W - 290, 186 + k * 22, word, INK, 13)
        bar(VIEW_W - 200, 192 + k * 22, value)
    if MODES[game.mode_i] == "Time trial":
        best = save_get("best_" + TRACKS[game.track_i]["name"])
        if best:
            text(90, y + 4, "Best: " + clock(best), MINT, 14)


def draw_results(game, t):
    r = RACE
    draw_set_alpha(0.72)
    draw_set_color(SHADOW)
    draw_rect(120, 34, VIEW_W - 120, VIEW_H - 34)
    draw_set_alpha(1)
    you = r["karts"][0]
    if r["rivals"]:
        text(VIEW_W / 2, 44, f"You came {ordinal(you.place)}!", GOLD, 30, "center")
        y = 88
        for p, kart in enumerate(r["final"]):
            c = GOLD if kart.player else INK
            text(170, y, f"{p + 1}.  {RACERS[kart.who]['name']}", c, 16)
            text(VIEW_W - 170, y, clock(kart.done) if kart.done else "...", c, 16, "right")
            y += 22
    else:
        text(VIEW_W / 2, 44, clock(you.done), GOLD, 34, "center")
        y = 96
        for k, lap in enumerate(r["lap_times"]):
            text(VIEW_W / 2, y, f"Lap {k + 1}   {clock(lap)}", INK, 16, "center")
            y += 24
    if game.new_best:
        text(VIEW_W / 2, VIEW_H - 74, "A new best time!", MINT, 16, "center")
    elif game.best:
        text(VIEW_W / 2, VIEW_H - 74, "Your best: " + clock(game.best), INK, 14, "center")
    if t > 40:
        text(VIEW_W / 2, VIEW_H - 52, "Press Space", INK if t % 60 < 42 else MINT, 16, "center")


def draw_standings(game, t):
    """The cup so far, or at the end of it, how it finished."""
    draw_set_alpha(0.78)
    draw_set_color(SHADOW)
    draw_rect(120, 24, VIEW_W - 120, VIEW_H - 24)
    draw_set_alpha(1)
    over = game.cup_race >= len(TRACKS)
    table = cup_table(game)
    place = next(i for i, w in enumerate(table) if w == game.racer) + 1
    if over:
        text(VIEW_W / 2, 32, "You won the cup!" if place == 1 else f"You came {ordinal(place)} in the cup", GOLD, 26, "center")
    else:
        text(VIEW_W / 2, 32, f"After race {game.cup_race} of {len(TRACKS)}", GOLD, 24, "center")
    y = 74
    for p, who in enumerate(table):
        c = GOLD if who == game.racer else INK
        text(170, y, f"{p + 1}.  {RACERS[who]['name']}", c, 16)
        text(VIEW_W - 170, y, str(game.cup_points[who]), c, 16, "right")
        y += 24
    if t > 40:
        words = "Press Space" if over else "Next: " + TRACKS[game.cup_race]["name"]
        text(VIEW_W / 2, VIEW_H - 54, words, INK if t % 60 < 42 else MINT, 16, "center")
