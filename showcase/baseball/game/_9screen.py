# script: screen
# Drawing. The view from behind the plate (project() turns feet into the
# screen, the same way build.py painted the field), the map of the field a
# hit is followed on, and everything over them: the scoreboard, the count,
# the menus.
import math

INK, PAPER, GOLD, GRASS = "#ffffff", "#0b1a2e", "#facc15", "#a7f3d0"
PITCH_NAMES_Y = 326


def panel(x1, y1, x2, y2, alpha=0.75):
    draw_set_alpha(alpha)
    draw_set_color(PAPER)
    draw_rect(x1, y1, x2, y2)
    draw_set_alpha(1)


def text(x, y, words, colour=INK, size=16, align="left"):
    draw_set_font(None, size)
    draw_set_halign(align)
    draw_set_color("#000000")
    draw_text(x + 1, y + 1, words)
    draw_set_color(colour)
    draw_text(x, y, words)
    draw_set_halign("left")


# ---------------------------------------------------------------- behind the plate

def project(x, y, z):
    """Feet on the field to the screen, seen from behind the plate: (x, y on
    the screen, pixels a foot there)."""
    k = CAM_FOCAL / max(1, y + CAM_BACK)
    return CAM_MIDDLE + x * k, CAM_HORIZON + (CAM_HIGH - z) * k, k


def draw_ball_3d(x, y, z):
    sx, sy, k = project(x, y, 0)
    draw_set_alpha(0.35)
    draw_set_color("#000000")
    draw_ellipse(sx - 0.2 * k, sy - 0.07 * k, sx + 0.2 * k, sy + 0.07 * k)
    draw_set_alpha(1)
    sx, sy, k = project(x, y, z)
    r = max(1.5, 0.13 * k)
    draw_set_color("#9ca3af")
    draw_circle(sx, sy, r + 0.6)
    draw_set_color("#fafafa")
    draw_circle(sx, sy, r)
    if r > 3:
        draw_set_color("#dc2626")
        draw_line(sx - r * 0.5, sy - r * 0.6, sx - r * 0.2, sy + r * 0.6, 1)
        draw_line(sx + r * 0.5, sy - r * 0.6, sx + r * 0.2, sy + r * 0.6, 1)


def draw_figure(sprite, frame, x, y, art_k):
    """A figure standing at (x, y) on the field, made bigger or smaller with
    distance; art_k is the pixels a foot it was drawn at."""
    sx, sy, k = project(x, y, 0)
    s = k / art_k
    draw_sprite_ext(sprite, frame, sx, sy, s, s, 0, "white", 1)


def batter_frame(game):
    """Stance, stride, swing, contact, follow-through: by how long ago Swing was pressed."""
    if AB.get("swung_at") is None:
        return 0
    since = game.t - AB["swung_at"]
    return 1 if since < 3 else 2 if since < 6 else 3 if since < 11 else 4


def pitcher_frame(game):
    if game.mode == "windup":
        return 1 if game.t - game.since < WINDUP_STEPS * 0.6 else 2
    if game.mode in ("pitch", "hit", "result") and AB.get("pitch"):
        return 3
    return 0


def draw_plate_view(game):
    draw_sprite("plate_view", 0, 0, 0)
    field_team = pitching_team()
    # The shortstop and the second baseman. (The centre fielder is right
    # behind the pitcher from here, and drawn there he looked like part of him.)
    for f in (4, 3):
        name, (x, y), _ = FIELDERS[f]
        far = project(x, y, 0)[2] < 5.5
        draw_figure(f"fielder_{field_team}", 1 if far else 0, x, y, 2.05 if far else 3.8)
    draw_figure(f"pitcher_{field_team}", pitcher_frame(game), 0, 60.5, 6.8)
    draw_zone()
    draw_figure(f"batter_{batting_team()}", batter_frame(game), BATTER_AT, 0, 17)
    p = AB.get("pitch")
    if game.mode == "pitch" and p:
        draw_ball_3d(*ball_at(p, AB["t"] / p["steps"]))
    if game.mode == "hit":
        draw_hit_streak()
    if game.mode == "result" and p and AB.get("hit") is None:
        x, y, z = ball_at(p, 1)                         # where it crossed: a ring, like the TV's
        sx, sy, k = project(x, 0, z)
        draw_set_color(GOLD if is_strike(p["x"], p["z"]) else "#93c5fd")
        draw_circle(sx, sy, 0.15 * k, True)


def draw_hit_streak():
    """A hit, the moment it leaves the bat: a streak from the bat to the
    ball. A fly ball is off the top of the screen in a moment (the camera's
    only 8 feet up), so then the streak stops at the top edge, where the
    ball went out."""
    path = AB["flight"]["path"]
    k = min(AB["k"], len(path) - 1)
    x0, y0 = project(*path[0])[:2]
    x1, y1, s = project(*path[k])
    top = 18
    if y1 < top:
        x1 = x0 + (x1 - x0) * (y0 - top) / (y0 - y1)
        y1, s = top, 18
    draw_set_alpha(0.35)
    draw_set_color("#fef9c3")
    draw_line(x0, y0, x1, y1, 7)
    draw_set_alpha(0.9)
    draw_line(x0, y0, x1, y1, 2)
    draw_set_alpha(1)
    draw_set_color("#fafafa")
    draw_circle(x1, y1, max(2.5, 0.13 * s))


def draw_zone():
    """The strike zone, faintly; the batter's swing (a person's) as a bar
    across it, and a person pitching sees the target."""
    x1, y1, k = project(-PLATE_HALF, 0, ZONE_HIGH)
    x2, y2, _ = project(PLATE_HALF, 0, ZONE_LOW)
    draw_set_alpha(0.5)
    draw_set_color(INK)
    draw_rect(x1, y1, x2, y2, True)
    draw_set_alpha(1)
    c = batter_is()
    if c is not None and MATCH.get("aim") is not None:
        aim = AB["aim"] if AB.get("aim") is not None else MATCH["aim"]
        _, ay, _ = project(0, 0, aim)
        reach = BAT_REACH * k
        draw_set_alpha(0.18)
        draw_set_color(GOLD)
        draw_rect(x1 - 20, ay - reach, x2 + 20, ay + reach)
        draw_set_alpha(0.9)
        draw_line(x1 - 24, ay, x2 + 24, ay, 2)
        draw_set_alpha(1)
    if pitcher_is() is not None and not MATCH.get("two") and AB.get("pitch") is None:
        tx, tz = AB["target"]
        sx, sy, _ = project(tx, 0, tz)
        draw_set_color(PITCHES[AB["kind"]]["colour"])
        draw_circle(sx, sy, 7, True)
        draw_line(sx - 11, sy, sx + 11, sy, 1)
        draw_line(sx, sy - 11, sx, sy + 11, 1)


def draw_secret_target():
    """With two on one keyboard the batter can see the screen too: the
    pitcher's target goes in a small box on the pitcher's own side, for the
    pitcher to glance at (no peeking)."""
    c = pitcher_is()
    if c is None or not MATCH.get("two") or AB.get("pitch") is not None:
        return
    x0 = 12 if c == 0 else VIEW_W - 92
    y0 = 196
    panel(x0, y0, x0 + 80, y0 + 104, 0.8)
    text(x0 + 40, y0 + 2, "your aim", GRASS, 11, "center")
    k = 16
    cx, cy = x0 + 40, y0 + 64
    draw_set_color(INK)
    draw_rect(cx - PLATE_HALF * k, cy - (ZONE_HIGH - 2.5) * k, cx + PLATE_HALF * k, cy - (ZONE_LOW - 2.5) * k, True)
    tx, tz = AB["target"]
    draw_set_color(PITCHES[AB["kind"]]["colour"])
    draw_circle(cx + tx * k, cy - (tz - 2.5) * k, 4)


# ---------------------------------------------------------------- the field from above

def to_map(x, y):
    return MAP_X + x * MAP_K, MAP_Y - y * MAP_K


def along_bases(base, feet):
    """A runner's spot on the map, `feet` along the base paths from base number `base`."""
    leg = int(feet // 90)
    a, b = BASES[(base + leg) % 4], BASES[(base + leg + 1) % 4]
    k = (feet - leg * 90) / 90
    return to_map(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)


def draw_field_view(game):
    draw_sprite("field_map", 0, 0, 0)
    path = AB["flight"]["path"]
    play = AB["play"]
    k = min(AB["k"], len(path) - 1)
    seconds = (AB["k"] + 1) * STEP
    bx, by, bz = path[k]
    ball_x, ball_y = to_map(bx, by)
    # Runners first, under the fielders.
    for start, end in AB["runners"]:
        feet = clamp((seconds - RUN_START) * RUN, 0, (end - start) * 90)
        rx, ry = along_bases(start, feet)
        ahead = along_bases(start, min((end - start) * 90, feet + 10)) if end > start else (rx, ry - 1)
        draw_sprite_ext(f"map_{batting_team()}", 0, rx, ry, 0.7, 0.7, point_direction(rx, ry, *ahead), "white", 1)
    # The fielders: the one making the play runs to it, the rest turn to watch.
    for f, (name, (x, y), speed) in enumerate(FIELDERS):
        fx, fy = to_map(x, y)
        if f == play.get("fielder"):
            cx, cy, _ = path[min(play["step"], len(path) - 1)]
            tx, ty = to_map(cx, cy)
            gone = max(0, seconds - REACT) * speed * MAP_K
            d = point_distance(fx, fy, tx, ty)
            if d > 0:
                step = min(d, gone)
                fx, fy = fx + (tx - fx) * step / d, fy + (ty - fy) * step / d
        look = point_direction(fx, fy, ball_x, ball_y)
        draw_sprite_ext(f"map_{pitching_team()}", 0, fx, fy, 0.7, 0.7, look, "white", 1)
    # The ball: its shadow on the grass, and the ball above it, bigger the higher it is.
    caught = play["result"] == "out" and AB["k"] >= play["step"] and play["step"] < (AB["flight"]["landed"] or 10 ** 9)
    if not caught:
        draw_set_alpha(0.4)
        draw_set_color("#000000")
        draw_circle(ball_x, ball_y, 2.5)
        draw_set_alpha(1)
        r = 2.5 + bz / 25
        draw_set_color("#fafafa")
        draw_circle(ball_x, ball_y - bz * MAP_K * 0.5, r)
    landed = AB["flight"]["landed"]
    if landed is not None and k >= landed and play["result"] != "homer":
        lx, ly, _ = path[landed]
        mx, my = to_map(lx, ly)
        draw_set_color(GOLD)
        draw_circle(mx, my, 4, True)
        text(mx, my + 6, f"{play['feet']} ft", GOLD, 13, "center")
    if play["result"] == "homer":
        far = math.hypot(bx, by)
        text(clamp(ball_x, 60, VIEW_W - 60), clamp(ball_y - bz * MAP_K * 0.5 - 24, 6, 300),
             f"{round(far)} ft", GOLD, 16, "center")


# ---------------------------------------------------------------- over everything

def base_diamond(x, y, bases, size=9):
    """The three bases as little diamonds, lit where there's a runner."""
    for b, (dx, dy) in enumerate(((1, 0), (0, -1), (-1, 0))):
        cx, cy = x + dx * size * 1.5, y + dy * size * 1.5
        draw_set_color(GOLD if bases[b] else "#334155")
        draw_triangle(cx, cy - size * 0.7, cx + size * 0.7, cy, cx - size * 0.7, cy)
        draw_triangle(cx, cy + size * 0.7, cx + size * 0.7, cy, cx - size * 0.7, cy)


def dots(x, y, n, of, colour):
    for i in range(of):
        draw_set_color(colour if i < n else "#334155")
        draw_circle(x + i * 12, y, 4)


def draw_scoreboard():
    panel(6, 6, 232, 84)
    for row, team in enumerate(("away", "home")):
        y = 10 + row * 22
        bat = batting() == team
        text(12, y, ">" if bat else "", GOLD, 15)
        text(26, y, TEAMS[team]["name"], TEAMS[team]["colour"], 15)
        text(146, y, GAME["score"][team], INK, 16, "right")
    arrow = "Top" if GAME["half"] == "top" else "Bot"
    text(158, 10, f"{arrow} {GAME['inning']}", GOLD, 13)
    base_diamond(196, 46, GAME["bases"], 7)
    text(12, 60, "B", GRASS, 12)
    dots(28, 67, GAME["balls"], 3, "#4ade80")
    text(70, 60, "S", GRASS, 12)
    dots(86, 67, GAME["strikes"], 2, "#facc15")
    text(116, 60, "O", GRASS, 12)
    dots(132, 67, GAME["outs"], 2, "#f87171")


def draw_derby_board():
    panel(6, 6, 186, 84)
    text(12, 9, "HOME RUN DERBY", GOLD, 14)
    text(12, 29, f"Home runs  {DERBY['homers']}", INK, 15)
    text(12, 47, f"Outs  {DERBY['outs']} of {DERBY_OUTS}", "#fca5a5", 15)
    text(12, 65, f"Longest  {DERBY['longest']} ft", GRASS, 13)


def draw_pitch_tag(game):
    """The pitch and its speed, the moment it's thrown, as the stadium's board shows it."""
    p = AB.get("pitch")
    if not p or game.mode not in ("pitch", "hit", "result"):
        return
    info = PITCHES[p["kind"]]
    panel(VIEW_W - 176, 6, VIEW_W - 6, 34)
    text(VIEW_W - 166, 11, info["name"], info["colour"], 15)
    text(VIEW_W - 14, 11, f"{info['mph']} mph", INK, 15, "right")
    if AB.get("hit") and game.mode != "pitch":
        h = AB["hit"]
        panel(VIEW_W - 176, 38, VIEW_W - 6, 60)
        text(VIEW_W - 166, 42, f"Off the bat: {round(h['mph'])} mph", GRASS, 12)


def draw_pitch_menu():
    """For a person pitching: the four pitches, the chosen one lit."""
    c = pitcher_is()
    if c is None or AB.get("pitch") is not None:
        return
    panel(80, PITCH_NAMES_Y - 6, VIEW_W - 80, VIEW_H - 4)
    w = (VIEW_W - 160) / len(PITCHES)
    for i, p in enumerate(PITCHES):
        on = i == AB["kind"]
        text(80 + w * i + w / 2, PITCH_NAMES_Y - 2, p["name"], p["colour"] if on else "#64748b", 15 if on else 13, "center")
    text(VIEW_W / 2, PITCH_NAMES_Y + 16, f"Aim, {button_name(c, 1)} to change the pitch, {button_name(c, 0)} to throw",
         INK, 11, "center")


def draw_hint(words):
    if words:
        panel(VIEW_W / 2 - 170, VIEW_H - 24, VIEW_W / 2 + 170, VIEW_H - 4, 0.6)
        text(VIEW_W / 2, VIEW_H - 22, words, INK, 12, "center")


def draw_words(words):
    if words:
        big = words.startswith("HOME RUN")
        panel(70, 128, VIEW_W - 70, 176 if not big else 190)
        text(VIEW_W / 2, 136, words, GOLD if big or "!" in words else INK, 26 if big else 20, "center")


def draw_line_score(y0):
    """Runs by inning for both teams, and the totals."""
    n = max(INNINGS, len(GAME["line"]["away"]))
    x0, cw = 200, 30
    for i in range(n):
        text(x0 + i * cw, y0, i + 1, GRASS, 13, "center")
    text(x0 + n * cw + 10, y0, "R", GOLD, 13, "center")
    text(x0 + n * cw + 40, y0, "H", GOLD, 13, "center")
    for row, team in enumerate(("away", "home")):
        y = y0 + 20 + row * 22
        text(60, y, TEAMS[team]["name"], TEAMS[team]["colour"], 15)
        line = GAME["line"][team]
        for i in range(n):
            runs = line[i] if i < len(line) else ("X" if GAME["over"] and team == "home" and i == len(line) else "")
            text(x0 + i * cw, y, runs, INK, 15, "center")
        text(x0 + n * cw + 10, y, GAME["score"][team], GOLD, 15, "center")
        text(x0 + n * cw + 40, y, GAME["hits"][team], INK, 15, "center")


def draw_half_card(t):
    panel(40, 90, VIEW_W - 40, 250, 0.88)
    text(VIEW_W / 2, 100, inning_words(), GOLD, 22, "center")
    team = batting()
    text(VIEW_W / 2, 128, f"The {TEAMS[team]['name']} come to bat", TEAMS[team]["colour"], 16, "center")
    draw_line_score(160)


def draw_final(t):
    panel(30, 50, VIEW_W - 30, 310, 0.9)
    if derby():
        text(VIEW_W / 2, 62, "Round over!", GOLD, 28, "center")
        text(VIEW_W / 2, 110, f"{DERBY['homers']} home run{'s' if DERBY['homers'] != 1 else ''}", INK, 26, "center")
        text(VIEW_W / 2, 146, f"Longest: {DERBY['longest']} ft", GRASS, 20, "center")
        text(VIEW_W / 2, 196, f"Your best: {save_get('derby_homers', 0)} home runs,  "
             f"longest {save_get('derby_longest', 0)} ft", INK, 15, "center")
        if DERBY["record"]:
            text(VIEW_W / 2, 220, "A new record!", GOLD, 18, "center")
    else:
        w = winner()
        if w is None:
            title = "A tie game!"
        elif MATCH.get("two") or MATCH.get("demo"):
            title = f"The {TEAMS[w]['name']} win!"
        else:
            title = "You win!" if MATCH["humans"].get(w) is not None else f"The {TEAMS[w]['name']} win."
        text(VIEW_W / 2, 62, title, GOLD, 28, "center")
        text(VIEW_W / 2, 100, "Final", GRASS, 16, "center")
        draw_line_score(130)
    if t > 90:
        text(VIEW_W / 2, 280, "Press a key", GRASS, 14, "center")


MENU = ["Home Run Derby", "1 Player Game", "2 Players"]


def draw_title(menu, t):
    draw_sprite("plate_view", 0, 0, 0)
    panel(0, 0, VIEW_W, VIEW_H, 0.35)
    bob = math.sin(t / 20) * 3
    text(VIEW_W / 2 + 3, 30 + bob + 3, "MOONSHOT", "#000000", 60, "center")
    text(VIEW_W / 2, 30 + bob, "MOONSHOT", GOLD, 60, "center")
    text(VIEW_W / 2, 100, "Baseball under the sky: hit one to the moon", INK, 16, "center")
    panel(200, 140, 440, 236)
    for i, name in enumerate(MENU):
        on = i == menu
        text(VIEW_W / 2, 148 + i * 28, ("> " + name + " <") if on else name, GOLD if on else INK, 20 if on else 17, "center")
    best = save_get("derby_homers", 0)
    if best:
        text(VIEW_W / 2, 244, f"Derby record: {best} home runs, longest {save_get('derby_longest', 0)} ft", GRASS, 13, "center")
    panel(0, VIEW_H - 50, VIEW_W, VIEW_H)
    text(VIEW_W / 2, VIEW_H - 46, "Batting: up and down to aim the swing, Z or Space to swing, in time.", INK, 13, "center")
    text(VIEW_W / 2, VIEW_H - 27, "Pitching: arrows to aim, X to change the pitch, Z to throw.", INK, 13, "center")
    text(VIEW_W / 2, 270, "Two players: WASD with C and V, and the arrows with I and O", GRASS, 12, "center")
