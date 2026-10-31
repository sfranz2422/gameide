# script: screen
# Everything drawn in Draw GUI, in screen pixels (384 x 216): the
# scoreboard, the words, the announcer, the coach's chalkboard, the coin
# toss, the try, the title, the season and the end. The pixel font is two
# sprites made by build.py: font (6 x 10 a letter) and font2 (twice that),
# white, tinted as they're drawn.

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


def name_color(t):
    """A team's name in its trim, unless the trim is too dark to read on the night sky."""
    hexes = t["trim"]
    r, g, b = (int(hexes[i:i + 2], 16) for i in (1, 3, 5))
    if r * 0.3 + g * 0.59 + b * 0.11 > 110:
        return hexes
    return t["color"]


# ---------------------------------------------------------------- the scoreboard

def draw_scoreboard():
    draw_sprite("scoreboard", 0, 0, 0)
    h, a = TEAMS["home"], TEAMS["away"]
    draw_words(8, 4, h["name"], name_color(h))
    draw_words(8 + words_width(h["name"]) + 6, 4, MATCH["score"]["home"], "#ffffff")
    s = str(MATCH["score"]["away"])
    draw_words(VIEW_W - 8 - words_width(a["name"]), 4, a["name"], name_color(a))
    draw_words(VIEW_W - 14 - words_width(a["name"]) - words_width(s), 4, s, "#ffffff")
    q = f"Q{MATCH['quarter']}" if MATCH["quarter"] <= 4 else "OT"
    draw_centered(VIEW_W / 2, 4, f"{q}  {clock_words()}", "#ffd54a")
    mark = "<" if TEAMS[MATCH["off"]]["dir"] < 0 else ">"
    where = "" if MATCH.get("kickoff") else " " + spot_words()
    draw_centered(VIEW_W / 2, 15, f"{down_words()}{where} {mark}", "#c9d6ff")


def draw_says(t):
    """What the last play did, the first line big."""
    says = MATCH["says"]
    if not says:
        return
    draw_banner(78, says[0], CHALK_LIT if t // 10 % 2 else "#ffffff")
    for i, line in enumerate(says[1:]):
        draw_banner(108 + i * 14, line, "#ffffff", big=False)


def draw_announcer():
    """The announcer's caption for a big play, under the scoreboard."""
    if ANNOUNCE["t"] <= 0:
        return
    draw_set_alpha(min(1, ANNOUNCE["t"] / 20) * 0.7)
    draw_set_color("#1a1030")
    w = words_width(ANNOUNCE["text"]) + 16
    draw_rect(VIEW_W / 2 - w / 2, 28, VIEW_W / 2 + w / 2, 42)
    draw_set_alpha(1)
    draw_centered(VIEW_W / 2, 31, ANNOUNCE["text"], "#ffe066")


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
    what = "Extra point" if MATCH.get("try") else f"{k['yards']} yard field goal"
    draw_centered(VIEW_W / 2, y0 + 16, what, "#ffffff")


def draw_replay(t):
    """The slow-motion replay's frame: a red dot and the word."""
    draw_set_alpha(0.5)
    draw_set_color("#000000")
    draw_rect(0, 0, VIEW_W, 14)
    draw_rect(0, VIEW_H - 14, VIEW_W, VIEW_H)
    draw_set_alpha(1)
    if t // 20 % 2 == 0:
        draw_set_color("#ff3030")
        draw_circle(12, 7, 4)
    draw_words(22, 3, "REPLAY", "#ffffff")
    draw_words(VIEW_W - 6 - words_width("SLOW MOTION"), 3, "SLOW MOTION", "#c9d6ff")
    draw_centered(VIEW_W / 2, VIEW_H - 12, "Let's see that again...", "#ffe066")


# ---------------------------------------------------------------- the chalkboard

BOARD_X = (30, 200)
BOARD_ROWS = 5            # plays shown at once; the list scrolls with the cursor


def draw_chalkboard(t):
    """Both coaches pick a play. The highlighted one is drawn in chalk, X's and O's."""
    draw_sprite("chalkboard", 0, 0, 0)
    off, deff = MATCH["off"], other(MATCH["off"])
    for side, team in enumerate((off, deff)):
        x = BOARD_X[side]
        human = MATCH["humans"].get(team)
        head = ("TWO-POINT TRY" if MATCH.get("try") else "OFFENSE") if side == 0 else "DEFENSE"
        draw_words(x, 16, f"{TEAMS[team]['name']}: {head}", name_color(TEAMS[team]))
        if human is None:
            draw_words(x, 32, "The coach is thinking..." if team not in MATCH["chosen"] else "Ready.", CHALK_DIM)
            continue
        choices = plays_for(team) if side == 0 else list(range(len(DEFENSE)))
        book = OFFENSE if side == 0 else DEFENSE
        cur = MATCH["cursor"][team]
        first = clamp(cur - BOARD_ROWS // 2, 0, max(0, len(choices) - BOARD_ROWS))
        for row in range(min(BOARD_ROWS, len(choices))):
            i = choices[first + row]
            lit = first + row == cur
            draw_words(x + 8, 32 + row * 11, ("> " if lit else "  ") + book[i]["name"], CHALK_LIT if lit else CHALK)
        draw_set_color(CHALK_DIM)
        if first > 0:                                        # more above
            draw_triangle(x + 2, 36, x + 6, 36, x + 4, 32)
        if first + BOARD_ROWS < len(choices):                # more below
            draw_triangle(x + 2, 32 + (BOARD_ROWS - 1) * 11 + 2, x + 6, 32 + (BOARD_ROWS - 1) * 11 + 2,
                          x + 4, 32 + (BOARD_ROWS - 1) * 11 + 6)
        picked = choices[cur]
        if team in MATCH["chosen"]:
            draw_words(x + 110, 32, "Ready!", "#7dff7d")
        lines = wrap_words(book[picked]["says"], 27)
        for j, line in enumerate(lines[:3]):
            draw_words(x, 92 + j * 10, line, CHALK_DIM)
        if side == 0:
            draw_play_diagram(x + 8, 128, OFFENSE[picked])
        else:
            draw_defense_diagram(x + 8, 128, DEFENSE[picked])
    names = [f"{button_name(c, 0)} to pick" for c in sorted(set(v for v in MATCH["humans"].values() if v is not None))]
    draw_centered(VIEW_W / 2, VIEW_H - 12, "Up and down to choose, " + " / ".join(names), CHALK_DIM)
    face = 1 if MATCH["chosen"] and t // 12 % 2 else 0
    draw_sprite("coach", face, VIEW_W - 48, 0)


DIAGRAM_K = 0.32       # chalk pixels for each field pixel, across the field
DIAGRAM_F = 0.5        # and along it: plays are long and narrow, so it's stretched to read


def draw_play_diagram(x, y, play):
    """The offence's plan: O for each player, a chalk line for every route.
    Whoever runs with the ball is lit (the carrier, then a pitch or a
    reverse's man), and on a pass each target has his number at the end."""
    k, kf = DIAGRAM_K, DIAGRAM_F
    los = x + 52
    draw_set_color(CHALK_DIM)
    draw_line(los, y, los, y + 62, 1)
    mid = y + 31
    if play["kind"] in ("punt", "kick"):
        draw_words(x, mid - 4, "Line up and kick it." if play["kind"] == "kick" else "Boot it downfield.", CHALK)
        return
    runners = [play.get(key) for key in ("carrier", "pitch", "reverse") if play.get(key)]
    targets = play.get("targets", ["WR1", "WR2", "WR3"]) if play["kind"] == "pass" else []
    for role in OFFENSE_ROLES:
        back, across = LINEUP[role]
        px, py = los - back * kf, mid + across * k
        draw_set_color(CHALK)
        draw_circle(px, py, 2.5, True)
        pts = [(px, py)] + [(px + fx * kf, py + fy * k) for fx, fy in play.get("routes", {}).get(role, [])]
        if len(pts) < 2:
            continue
        draw_set_color(CHALK_LIT if role in runners else CHALK)
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            bx = min(bx, x + 176)
            draw_line(ax, ay, bx, by, 1)
        (ax, ay), (bx, by) = pts[-2], pts[-1]
        bx = min(bx, x + 176)
        d = max(0.1, point_distance(ax, ay, bx, by))
        ux, uy = (bx - ax) / d, (by - ay) / d
        draw_triangle(bx + ux * 3, by + uy * 3, bx - uy * 3, by + ux * 3, bx + uy * 3, by - ux * 3)
        if role in targets:
            draw_words(bx + 3, by - 5, targets.index(role) + 1, CHALK_LIT)
    if play.get("fake"):
        back, across = LINEUP[play["fake"]]
        draw_words(los - back * kf - 6, mid + across * k + 4, "fake", CHALK_DIM)


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
            draw_circle(min(los + int(job[1]) * kf, x + 172), mid + int(job[2]) * k, 7, True)


# ---------------------------------------------------------------- the coin toss and the try

def draw_toss(toss, t):
    """The coin goes up, turning over and over, and comes down heads or tails."""
    draw_sprite("title", 0, 0, 0)
    caller = toss["caller"]
    draw_banner(16, "THE COIN TOSS", "#ffd54a")
    cx, cy = VIEW_W / 2, 104
    if toss["result"] is None and toss.get("flip", 0) == 0:
        c = MATCH["humans"].get(caller)
        draw_banner(48, f"{TEAMS[caller]['name']}, call it in the air!", "#ffffff", big=False)
        if c is not None:
            for i, side in enumerate(["HEADS", "TAILS"]):
                lit = i == toss["cursor"]
                draw_centered(VIEW_W / 2, 140 + i * 14, ("> " + side + " <") if lit else side,
                              "#ffd54a" if lit else "#ffffff")
            draw_hint(f"Up and down, {button_name(c, 0)} to call it")
        return
    k = toss.get("flip", 0)
    up = math.sin(min(1, k / 70) * math.pi) * 40 if toss["result"] is None else 0
    w = abs(math.cos(k * 0.35)) * 16 + 1 if toss["result"] is None else 16
    draw_set_color("#8a6a10")
    draw_ellipse(cx - w - 1, cy - up - 17, cx + w + 1, cy - up + 17)
    draw_set_color("#f2c230")
    draw_ellipse(cx - w, cy - up - 16, cx + w, cy - up + 16)
    draw_banner(48, f"{TEAMS[caller]['name']} call {toss['call']}", "#ffffff", big=False)
    if toss["result"] is not None:
        draw_centered(cx, cy - 10, toss["result"][0], "#8a5a00", True)
        winner = toss["winner"]
        draw_banner(140, f"It's {toss['result']}! {TEAMS[winner]['name']} win the toss", "#ffd54a", big=False)
        c = MATCH["humans"].get(winner)
        if toss.get("choice") is None and c is not None:
            for i, side in enumerate(["RECEIVE", "KICK"]):
                lit = i == toss["cursor"]
                draw_centered(VIEW_W / 2, 162 + i * 13, ("> " + side + " <") if lit else side,
                              "#ffd54a" if lit else "#ffffff")
            draw_hint(f"Up and down, {button_name(c, 0)} to choose")
        elif toss.get("choice") is not None:
            draw_banner(162, f"They will {toss['choice'].lower()}.", "#ffffff", big=False)


def draw_try(cursor):
    """After a touchdown: the kick (picked if you just press) or going for two."""
    team = MATCH["try"]
    draw_banner(64, "THE TRY", "#ffd54a")
    c = MATCH["humans"].get(team)
    for i, words in enumerate(TRY_CHOICES):
        lit = i == cursor
        draw_banner(96 + i * 16, ("> " + words + " <") if lit else words, "#ffd54a" if lit else "#ffffff", big=False)
    if c is not None:
        draw_hint(f"Up and down, {button_name(c, 0)} to choose")


# ---------------------------------------------------------------- the end zones and midfield, in the room

def draw_field_teams():
    """Tonight's teams on the field: each end zone in its colours, the home team's badge at midfield."""
    draw_sprite(f"endzone_{TEAMS['home']['id']}", 0, END_L + 2, TOP + 2)
    draw_sprite(f"endzone_{TEAMS['away']['id']}", 0, GOAL_R + 2, TOP + 2)
    draw_sprite(f"badge_{TEAMS['home']['id']}", 0, GOAL_L + 50 * YD, MID)


# ---------------------------------------------------------------- the title, the season and the end

MENU = ["1 Player", "2 Players", "Season"]

# The title's tips, a page at a time, for each menu choice.
TIPS = {
    0: [["Move: arrows or WASD.  Z X C: throw to 1 2 3", "Ball in the air: Z to dive for it"],
        ["With the ball: Z spin, X juke, C stiff-arm", "Option play: Z to pitch it"],
        ["Defense: Z to dive, X to switch player", "Kickoff: Z kicks deep, X onside"],
        ["After a touchdown: kick, or go for 2", "On a phone: the arrows and Z X C buttons"]],
    1: [["Comets: WASD with C V B.  Badgers: arrows with I O P", "Or a gamepad each: the stick, and A B X"],
        ["With the ball: 1st button spin, 2nd juke, 3rd stiff-arm", "Defense: 1st button dive, 2nd switch player"]],
    2: [["Pick a team. Play the other five once each,", "and the top two play for the championship."],
        ["Your season is saved: come back to it any time.", "Same keys as 1 Player: arrows, Z X C."]],
}


def draw_title(menu, t):
    draw_sprite("title", 0, 0, 0)
    draw_centered(VIEW_W / 2 + 2, 22, "UNDER THE LIGHTS", "#000000", True)
    draw_centered(VIEW_W / 2, 20, "UNDER THE LIGHTS", "#ffd54a", True)
    draw_centered(VIEW_W / 2, 44, "Six teams, 7 on 7, Friday night football", "#ffffff")
    for i, name in enumerate(MENU):
        lit = i == menu
        draw_centered(VIEW_W / 2, 110 + i * 14, ("> " + name + " <") if lit else name, "#ffd54a" if lit else "#ffffff")
    pages = TIPS[menu]
    page = t // 200 % len(pages)
    for i, line in enumerate(pages[page]):
        draw_banner(172 + i * 14, line, "#e0e0e0", big=False)
    for i in range(len(pages)):                     # which page of tips this is
        draw_set_color("#ffd54a" if i == page else "#555555")
        draw_circle(VIEW_W / 2 + (i - (len(pages) - 1) / 2) * 8, 206, 2)


def draw_strength(x, y, label, value):
    """One of a team's strengths as a bar: the middle is ordinary."""
    draw_words(x, y, label, CHALK_DIM)
    draw_set_color("#24402e")
    draw_rect(x + 42, y + 1, x + 122, y + 7)
    draw_set_color(CHALK_LIT if value >= 1 else CHALK)
    draw_rect(x + 42, y + 1, x + 42 + clamp((value - 0.85) / 0.3, 0.05, 1) * 80, y + 7)


def draw_pick(cursor, t):
    """Choosing a team for a season: each in its colours, with its strengths."""
    draw_sprite("chalkboard", 0, 0, 0)
    draw_words(30, 16, "PICK YOUR TEAM", CHALK_LIT)
    for i, tm in enumerate(LEAGUE):
        lit = i == cursor
        y = 36 + i * 24
        pose = 7 if lit and t // 15 % 2 else 1
        draw_sprite_ext(f"{tm['id']}_poses", pose, 54, y + 23, 0.7, 0.7, 0, "white", 1)
        draw_words(70, y + 9, ("> " if lit else "  ") + tm["name"], name_color(tm) if lit else CHALK)
    tm = LEAGUE[cursor]
    draw_words(200, 40, tm["name"], name_color(tm), True)
    for j, line in enumerate(wrap_words(tm["says"], 28)[:2]):
        draw_words(200, 64 + j * 10, line, CHALK)
    for j, key in enumerate(("speed", "tackle", "arm")):
        draw_strength(200, 96 + j * 14, key.capitalize(), tm[key])
    draw_centered(VIEW_W / 2, VIEW_H - 12, "Up and down to choose, Z to pick", CHALK_DIM)


def draw_season(cursor, t):
    """The standings, and what's next."""
    draw_sprite("chalkboard", 0, 0, 0)
    mine = SEASON["team"]
    if SEASON["champion"]:
        head = "CHAMPIONS: " + league_team(SEASON["champion"])["name"] + "!"
    elif in_final():
        head = "THE CHAMPIONSHIP"
    else:
        head = f"SEASON  -  WEEK {SEASON['week'] + 1} OF {len(SEASON['weeks'])}"
    draw_words(30, 14, head, CHALK_LIT)
    cols = [(30, "TEAM"), (120, "W"), (140, "L"), (160, "T"), (186, "PF"), (216, "PA")]
    for x, word in cols:
        draw_words(x, 30, word, CHALK_DIM)
    for i, tid in enumerate(standings()):
        row = SEASON["table"][tid]
        y = 42 + i * 11
        color = CHALK_LIT if tid == mine else CHALK
        draw_words(30, y, f"{i + 1}. {league_team(tid)['name']}", color)
        for x, key in ((120, "w"), (140, "l"), (160, "t"), (186, "pf"), (216, "pa")):
            draw_words(x, y, row[key], color)
    last = [g for g in SEASON["games"] if mine in (g[1], g[2])]
    if last:
        g = last[-1]
        us, them = (g[3], g[4]) if g[1] == mine else (g[4], g[3])
        foe = g[2] if g[1] == mine else g[1]
        word = "Won" if us > them else "Lost" if us < them else "Tied"
        draw_words(30, 112, f"Last game: {word} {us}-{them} vs {league_team(foe)['name']}", CHALK_DIM)
    if SEASON["final"] and mine not in SEASON["final"]:
        a, b = SEASON["final"]
        draw_words(30, 112, f"The final: {league_team(a)['name']} vs {league_team(b)['name']}", CHALK_DIM)
    for i, words in enumerate(season_words()):
        lit = i == cursor
        draw_words(30, 132 + i * 13, ("> " if lit else "  ") + words, CHALK_LIT if lit else CHALK)
    draw_centered(VIEW_W / 2, VIEW_H - 12, "Up and down to choose, Z to pick", CHALK_DIM)
    face = 1 if SEASON["champion"] == mine and t // 12 % 2 else 0
    draw_sprite("coach", face, VIEW_W - 48, 0)


def draw_final(t):
    h, a = MATCH["score"]["home"], MATCH["score"]["away"]
    won = h > a or (MATCH.get("two") and a > h)
    draw_sprite("win" if won else "lose", 0, 0, 0)
    winner = "home" if h > a else "away" if a > h else None
    head = f"{TEAMS[winner]['name']} WIN!" if winner else "A TIE!"
    if MATCH.get("champ") and winner:
        head = f"{TEAMS[winner]['name']}: CHAMPIONS!"
    draw_banner(20, head, "#ffd54a")
    draw_banner(52, f"{TEAMS['home']['name']} {h}   {TEAMS['away']['name']} {a}", "#ffffff", big=False)
    if t > 90:
        draw_hint("Press a button for the season" if MATCH.get("season") else "Press a button for the title")


def draw_mascot(t):
    """The mascot cartwheels across the bottom of the screen after a score."""
    x = VIEW_W + 20 - t * 3.2
    frame = 2 if t // 6 % 2 else 1
    draw_sprite_ext("mascot", frame, x, VIEW_H - 8, 1, 1, 0, "white", 1)
