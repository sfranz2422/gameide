# script: screen
# Everything drawn in Draw GUI, in screen pixels (384 x 216): the
# scoreboard, the words, the coach's chalkboard, the title and the end.
# The pixel font is two sprites made by build.py: font (6 x 10 a letter)
# and font2 (twice that), white, tinted as they're drawn.

CHALK, CHALK_LIT, CHALK_DIM = "#f4f1e6", "#ffe066", "#9fb3a3"


def words_width(text, big=False):
    return len(str(text)) * (12 if big else 6)


def draw_words(x, y, text, color="#ffffff", big=False):
    spr, w = ("font2", 12) if big else ("font", 6)
    for i, ch in enumerate(str(text)):
        n = FONT_INDEX.get(ch, -1)
        if n > 0:
            draw_sprite_ext(spr, n, x + i * w, y, 1, 1, 0, color)


def draw_centered(cx, y, text, color="#ffffff", big=False):
    draw_words(int(cx - words_width(text, big) / 2), y, text, color, big)


def wrap_words(text, cols):
    """Lines of at most `cols` letters, broken between words (string_wrap measures the
    ordinary font, not this pixel one)."""
    lines, line = [], ""
    for word in text.split(" "):
        if line and len(line) + 1 + len(word) > cols:
            lines.append(line)
            line = word
        else:
            line = f"{line} {word}" if line else word
    return lines + [line]


def draw_banner(y, text, color="#ffffff", big=True):
    """Words on a dark band right across the screen, so they read over the field."""
    h = 26 if big else 14
    draw_set_alpha(0.6)
    draw_set_color("#000000")
    draw_rect(0, y - 4, VIEW_W, y - 4 + h)
    draw_set_alpha(1)
    draw_centered(VIEW_W / 2, y, text, color, big)


# ---------------------------------------------------------------- the scoreboard

def draw_scoreboard():
    draw_sprite("scoreboard", 0, 0, 0)
    h, a = TEAMS["home"], TEAMS["away"]
    draw_words(8, 4, h["name"], h["trim"])
    draw_words(8 + words_width(h["name"]) + 6, 4, MATCH["score"]["home"], "#ffffff")
    s = str(MATCH["score"]["away"])
    draw_words(VIEW_W - 8 - words_width(a["name"]), 4, a["name"], "#ff8a80")
    draw_words(VIEW_W - 14 - words_width(a["name"]) - words_width(s), 4, s, "#ffffff")
    draw_centered(VIEW_W / 2, 4, f"Q{MATCH['quarter']}  {clock_words()}", "#ffd54a")
    mark = "<" if TEAMS[MATCH["off"]]["dir"] < 0 else ">"
    draw_centered(VIEW_W / 2, 15, f"{down_words()} {spot_words()} {mark}", "#c9d6ff")


def draw_says(t):
    """What the last play did, the first line big."""
    says = MATCH["says"]
    if not says:
        return
    draw_banner(78, says[0], CHALK_LIT if t // 10 % 2 else "#ffffff")
    for i, line in enumerate(says[1:]):
        draw_banner(108 + i * 14, line, "#ffffff", big=False)


def draw_hint(text):
    draw_set_alpha(0.55)
    draw_set_color("#000000")
    draw_rect(0, VIEW_H - 13, VIEW_W, VIEW_H)
    draw_set_alpha(1)
    draw_centered(VIEW_W / 2, VIEW_H - 11, text, "#e8e8e8")


def draw_kick_meter(k, t):
    """A swinging arrow: press when it's in the green, and the narrower the green the longer the kick."""
    x0, y0, w = VIEW_W / 2 - 80, 150, 160
    ok = k["allowed"]
    draw_set_color("#202020")
    draw_rect(x0 - 2, y0 - 2, x0 + w + 2, y0 + 12)
    draw_set_color("#b33a3a")
    draw_rect(x0, y0, x0 + w, y0 + 10)
    draw_set_color("#3fae49")
    draw_rect(x0 + w / 2 * (1 - ok), y0, x0 + w / 2 * (1 + ok), y0 + 10)
    m = x0 + w / 2 * (1 + k["phase"])
    draw_set_color("#ffffff")
    draw_triangle(m - 4, y0 - 7, m + 4, y0 - 7, m, y0 + 1)
    draw_centered(VIEW_W / 2, y0 + 16, f"{k['yards']} yard field goal", "#ffffff")


# ---------------------------------------------------------------- the chalkboard

BOARD_X = (30, 200)


def draw_chalkboard(t):
    """Both coaches pick a play. The highlighted one is drawn in chalk, X's and O's."""
    draw_sprite("chalkboard", 0, 0, 0)
    off, deff = MATCH["off"], other(MATCH["off"])
    for side, team in enumerate((off, deff)):
        x = BOARD_X[side]
        human = MATCH["humans"].get(team)
        draw_words(x, 16, f"{TEAMS[team]['name']}: {'OFFENSE' if side == 0 else 'DEFENSE'}", TEAMS[team]["trim"])
        if human is None:
            draw_words(x, 32, "The coach is thinking..." if team not in MATCH["chosen"] else "Ready.", CHALK_DIM)
            continue
        choices = plays_for(team) if side == 0 else list(range(len(DEFENSE)))
        book = OFFENSE if side == 0 else DEFENSE
        cur = MATCH["cursor"][team]
        for row, i in enumerate(choices):
            lit = row == cur
            color = CHALK_LIT if lit else CHALK
            draw_words(x + 8, 32 + row * 11, ("> " if lit else "  ") + book[i]["name"], color)
        picked = choices[cur]
        if team in MATCH["chosen"]:
            draw_words(x + 8, 32 + len(choices) * 11 + 2, "Ready!", "#7dff7d")
        lines = wrap_words(book[picked]["says"], 26)
        for j, line in enumerate(lines[:3]):
            draw_words(x, 98 + j * 10, line, CHALK_DIM)
        if side == 0:
            draw_play_diagram(x + 8, 130, OFFENSE[picked])
        else:
            draw_defense_diagram(x + 8, 130, DEFENSE[picked])
    names = [f"{button_name(c, 0)} to pick" for c in sorted(set(v for v in MATCH["humans"].values() if v is not None))]
    draw_centered(VIEW_W / 2, VIEW_H - 12, "Up and down to choose, " + " / ".join(names), CHALK_DIM)
    face = 1 if MATCH["chosen"] and t // 12 % 2 else 0
    draw_sprite("coach", face, VIEW_W - 48, 0)


DIAGRAM_K = 0.32       # chalk pixels for each field pixel, across the field
DIAGRAM_F = 0.5        # and along it: plays are long and narrow, so it's stretched to read


def draw_play_diagram(x, y, play):
    """The offence's plan: O for each player, a chalk line for every route."""
    k, kf = DIAGRAM_K, DIAGRAM_F
    los = x + 52
    draw_set_color(CHALK_DIM)
    draw_line(los, y, los, y + 62, 1)
    mid = y + 31
    if play["kind"] in ("punt", "kick"):
        draw_words(x, mid - 4, "Line up and kick it." if play["kind"] == "kick" else "Boot it downfield.", CHALK)
        return
    for role in OFFENSE_ROLES:
        back, across = LINEUP[role]
        px, py = los - back * kf, mid + across * k
        draw_set_color(CHALK)
        draw_circle(px, py, 2.5, True)
        pts = [(px, py)] + [(px + fx * kf, py + fy * k) for fx, fy in play.get("routes", {}).get(role, [])]
        if len(pts) < 2:
            continue
        lit = role == play.get("carrier")
        draw_set_color(CHALK_LIT if lit else CHALK)
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            bx = min(bx, x + 176)
            draw_line(ax, ay, bx, by, 1)
        (ax, ay), (bx, by) = pts[-2], pts[-1]
        bx = min(bx, x + 176)
        d = max(0.1, point_distance(ax, ay, bx, by))
        ux, uy = (bx - ax) / d, (by - ay) / d
        draw_triangle(bx + ux * 3, by + uy * 3, bx - uy * 3, by + ux * 3, bx + uy * 3, by - ux * 3)


def draw_defense_diagram(x, y, plan):
    """The defence's plan: X for each player, an arrow for a rush, a ring for a zone."""
    k, kf = DIAGRAM_K, DIAGRAM_F
    los = x + 52
    mid = y + 31
    draw_set_color(CHALK_DIM)
    draw_line(los, y, los, y + 62, 1)
    spots = {}
    for role in OFFENSE_ROLES:
        back, across = LINEUP[role]
        spots[role] = (los - back * kf, mid + across * k)
        draw_circle(spots[role][0], spots[role][1], 2, True)
    for role in DEFENSE_ROLES:
        fwd_, across = LINEUP[role]
        px, py = los + fwd_ * kf, mid + across * k
        job = plan["jobs"][role].split()
        draw_set_color(CHALK)
        draw_line(px - 2, py - 2, px + 2, py + 2, 1)
        draw_line(px - 2, py + 2, px + 2, py - 2, 1)
        draw_set_color(CHALK_LIT if job[0] == "rush" else CHALK_DIM)
        if job[0] == "rush":
            draw_line(px - 3, py, los - 8, mid + (py - mid) * 0.3, 1)
        elif job[0] in ("man", "spy"):
            tx, ty = spots[job[1]]
            draw_line(px, py, (px + tx) / 2, (py + ty) / 2, 1)
        elif job[0] == "zone":
            draw_circle(los + int(job[1]) * kf, mid + int(job[2]) * k, 7, True)


# ---------------------------------------------------------------- the title and the end

MENU = ["1 Player", "2 Players"]


def draw_title(menu, t):
    draw_sprite("title", 0, 0, 0)
    draw_centered(VIEW_W / 2 + 2, 22, "UNDER THE LIGHTS", "#000000", True)
    draw_centered(VIEW_W / 2, 20, "UNDER THE LIGHTS", "#ffd54a", True)
    draw_centered(VIEW_W / 2, 44, "Comets against Badgers, 7 on 7, Friday night", "#ffffff")
    for i, name in enumerate(MENU):
        lit = i == menu
        draw_centered(VIEW_W / 2, 120 + i * 14, ("> " + name + " <") if lit else name, "#ffd54a" if lit else "#ffffff")
    tips = ["Move: arrows or WASD. Z, X, C: throw to 1, 2, 3",
            "Running: Z to spin. Defense: Z to dive, X to switch"] if menu == 0 else \
           ["Comets: WASD with C V B.  Badgers: arrows with I O P",
            "Or a gamepad each: the stick, and A B X"]
    for i, line in enumerate(tips):
        draw_banner(172 + i * 14, line, "#e0e0e0", big=False)


def draw_final(t):
    h, a = MATCH["score"]["home"], MATCH["score"]["away"]
    won = h > a or (MATCH.get("two") and a > h)
    draw_sprite("win" if won else "lose", 0, 0, 0)
    winner = "home" if h > a else "away" if a > h else None
    head = f"{TEAMS[winner]['name']} WIN!" if winner else "A TIE!"
    draw_banner(20, head, "#ffd54a")
    draw_banner(52, f"{TEAMS['home']['name']} {h}   {TEAMS['away']['name']} {a}", "#ffffff", big=False)
    if t > 90:
        draw_hint("Press a button for the title")


def draw_mascot(t):
    """The mascot cartwheels across the bottom of the screen after a score."""
    x = VIEW_W + 20 - t * 3.2
    frame = 2 if t // 6 % 2 else 1
    draw_sprite_ext("mascot", frame, x, VIEW_H - 8, 1, 1, 0, "white", 1)
