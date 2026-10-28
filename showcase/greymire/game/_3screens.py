# script: screens
# Drawing the book, and what each screen offers. Book's events call these.
#
# The screen is 1280 x 720: the picture fills it, and the words sit on a
# sheet of paper down the right-hand side, where the pictures were painted
# quiet on purpose.

import math

PANEL_X, PANEL_Y, PANEL_W, PANEL_H = 780, 20, 480, 680
TEXT_X, TEXT_W = PANEL_X + 38, PANEL_W - 76
FACE_W, FACE_H = 160, 200
TEXT_SIZE = 23
INK = (43, 31, 22)
RUST = (128, 42, 22)
FADED = (112, 92, 68)
CREAM = (244, 232, 206)
AMBER = (255, 190, 90)

NAMES = {"marrow": "Old Marrow", "pip": "Pip", "gallow": "Gallow", "keeper": "Lady Ashveil", "bearer": "You"}
DUEL_PICS = {"gallow": "bridge", "watch": "street", "keeper": "tower"}
ENDING_TITLES = {"together": "The Bell and the Willow", "willow": "The Mother at the Willow",
                 "alone": "The Bell Alone", "dark": "The Mist"}
PAGE_SOUNDS = {"crossing_marrow": "whistle", "door_open": "stone", "door_wrong": "stone",
               "steal_go": "splash", "reeds_blue": "splash", "crossing_wade": "splash", "street_lost": "splash"}


# ---------------------------------------------------------------- what's on screen

def screen_key(self):
    """Changes whenever the screen should start afresh (and type its words out again)."""
    m = self.mode
    if m == "title":
        return "title"
    if m == "duel":
        d = STATE["duel"]
        return f"duel:{d['foe']}:{d.get('round', 0)}:{d['over']}"
    return f"{m}:{STATE['page']}"


def current_pic(self):
    if self.mode == "title":
        return "title"
    if self.mode == "duel":
        return DUEL_PICS[STATE["duel"]["foe"]]
    if self.mode == "end":
        return ENDINGS[STATE["page"]][0]
    return PAGES[STATE["page"]]["pic"]


def current_text(self):
    """The words that type out, already broken into lines (so a word never jumps lines as it types)."""
    draw_set_font("fell", TEXT_SIZE)
    if self.mode == "title":
        return ""
    if self.mode == "end":
        text = ENDINGS[STATE["page"]][1]
    elif self.mode == "duel":
        d = STATE["duel"]
        f = FOES[d["foe"]]
        after = {"win": f"{f['name']} is beaten.", "lose": "You can fight no more."}.get(d["over"], d["tell"])
        text = d["said"] + "\n\n" + after
    else:
        text = PAGES[STATE["page"]]["text"]
    return string_wrap(curly(text), TEXT_W)


def curly(text):
    """Book quotes: the story is typed with plain " marks, which this font prints as closing ones."""
    out, opening = [], True
    for ch in text:
        if ch == '"':
            out.append("\u201c" if opening else "\u201d")
            opening = not opening
        else:
            out.append(ch)
    return "".join(out)


def current_options(self):
    if self.mode == "title":
        return [{"text": m, "menu": m} for m in self.menu]
    if self.mode == "duel":
        return duel_choices()
    if self.mode == "end":
        out = [{"text": "Begin a new journey", "new": True}]
        if STATE["page"] == "dark" and HISTORY:
            out.append({"text": "Rewind, and try another way", "rewind": True})
        return out
    return choices_of(STATE["page"])


def choose(self, opt):
    if "menu" in opt:
        if opt["menu"].startswith("Continue") and load_journey():
            pass
        else:
            new_journey()
    elif opt.get("new"):
        new_journey()
    elif opt.get("rewind"):
        rewind()
    elif "duel" in opt:
        if opt["duel"] == "end":
            end_duel()
        else:
            strike(opt["duel"])
            d = STATE["duel"]
            d["round"] = d.get("round", 0) + 1
            sound_play(d["sound"], volume=0.8)
    else:
        take(opt)
    self.mode = STATE["mode"]
    if self.mode == "map":
        self.token = PLACES[STATE["at"]]["at"]
        self.route = []
        self.lit = 0
    elif self.mode == "end" and STATE["page"] != "dark":
        sound_play("bell")
    elif self.mode == "page" and STATE["page"] in PAGE_SOUNDS:
        sound_play(PAGE_SOUNDS[STATE["page"]], volume=0.8)


def turn_to(self, pic):
    if pic != self.pic:
        self.old_pic = self.pic
        self.pic = pic
        self.fade = 0.0
        sound_play("page", volume=0.5)


# ---------------------------------------------------------------- the map

def step_map(self, clicked):
    if self.shown != "map":
        self.shown = "map"
        self.rows = []
        turn_to(self, "map")
    if self.route:
        tx, ty = self.route[0]
        x, y = self.token
        d = point_distance(x, y, tx, ty)
        if d <= 4:
            self.token = (tx, ty)
            self.route.pop(0)
            if not self.route:
                travel(self.going)
                self.going = None
                self.mode = STATE["mode"]
        else:
            self.token = (x + (tx - x) / d * 4, y + (ty - y) / d * 4)
        return
    places = [p for p in ROUTE if p in STATE["unlocked"]]
    if not places:
        return
    if keyboard_check_pressed("left"):
        self.lit = (self.lit - 1) % len(places)
    if keyboard_check_pressed("right"):
        self.lit = (self.lit + 1) % len(places)
    self.lit = min(self.lit, len(places) - 1)
    target = None
    if keyboard_check_pressed("enter") or keyboard_check_pressed("space"):
        target = places[self.lit]
    if clicked:
        target = next((p for p in places if point_distance(mouse_x, mouse_y, *PLACES[p]["at"]) < 50), None)
    if target is None:
        return
    sound_play("pick", volume=0.5)
    if target == STATE["at"]:
        travel(target)
        self.mode = STATE["mode"]
    else:
        self.route = route_between(STATE["at"], target)
        self.going = target


def route_between(a, b):
    """The bends of the dotted path from one place to another, in order."""
    ia, ib = ROUTE.index(a), ROUTE.index(b)
    pts = []
    if ia < ib:
        for i in range(ia, ib):
            pts += PATHS[(ROUTE[i], ROUTE[i + 1])] + [PLACES[ROUTE[i + 1]]["at"]]
    else:
        for i in range(ia, ib, -1):
            pts += list(reversed(PATHS[(ROUTE[i - 1], ROUTE[i])])) + [PLACES[ROUTE[i - 1]]["at"]]
    return pts


def draw_map(self):
    draw_picture(self)
    places = [p for p in ROUTE if p in STATE["unlocked"]]
    pulse = 1 + 0.18 * math.sin(self.t / 10)
    for i, p in enumerate(places):
        x, y = PLACES[p]["at"]
        new = p not in STATE["visited"]
        draw_set_color(AMBER)
        draw_set_alpha(0.22 if new else 0.12)
        draw_circle(x, y, 30 * (pulse if new else 1))
        draw_set_alpha(0.9)
        draw_circle(x, y, 9 if new else 6)
        draw_set_alpha(1)
        lit = i == self.lit and not self.route
        label(x, y + 26, PLACES[p]["name"], RUST if lit or new else INK, center=True)
    # The lantern: a glow, and its flame.
    x, y = self.token
    draw_set_color(AMBER)
    for r, a in ((40, 0.12), (24, 0.22), (12, 0.5)):
        draw_set_alpha(a)
        draw_circle(x, y - 6, r * (0.95 + 0.05 * math.sin(self.t / 4)))
    draw_set_alpha(1)
    draw_set_color((255, 236, 180))
    draw_circle(x, y - 6, 5)
    words = f"Walking to {PLACES[self.going]['name']}…" if self.route else "Where will you go? Tap a place on the map."
    label(640, 24, words, INK, center=True)


def label(x, y, text, color, center=False, size=20, font="fell_sc"):
    """Words on a little tag of paper, readable over any picture."""
    draw_set_font(font, size)
    w = string_width(text) + 24
    h = string_height(text) + 8
    left = x - w / 2 if center else x
    draw_set_color(CREAM)
    draw_set_alpha(0.88)
    draw_rect(left, y, left + w, y + h)
    draw_set_alpha(1)
    draw_set_color(color)
    draw_text(left + 12, y + 3, text)
    return (left, y, left + w, y + h)


# ---------------------------------------------------------------- pages

def draw_picture(self):
    if self.old_pic and self.fade < 1:
        draw_sprite("pic_" + self.old_pic, 0, 0, 0)
        draw_sprite_ext("pic_" + self.pic, 0, 0, 0, 1, 1, 0, "white", self.fade)
    else:
        draw_sprite("pic_" + self.pic, 0, 0, 0)


def draw_page(self):
    # The sheet, with a shadow to lift it off the picture.
    draw_set_color((0, 0, 0))
    draw_set_alpha(0.35)
    draw_rect(PANEL_X + 8, PANEL_Y + 10, PANEL_X + PANEL_W + 8, PANEL_Y + PANEL_H + 10)
    draw_set_alpha(1)
    draw_sprite("paper", 0, PANEL_X, PANEL_Y)
    y = PANEL_Y + 34
    who, face = None, 0
    if self.mode == "page":
        who, face = PAGES[STATE["page"]]["who"], PAGES[STATE["page"]]["face"]
    # No portrait in a duel: its name is over the beads, and at full strength
    # the six ways to strike need the room.
    if who:
        draw_sprite("face_" + who, face, PANEL_X + (PANEL_W - FACE_W) // 2, y)
        y += FACE_H + 2
        draw_set_halign("center")
        draw_set_font("fell_sc", 21)
        draw_set_color(RUST)
        draw_text(PANEL_X + PANEL_W / 2, y, NAMES[who])
        draw_set_halign("left")
        y += 34
    if self.mode == "duel":
        y = draw_duel_status(y)
    if self.mode == "end":
        draw_set_halign("center")
        draw_set_font("fell_sc", 34)
        draw_set_color(RUST)
        draw_text(PANEL_X + PANEL_W / 2, y + 6, ENDING_TITLES[STATE["page"]])
        draw_set_halign("left")
        y += 64
    words = current_text(self)
    draw_set_color(INK)
    draw_text(TEXT_X, y, words[: int(self.typed)])
    y += string_height(words) + 22
    if self.typed >= len(words):
        draw_choices(self, current_options(self), y)
    else:
        self.rows = []


def draw_choices(self, options, y):
    rows = []
    draw_set_font("fell_italic", TEXT_SIZE)
    for i, o in enumerate(options):
        text = string_wrap(o["text"], TEXT_W - 30)
        h = string_height(text)
        rows.append((y - 6, y + h + 6))
        if i == self.lit:
            draw_set_color(RUST)
            draw_set_alpha(0.1)
            draw_rect(PANEL_X + 16, y - 6, PANEL_X + PANEL_W - 16, y + h + 6)
            draw_set_alpha(1)
        draw_set_color(RUST)
        cx, cy = TEXT_X + 7, y + 14
        draw_triangle(cx - 6, cy, cx, cy - 6, cx + 6, cy)
        draw_triangle(cx - 6, cy, cx, cy + 6, cx + 6, cy)
        draw_text(TEXT_X + 26, y, text)
        y += h + 14
    self.rows = rows


def draw_duel_status(y):
    d = STATE["duel"]
    f = FOES[d["foe"]]
    for name, hp, top, strength in (("You", STATE["stamina"], MAX_STAMINA, d["mine"]),
                                    (f["name"], d["hp"], f["stamina"], d["str"])):
        draw_set_font("fell_sc", 19)
        draw_set_color(INK)
        draw_text(TEXT_X, y, name)
        for i in range(top):     # stamina: a bead each
            draw_set_color(RUST if i < hp else FADED)
            draw_set_alpha(1 if i < hp else 0.3)
            draw_circle(TEXT_X + 150 + i * 16, y + 13, 6)
        draw_set_alpha(1)
        if name == "You":        # strength, which only you need to see
            for i in range(MAX_STRENGTH):
                draw_set_color(AMBER if i < strength else FADED)
                draw_set_alpha(1 if i < strength else 0.3)
                draw_rect(TEXT_X + 150 + i * 22, y + 32, TEXT_X + 166 + i * 22, y + 42)
            draw_set_alpha(1)
            draw_set_font("fell_italic", 16)
            draw_set_color(FADED)
            draw_text(TEXT_X + 270, y + 26, "strength")
            y += 52
        else:
            y += 34
    return y + 10


def draw_status():
    bits = [f"Stamina {STATE['stamina']} of {MAX_STAMINA}", f"Gold {STATE['gold']}"]
    carried = [ITEM_NAMES[i] for i in STATE["items"]]
    line2 = ("Carrying: " + ", ".join(carried)) if carried else ""
    if "pip" in STATE["flags"]:
        line2 = (line2 + " · " if line2 else "") + "Pip is with you"
    text = "   ".join(bits) + ("\n" + line2 if line2 else "")
    draw_set_font("fell", 19)
    h = string_height(text) + 14
    w = max(string_width(t) for t in text.split("\n")) + 28
    draw_set_color(CREAM)
    draw_set_alpha(0.85)
    draw_rect(20, 700 - h, 20 + w, 700)
    draw_set_alpha(1)
    draw_set_color(INK)
    draw_text(34, 707 - h, text)


REWIND_BOX = (20, 20, 152, 58)


def draw_rewind():
    label(REWIND_BOX[0], REWIND_BOX[1], "« Rewind", RUST, size=22)


def on_rewind():
    x1, y1, x2, y2 = REWIND_BOX
    return x1 <= mouse_x < x2 and y1 <= mouse_y < y2


# ---------------------------------------------------------------- the title

def draw_title(self):
    cx = 1030
    draw_set_halign("center")
    draw_set_font("fell_sc", 66)
    for dx, dy, col in ((3, 4, (10, 14, 16)), (0, 0, CREAM)):
        draw_set_color(col)
        draw_set_alpha(0.7 if dx else 1)
        draw_text(cx + dx, 120 + dy, "The Lantern")
        draw_text(cx + dx, 196 + dy, "of Greymire")
    draw_set_alpha(1)
    draw_set_font("fell_italic", 24)
    draw_set_color(AMBER)
    draw_text(cx, 286, "an illustrated tale of the marsh")
    rows = []
    y = 380
    draw_set_font("fell_sc", 30)
    for i, m in enumerate(self.menu):
        lit = i == self.lit
        if lit:
            draw_set_color(AMBER)
            draw_set_alpha(0.16)
            draw_rect(cx - 210, y - 8, cx + 210, y + 44)
            draw_set_alpha(1)
        draw_set_color(AMBER if lit else CREAM)
        draw_text(cx, y, m)
        rows.append((y - 8, y + 44))
        y += 64
    self.rows = rows
    found = save_get("endings", [])
    draw_set_font("fell_italic", 19)
    draw_set_color(CREAM)
    if found:
        draw_text(cx, y + 10, f"Endings found: {len(found)} of {len(ENDINGS)}")
    draw_set_font("fell_italic", 16)
    draw_set_alpha(0.85)
    draw_text(cx, 664, "Pictures made with Google Gemini · Type: IM Fell, by Igino Marini")
    draw_text(cx, 686, "Made in GameIDE")
    draw_set_alpha(1)
    draw_set_halign("left")
