# script: screen
# Drawing it all, and what's under the mouse. The screen is 320 x 200: the
# room on top (144 high), then the sentence line, then the nine verbs on
# the left and what you carry on the right — the way LucasArts laid it out.

SENTENCE_Y = 147
VERB_X, VERB_Y = (4, 58, 112), (159, 172, 185)
INV_X, INV_Y, INV_W, INV_H = 180, 157, 35, 21
VERB_COLOR, VERB_LIT, VERB_ON = "#4fb3a9", "#c9fff6", "#ffe14d"
SENTENCE_COLOR = "#d7a8ff"
TALK_COLOR, TALK_LIT = "#b48cff", "#ffffff"
ROBIN_H = 50          # how tall Robin is at scale 1: speech goes over the head


# ---------------------------------------------------------------- the pixel font
# The font sprite (built from Thornwood's font.py): one frame per character,
# white with a dark shadow. draw_sprite_ext tints it each speaker's colour.

def words_width(text):
    return len(text) * 6


def draw_words(x, y, text, color="#ffffff"):
    for i, ch in enumerate(str(text)):
        n = FONT_INDEX.get(ch, -1)
        if n > 0:
            draw_sprite_ext("font", n, x + i * 6, y, 1, 1, 0, color)


def draw_centered(cx, y, text, color="#ffffff"):
    draw_words(int(cx - words_width(text) / 2), y, text, color)


def wrap_words(text, cols):
    lines, line = [], ""
    for word in text.split(" "):
        if line and len(line) + 1 + len(word) > cols:
            lines.append(line)
            line = word
        else:
            line = f"{line} {word}" if line else word
    lines.append(line)
    return lines


# ---------------------------------------------------------------- what's where

def verb_at(mx, my):
    for i, (v, _) in enumerate(VERBS):
        x, y = VERB_X[i % 3], VERB_Y[i // 3]
        if x - 2 <= mx < x + 52 and y - 2 <= my < y + 11:
            return v
    return None


def items_shown():
    top = STATE.get("inv_top", 0)
    return STATE["items"][top * 4: top * 4 + 8]


def item_at(mx, my):
    for i, it in enumerate(items_shown()):
        x, y = INV_X + (i % 4) * INV_W, INV_Y + (i // 4) * INV_H
        if x <= mx < x + INV_W - 2 and y <= my < y + INV_H - 2:
            return it
    return None


def scroll_at(mx, my):
    """The little arrows left of the items, when there are more than eight."""
    if len(STATE["items"]) <= 8 or not (170 <= mx < 179):
        return 0
    return -1 if INV_Y <= my < INV_Y + 18 else 1 if INV_Y + 22 <= my < INV_Y + 40 else 0


def spot_at(mx, my):
    if my >= ROOM_H:
        return None
    for s in reversed(spots()):
        x1, y1, x2, y2 = s["box"]
        if x1 <= mx < x2 and y1 <= my < y2:
            return s
    return None


def option_at(mx, my):
    if not STATE["menu"] or my < SENTENCE_Y + 10:
        return None
    i = int((my - (SENTENCE_Y + 10)) // 11)   # the mouse is in fractions of a pixel in a browser: // keeps them
    return i if 0 <= i < len(STATE["menu"]) else None


# ---------------------------------------------------------------- people

def pose_of(s, talking):
    """Which picture of an actor to show now."""
    who = s["actor"]
    if who == "glorbin":
        p = "alien" if STATE["room"] == "mothership" else "stand"
        return p + "_talk" if talking and p == "alien" else "talk" if talking else p
    if who == "dot":
        return ("talk" if talking else "awake") if flag("dot_awake") else "asleep"
    if who == "hoover":
        return "asleep"
    return "talk" if talking else "stand"


def frame_of(who, pose, t, talking):
    poses = ACTORS[who]["poses"]
    if talking and (t // 8) % 2:      # the mouth moves: talking and resting pictures, turn about
        pose = {"talk": "stand", "alien_talk": "alien"}.get(pose, pose)
        if who == "dot":
            pose = "awake"
    return poses.get(pose, 0)


def robin_frame(t, talking):
    poses = ACTORS["robin"]["poses"]
    if STATE.get("walking"):
        return poses["walk"][(t // 6) % len(poses["walk"])]
    f = STATE["face"]
    if f == "back":
        return poses["back"]
    if f in ("left", "right"):
        return poses["side"]
    return poses["talk"] if talking and (t // 8) % 2 else poses["front"]


def draw_people(t):
    talker = SPEECH.get("who")
    cast = [(STATE["y"], "robin", None)]
    for s in spots():
        if s.get("actor"):
            cast.append((s["at"][1], s["actor"], s))
    for _, who, s in sorted(cast, key=lambda c: c[0]):
        talking = who == talker or (who == "glorbin" and talker == "glorbin")
        if s is None:
            k = scale_at(STATE["y"])
            flip = -1 if STATE["face"] == "left" else 1
            draw_sprite_ext("robin", robin_frame(t, talking), round(STATE["x"]), round(STATE["y"]), k * flip, k, 0, "white", 1)
        else:
            frame = frame_of(who, pose_of(s, talking), t, talking)
            draw_sprite_ext(ACTORS[who]["sprite"], frame, s["at"][0], s["at"][1], 1, 1, 0, "white", 1)


def speaker_top(who):
    """Where a speaker's head is: their words go just above it."""
    if who == "robin":
        return STATE["x"], STATE["y"] - ROBIN_H * scale_at(STATE["y"]) - 2
    for s in spots():
        if s.get("actor") == who:
            return (s["box"][0] + s["box"][2]) / 2, s["box"][1] - 2
    return 160, 40      # someone talking from out of sight (the radio)


def draw_speech():
    if not SPEECH:
        return
    who, text = SPEECH["who"], SPEECH["text"]
    if STATE.get("code"):            # a puzzle on screen: the words go under it, wider
        lines = wrap_words(text, CODE_SAY_COLS)
        x, y = 160, ROOM_H - 2 - 10 * len(lines)
    else:
        lines = wrap_words(text, 30)
        x, top = speaker_top(who)
        y = max(2, top - 10 * len(lines))
    width = max(words_width(l) for l in lines)
    cx = clamp(x, width / 2 + 2, 320 - width / 2 - 2)
    for i, line in enumerate(lines):
        draw_centered(cx, y + i * 10, line, ACTORS[who]["color"])


# ---------------------------------------------------------------- a Python puzzle (code)
# The program on a dark screen over the room, like a terminal. What anyone
# says about it goes in the space under it (draw_speech), so a puzzle's
# screen and its explanation never cover each other: build.py checks that
# every program and three lines of talk fit.

CODE_X, CODE_Y, CODE_W = 12, 4, 296
CODE_SAY_COLS = 50
CODE_GREEN, CODE_DIM, CODE_RED = "#9cf06a", "#6f8f7f", "#ff6b6b"


def code_rows(p):
    return 2 + len(p["code"]) + (1 if p.get("error") else 0) + 1


def draw_code(pid):
    p = PUZZLES[pid]
    h = 6 + 10 * code_rows(p)
    draw_set_color("#9cf06a")
    draw_rect(CODE_X - 2, CODE_Y - 2, CODE_X + CODE_W + 2, CODE_Y + h + 2)
    draw_set_color("#0b1410")
    draw_rect(CODE_X, CODE_Y, CODE_X + CODE_W, CODE_Y + h)
    draw_words(CODE_X + 4, CODE_Y + 3, p["title"], "#ffe14d")
    y = CODE_Y + 3 + 20
    for i, line in enumerate(p["code"]):     # numbered like an editor: "Which line fixes line 2?"
        draw_words(CODE_X + 4, y, str(i + 1), "#45604f")
        draw_words(CODE_X + 16, y, line, CODE_DIM if line.lstrip().startswith("#") else CODE_GREEN)
        y += 10
    if p.get("error"):
        draw_words(CODE_X + 4, y, p["error"], CODE_RED)
        y += 10
    draw_words(CODE_X + 4, y, p["ask"], "#ffffff")


# ---------------------------------------------------------------- the panel under the room

def draw_panel(t, mx, my):
    draw_set_color("black")
    draw_rect(0, ROOM_H, 320, 200)
    if STATE["menu"]:
        lit = option_at(mx, my)
        for i, (words, _) in enumerate(STATE["menu"]):
            draw_words(6, SENTENCE_Y + 10 + i * 11, words[:52], TALK_LIT if i == lit else TALK_COLOR)
        return
    playing = bool(QUEUE)
    hover = None
    if not playing:
        s = spot_at(mx, my)
        hover = s["id"] if s else item_at(mx, my)
    draw_centered(160, SENTENCE_Y, sentence(hover) if not playing else "", SENTENCE_COLOR)
    lit = verb_at(mx, my)
    for i, (v, name) in enumerate(VERBS):
        color = VERB_ON if v == STATE["verb"] and v != "walk" else VERB_LIT if v == lit else VERB_COLOR
        draw_words(VERB_X[i % 3], VERB_Y[i // 3], name, color)
    for i, it in enumerate(items_shown()):
        x, y = INV_X + (i % 4) * INV_W, INV_Y + (i // 4) * INV_H
        if it == STATE["first"]:
            draw_set_color("#3a2a5a")
            draw_rect(x - 1, y - 1, x + INV_W - 2, y + INV_H - 2)
        draw_sprite("items", ITEMS[it][1], x + 1, y + 1)
    if len(STATE["items"]) > 8:
        draw_words(171, INV_Y + 4, "↑" if "↑" in FONT_INDEX else "^", VERB_COLOR)
        draw_words(171, INV_Y + 26, "↓" if "↓" in FONT_INDEX else "v", VERB_COLOR)


# ---------------------------------------------------------------- whole-screen pictures

def draw_picture_over(name, t):
    draw_set_color("black")
    draw_rect(0, 0, 320, 200)
    if name == "sleepy":
        draw_centered(160, 90, "Z z z . . .", "#8ecbff")
    elif name == "beam":
        draw_set_color("#7dff6a")
        draw_set_alpha(0.5 + 0.5 * abs(((t % 20) - 10) / 10))
        draw_rect(0, 0, 320, 200)
        draw_set_alpha(1)
    else:
        draw_sprite("pic_" + name, 0, 60, 0)


def draw_ending(t):
    draw_set_color("black")
    draw_rect(0, 0, 320, 200)
    draw_sprite("pic_newspaper", 0, NEWS_X, 0)
    x1, y1, x2, y2 = NEWS_PHOTO
    draw_sprite_ext("glorbin", ACTORS["glorbin"]["poses"]["alien"], (x1 + x2) // 2, y2 - 2, 1, 1, 0, "white", 1)
    for i, line in enumerate(("LUNCH LADY FROM", "OUTER SPACE!")):
        draw_centered(NEWS_X + NEWS_W / 2, NEWS_HEAD_Y + i * 11, line, "#1a1a1a")
    draw_words(4, 4, "THE END", "#ffe14d")
    draw_words(4, 186, "Click to play again", "#4fb3a9")


def draw_title(self, t, mx, my):
    draw_set_color("black")
    draw_rect(0, 0, 320, 200)
    draw_sprite("pic_title", 0, 0, 10)
    for dx, dy, col in ((1, 1, "#1b1030"), (0, 0, "#ffe14d")):
        for i, ch in enumerate("MYSTERY MEAT"):
            n = FONT_INDEX.get(ch, 0)
            if n > 0:
                draw_sprite_ext("font", n, 88 + i * 12 + dx, 14 + dy, 2, 2, 0, col)
    draw_centered(160, 38, "FROM OUTER SPACE", "#9cf06a")
    self.rows = []
    for i, m in enumerate(self.menu):
        y = 150 + i * 14
        lit = 120 <= mx < 200 and y - 2 <= my < y + 11
        draw_centered(160, y, m, VERB_LIT if lit else "#ffffff")
        self.rows.append((y - 2, y + 11))
    draw_centered(160, 190, "Pictures made with Google Gemini - Made in GameIDE", "#7f7f9f")
