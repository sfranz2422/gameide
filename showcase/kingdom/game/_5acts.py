# script: acts
# What every Button does, and what a tap or a drag does on the map, as in Cloverbrook.
#
#   Tap a building       its window: what it does now and at the next level, Upgrade
#   Tap a ready mine     its gold is collected (a farm: its food); tap again for its window
#   Tap a tree or rock   clear it, for a little gold or food
#   Build window         Economy, Defense, Army and Walls tabs; pick one, tap where it goes
#   Walls                tap or drag along the grass: a wall on every tile crossed
#   Move                 in a building's window: tap where it goes
#   Drag anywhere else   the map moves
import math
import random

DRAG_START = 10             # pixels a press must move before it's a drag, not a tap
HUD_H = 56                  # the bar along the top
SHOP_ROW = 46

_order = [0]


def realm():
    return global_vars.realm


def make_button(x, y, wide, high, words, act, arg=None, size=16, in_panel=False):
    b = instance_create(x, y, "Button")
    b.wide, b.high, b.words, b.act, b.arg, b.size, b.in_panel = wide, high, words, act, arg, size, in_panel
    _order[0] += 1
    b.order = _order[0]
    return b


def say(words, colour=INK):
    global_vars.said = [words, colour, 170]


# ---- the camera

def shown(z=None):
    """How much of the world the view shows (zoomed out, more than the screen), at the
    zoom now or at `z`."""
    z = z or zoom()
    return VIEW_W / z, VIEW_H / z


def move_camera(x, y):
    w, h = shown()
    global_vars.cam = [clamp(x, 0, max(0, WORLD_W - w)), clamp(y, 0, max(0, WORLD_H - h))]


def set_zoom(z, at=None):
    """Zooms in or out about the middle of the view, or about `at` (a point on the
    screen: the mouse wheel zooms about where the pointer is, which stays put)."""
    w, h = shown()
    sx, sy = at if at is not None else (VIEW_W / 2, VIEW_H / 2)
    old = zoom()
    mx, my = global_vars.cam[0] + sx / old, global_vars.cam[1] + sy / old
    global_vars.zoom = z
    camera_zoom(z)
    w, h = shown(z)                      # the engine shows the new zoom from the next step
    global_vars.cam = [clamp(mx - sx / z, 0, max(0, WORLD_W - w)), clamp(my - sy / z, 0, max(0, WORLD_H - h))]


def zoom_by(step, at=None):
    """`step` steps further out (below 0) or closer, as far as ZOOMS goes."""
    i = min(range(len(ZOOMS)), key=lambda k: abs(ZOOMS[k] - global_vars.zoom))
    z = ZOOMS[clamp(i + step, 0, len(ZOOMS) - 1)]
    if z != global_vars.zoom:
        set_zoom(z, at)


def look_at(gx, gy):
    """The view moves just enough to keep a tile on screen (the keys' cursor)."""
    x, y = tile_xy(gx, gy)
    cx, cy = global_vars.cam
    w, h = shown()
    margin = 140 / zoom()
    nx = min(max(cx, x - w + margin), x - margin)
    ny = min(max(cy, y - h + margin), y - margin - HUD_H / zoom())
    move_camera(nx, ny)


# ---- a tap on the map

def tap_tile(t):
    r = realm()
    if t is None:
        return
    b = building_at(r, *t)
    if b is not None:
        if maker(b) and waiting(b) > 0 and global_vars.chosen is not b:
            got = collect(r, b)
            global_vars.chosen = b
            if got:
                sound_play("coin", volume=0.6)
                x, y = building_xy(b["kind"], b["gx"], b["gy"])
                global_vars.pops.append([makes(b), x, y - 70, 0, got])
                keep_save(r)
            else:
                sound_play("nope", volume=0.5)
                say(f"Your {'treasuries are' if makes(b) == 'gold' else 'granaries are'} full: upgrade or build another.", RED)
            return
        global_vars.chosen = b
        open_panel("building", r["buildings"].index(b))
        return
    o = obstacle_at(r, *t)
    if o is not None:
        global_vars.chosen = None
        open_panel("obstacle", r["obstacles"].index(o))
        return
    global_vars.chosen = None


def level_up(gained):
    for level in gained:
        global_vars.levelup = [level, 220]
        sound_play("levelup", volume=0.6)
        effect("confetti", view_x + VIEW_W / 2, view_y + 120, None, 1.5)


# ---- the pointer

def over_gui(sx, sy):
    if sy < HUD_H:
        return True
    if any(b.shown and inside(b, sx, sy) for b in instances("Button")):
        return True
    box = global_vars.panel_box
    return bool(global_vars.panel and box and box[0] <= sx <= box[2] and box[1] <= sy <= box[3])


def dragged():
    return global_vars.drag


def pointer():
    """Once a step on the map: a press, a drag, a let-go."""
    d = global_vars.drag
    sx, sy = gui_mouse()
    if mouse_check_pressed("left"):
        d = None
        if over_gui(sx, sy):
            if global_vars.panel and not any(b.shown and inside(b, sx, sy) for b in instances("Button")):
                box = global_vars.panel_box
                if not (box[0] <= sx <= box[2] and box[1] <= sy <= box[3]):
                    close_panel()
        elif global_vars.panel:
            close_panel()
        else:
            t = tile_at(mouse_x, mouse_y)
            if global_vars.placing == "wall":
                d = {"mode": "wall", "done": set()}
            elif global_vars.placing:
                d = {"mode": "place", "tile": t}
            else:
                d = {"mode": "pan", "tile": t}
        if d is not None:
            d.update({"sx": sx, "sy": sy, "cam": list(global_vars.cam), "moved": False})
        global_vars.drag = d
    if d is None:
        return
    if abs(sx - d["sx"]) + abs(sy - d["sy"]) > DRAG_START:
        d["moved"] = True
    t = tile_at(mouse_x, mouse_y)
    if d["mode"] == "pan" or (d["mode"] == "place" and d["moved"]):
        if d["moved"]:
            # The pointer moved on the screen; the world moves that far at its zoom.
            move_camera(d["cam"][0] - (sx - d["sx"]) / zoom(), d["cam"][1] - (sy - d["sy"]) / zoom())
    elif d["mode"] == "wall" and t is not None and t not in d["done"]:
        # Walls: one on every free tile the pointer crosses (a tap lays one).
        d["done"].add(t)
        if fits(realm(), "wall", *t) and place_wall(t) != "built":
            d["mode"] = "stopped"
    if mouse_check_released("left") or not mouse_check("left"):
        global_vars.drag = None
        if d["moved"]:
            return
        if d["mode"] == "pan":
            tap_tile(d["tile"])
        elif d["mode"] == "place":
            place_at(d["tile"])


# ---- the keys on the map

def cursor_step(c, name):
    """Where an arrow moves the keys' cursor: up and down a row of the screen, left and
    right half a tile, zigzagging (Cloverbrook's: whole steps reached half the tiles)."""
    odd = (c[0] + c[1]) % 2
    dx, dy = {"left": (-1, 0) if odd else (0, 1), "right": (0, -1) if odd else (1, 0),
              "up": (-1, -1), "down": (1, 1)}[name]
    for nx, ny in ((c[0] + dx, c[1] + dy), (c[0] + dx, c[1]), (c[0], c[1] + dy)):
        if on_map(nx, ny):
            return (nx, ny)
    return c


def keys_on_map():
    """Arrows move the cursor; Space taps it; B opens the Build window; Q and E (and the
    mouse wheel) zoom out and in; Escape lets go."""
    c = global_vars.cursor
    for name in ("left", "right", "up", "down"):
        if act(name):
            c = cursor_step(c, name)
    if c != global_vars.cursor:
        global_vars.cursor = c
        look_at(*c)
    if act("ok"):
        if global_vars.placing == "wall":
            if fits(realm(), "wall", *c):
                place_wall(c)
        elif global_vars.placing:
            place_at(c)
        else:
            tap_tile(c)
    if keyboard_check_pressed("b"):
        open_panel("shop")
    # The mouse wheel: up zooms in, down out, about the pointer (not over a window or the bar).
    turned = mouse_wheel()
    if turned and not over_gui(*gui_mouse()):
        zoom_by(1 if turned > 0 else -1, gui_mouse())
    # Q out, E in (the engine knows letters and digits, not - and =).
    if keyboard_check_pressed("q"):
        zoom_by(-1)
    if keyboard_check_pressed("e"):
        zoom_by(1)
    if act("back"):
        global_vars.chosen = None
        global_vars.placing = False
        global_vars.moving = None


# ---- battles: the pointer and the keys on the battlefield

HOLD_SEND = 18              # steps the pointer is held still before troops keep coming
HOLD_EVERY = 5              # …one every this many steps


def send_troop(field, at, quiet=False):
    """Puts the chosen troop down at `at` (tiles, fractions): 'sent', or why not (said,
    unless `quiet`: while held, a step too close says nothing)."""
    b = global_vars.battle
    if at is None:
        return None
    if field.spell is not None:
        # A spell: anywhere, even inside the village; tapped, not held.
        if quiet:
            return None
        res = cast(b, field.spell, at[0], at[1])
        if res == "cast":
            sound_play("levelup", volume=0.4)
            effect("sparkle" if field.spell != "lightning" else "explosion", *tile_xy(*at), None, 1.2)
            field.spell = None
        else:
            sound_play("nope", volume=0.4)
            say(res, RED)
        return res
    if field.chosen is None:
        return None
    res = deploy(b, field.chosen, at[0], at[1])
    if res == "sent":
        sound_play("click", volume=0.3)
    elif not quiet:
        sound_play("nope", volume=0.4)
        say(res, RED)
    return res


def battle_pointer(field):
    """Tap to put a troop down, hold still to keep putting them down, drag to look round,
    the wheel to zoom."""
    d = global_vars.drag
    sx, sy = gui_mouse()
    if mouse_check_pressed("left"):
        d = None
        if not over_gui(sx, sy):
            d = {"sx": sx, "sy": sy, "cam": list(global_vars.cam), "moved": False, "held": 0}
        global_vars.drag = d
    turned = mouse_wheel()
    if turned and not over_gui(sx, sy):
        zoom_by(1 if turned > 0 else -1, (sx, sy))
    if d is None:
        return
    if abs(sx - d["sx"]) + abs(sy - d["sy"]) > DRAG_START:
        d["moved"] = True
    if d["moved"]:
        move_camera(d["cam"][0] - (sx - d["sx"]) / zoom(), d["cam"][1] - (sy - d["sy"]) / zoom())
    else:
        d["held"] += 1
        if d["held"] > HOLD_SEND and d["held"] % HOLD_EVERY == 0:
            gx, gy = tile_frac(mouse_x, mouse_y)
            send_troop(field, (gx + random.uniform(-0.3, 0.3), gy + random.uniform(-0.3, 0.3)), quiet=True)
    if mouse_check_released("left") or not mouse_check("left"):
        global_vars.drag = None
        if not d["moved"] and d["held"] <= HOLD_SEND:
            send_troop(field, tile_frac(mouse_x, mouse_y))


def battle_keys(field):
    """Arrows move the cursor round the field, Space sends the chosen troop there, Q and E zoom."""
    c = global_vars.cursor
    for name in ("left", "right", "up", "down"):
        if act(name):
            c = cursor_step(c, name)
    if c != global_vars.cursor:
        global_vars.cursor = c
        look_at(*c)
    if act("ok") and keyed():
        send_troop(field, c)
    if keyboard_check_pressed("q"):
        zoom_by(-1)
    if keyboard_check_pressed("e"):
        zoom_by(1)


# ---- placing: a new building, walls, or one being moved (the tapped tile is its top corner)

def place_at(t):
    if t is None:
        return
    if global_vars.placing == "move":
        place_move(t)
    else:
        place_building(global_vars.placing, t)


def place_building(kind, t):
    r = realm()
    res, gained = build(r, kind, *t)
    if res == "built":
        sound_play("build", volume=0.6)
        x, y = building_xy(kind, *t)
        effect("dust", x, y, None, 1.5)
        global_vars.placing = False
        keep_save(r)
        level_up(gained)
        say(f"A {info(kind)['name'].lower()}! " + ("Your builder's on it." if kind != "builder_hut" else "One more builder."), MINT)
    elif res == "taken":
        sound_play("nope", volume=0.5)
        n = info(kind)["size"]
        say(f"There isn't room there: it needs {n} × {n} clear tiles.", RED)
    else:
        sound_play("nope", volume=0.5)
        say(res, RED)
        global_vars.placing = False
    return res


def place_wall(t):
    """A wall on a tile; more can follow while there are walls and gold for them."""
    r = realm()
    res, gained = build(r, "wall", *t)
    if res == "built":
        sound_play("build", volume=0.35)
        keep_save(r)
        level_up(gained)
        if can_build(r, "wall"):
            global_vars.placing = False
            say(can_build(r, "wall"), GOLD)
    elif res != "taken":
        sound_play("nope", volume=0.5)
        say(res, RED)
        global_vars.placing = False
    return res


def place_move(t):
    r = realm()
    b = global_vars.moving
    if b is None:
        return
    if move(r, b, *t):
        sound_play("build", volume=0.5)
        global_vars.moving = None
        global_vars.placing = False
        keep_save(r)
    else:
        sound_play("nope", volume=0.5)
        n = info(b["kind"])["size"]
        say(f"There isn't room there: it needs {n} × {n} clear tiles.", RED)


# ---- windows

def building_box(b):
    """The building window's corners: shorter for a hut (nothing to upgrade; a big empty
    window round one line, 2026-11-18)."""
    h = 270 if b["kind"] == "builder_hut" else 400
    x1, y1 = VIEW_W / 2 - 340, VIEW_H / 2 - h / 2
    return x1, y1, x1 + 680, y1 + h


def close_panel():
    for b in instances("Button"):
        if b.in_panel:
            b.destroy()
    global_vars.panel = None
    global_vars.panel_box = None
    global_vars.focus = None


def open_panel(kind, of=None):
    """Opens (or redraws) a window and its buttons. `of`: which building or obstacle.
    Redrawn (its clock), the keys stay on the same button."""
    was = global_vars.focus
    was = (was.act, was.arg) if was is not None and global_vars.panel == kind else None
    close_panel()
    global_vars.placing = False
    global_vars.moving = None
    global_vars.panel = kind
    global_vars.panel_of = of
    r = realm()
    if kind == "building":
        b = r["buildings"][of]
        x1, y1, x2, y2 = building_box(b)
        global_vars.panel_box = (x1, y1, x2, y2)
        by = y2 - 70                     # the row of buttons along the bottom
        if b["job"] is not None:
            make_button(x1 + 30, by, 220, 48, "Cancel (half back)", "cancel", of, 15, True)
        elif b["kind"] != "builder_hut":
            why = can_upgrade(r, b)
            to = b["level"] + 1
            words = "Upgrade" if to <= levels(b["kind"]) else "Top level"
            if to <= levels(b["kind"]) and b["kind"] != "builder_hut":
                words = f"Upgrade: {big_number(info(b['kind'])['cost'][to - 1])} {info(b['kind'])['pays']}"
            u = make_button(x1 + 30, by, 300, 48, words, "upgrade", of, 16, True)
            u.off = why is not None
            u.hot = not u.off
            if b["kind"] == "wall":
                same = sum(1 for w in r["buildings"] if w["kind"] == "wall" and w["level"] == b["level"])
                a = make_button(x1 + 340, by, 200, 48, f"Every level {b['level']} wall ({same})", "walls_all", b["level"], 13, True)
                a.off = u.off
        if maker(b) and waiting(b) > 0:
            make_button(x1 + 30, by - 58, 220, 44, f"Collect {big_number(waiting(b))}", "collect", of, 15, True)
        make_button(x2 - 120, by, 96, 48, "Move", "move", of, 15, True)
        if b["kind"] in ("barracks", "army_camp") and b["level"] > 0:
            make_button(x2 - 300, by, 170, 48, "Train troops", "army", None, 15, True)
        if b["kind"] == "forge" and b["level"] > 0:
            make_button(x2 - 300, by, 170, 48, "Research", "forge", None, 15, True)
    elif kind == "army":
        x1, y1 = VIEW_W / 2 - 400, HUD_H + 6
        global_vars.panel_box = (x1, y1, x1 + 800, y1 + 108 + len(TROOPS) * ARMY_ROW)
        tab = getattr(global_vars, "army_tab", "troops")
        for j, (t_, words) in enumerate((("troops", "Troops"), ("spells", "Spells"), ("champions", "Champions"))):
            b = make_button(x1 + 230 + j * 120, y1 + 10, 112, 36, words, "army_tab", t_, 14, True)
            b.picked = t_ == tab
        for i, k in enumerate(SPELLS if tab == "spells" else []):
            y = y1 + 92 + i * ARMY_ROW
            why = can_brew(r, k)
            t = make_button(x1 + 610, y, 130, ARMY_ROW - 8, f"Brew: {SPELLS[k]['cost']:,} gold" if not why or why.startswith("That needs")
                            else ("Locked" if why.startswith("Upgrade") else "No room"), "brew", k, 13, True)
            t.off = why is not None
            t.hot = not t.off
            u = make_button(x1 + 746, y, 40, ARMY_ROW - 8, "-", "unbrew", k, 18, True)
            u.off = k not in r["brewing"]
        for i, k in enumerate(TROOPS if tab == "troops" else []):
            y = y1 + 92 + i * ARMY_ROW
            why = can_train(r, k)
            t = make_button(x1 + 610, y, 130, ARMY_ROW - 8, f"Train: {TROOPS[k]['cost']} food" if not why or why.startswith("That needs")
                            else ("Locked" if why.startswith("Upgrade") else "No room"), "train", k, 13, True)
            t.off = why is not None
            t.hot = not t.off
            u = make_button(x1 + 746, y, 40, ARMY_ROW - 8, "-", "untrain", k, 18, True)
            u.off = k not in r["training"]
    elif kind == "campaign":
        x1, y1 = VIEW_W / 2 - 490, HUD_H + 4
        global_vars.panel_box = (x1, y1, x1 + 980, y1 + 66 + 4 * CAMP_ROW)
        tab = getattr(global_vars, "attack_tab", "villages")
        for j, (t, words) in enumerate((("villages", "Villages"), ("classmates", "Classmates"))):
            b = make_button(x1 + 190 + j * 130, y1 + 10, 122, 38, words, "attack_tab", t, 15, True)
            b.picked = t == tab
        if tab == "classmates":
            f = make_button(x1 + 30, y1 + 150, 300, 54, f"Find a kingdom: {search_cost(r):,} gold", "search", None, 17, True)
            f.off = not raid_online() or army_size(r) == 0 or r["gold"] < search_cost(r) or global_vars.searching
            f.hot = not f.off
            for i, d in enumerate(((raid_news() or {}).get("defenses") or [])[:DEFENSE_ROWS]):
                make_button(x1 + 860, y1 + 84 + i * DEFENSE_ROW, 96, 40, "Watch", "watch", i, 14, True)
        for i, v in enumerate(CAMPAIGN if tab == "villages" else []):
            cx, cy = x1 + 16 + (i % 4) * 240, y1 + 58 + (i // 4) * CAMP_ROW
            a = make_button(cx + 140, cy + CAMP_ROW - 48, 84, 36, "Attack", "attack", i, 14, True)
            a.off = not village_open(r, i) or army_size(r) == 0
            a.hot = not a.off
    elif kind == "forge":
        x1, y1 = VIEW_W / 2 - 400, HUD_H + 6
        global_vars.panel_box = (x1, y1, x1 + 800, y1 + 108 + len(TROOPS) * ARMY_ROW)
        for i, k in enumerate(TROOPS):
            y = y1 + 92 + i * ARMY_ROW
            why = can_research(r, k)
            to = troop_level(r, k) + 1
            words = (f"Level {to}: {RESEARCH_COST[to - 1]:,} gold" if to <= TROOP_LEVEL_MOST and (not why or why.startswith("That needs"))
                     else "Top level" if to > TROOP_LEVEL_MOST else "Busy" if why and "busy" in why else "Locked")
            t = make_button(x1 + 576, y, 210, ARMY_ROW - 8, words, "research", k, 13, True)
            t.off = why is not None
            t.hot = not t.off
    elif kind == "alliance":
        x1, y1 = VIEW_W / 2 - 480, HUD_H + 4
        global_vars.panel_box = (x1, y1, x1 + 960, y1 + 508)
        al = my_alliance()
        news = ally_news() or {}
        if al is None:
            for i, a in enumerate(news.get("school", [])[:ALLY_ROWS]):
                j = make_button(x1 + 470, y1 + 84 + i * 50, 90, 38, "Join", "ally_join", a["id"], 14, True)
                j.off = a["members"] >= 20
            px = x1 + 620
            for n, (label, y) in enumerate((("First word", 120), ("Second word", 180), ("Banner", 240))):
                make_button(px, y1 + y, 40, 36, "<", "ally_pick", (n, -1), 16, True)
                make_button(px + 270, y1 + y, 40, 36, ">", "ally_pick", (n, 1), 16, True)
            f = make_button(px, y1 + 360, 310, 50, "Found it", "ally_found", None, 18, True)
            f.off = not raid_online()
            f.hot = not f.off
        else:
            tab = getattr(global_vars, "ally_tab", "members")
            for j, (t_, words) in enumerate((("members", "Members"), ("troops", "Troops"), ("chat", "Chat"))):
                b = make_button(x1 + 420 + j * 120, y1 + 10, 112, 36, words, "ally_tab", t_, 14, True)
                b.picked = t_ == tab
            make_button(x1 + 790, y1 + 10, 100, 36, "Leave", "ally_leave", None, 14, True)
            if tab == "troops":
                a = make_button(x1 + 30, y1 + 70, 300, 46, f"Ask for troops ({hall_room(r)} room)", "ally_ask", None, 15, True)
                a.off = can_ask(r) is not None
                a.hot = not a.off
                for i, q in enumerate([q for q in al["requests"] if not q["yours"]][:ALLY_ROWS]):
                    g = make_button(x1 + 780, y1 + 136 + i * 46, 140, 38, "Give a troop", "ally_give", q["id"], 13, True)
                    g.off = can_give(r, q) is not None
                    g.hot = not g.off
            elif tab == "chat":
                for n, words in enumerate(PHRASES):
                    make_button(x1 + 480 + (n % 2) * 232, y1 + 64 + (n // 2) * 54, 224, 46, words, "ally_say", n, 13, True)
    elif kind == "obstacle":
        o = r["obstacles"][of]
        x1, y1 = VIEW_W / 2 - 240, VIEW_H / 2 - 110
        global_vars.panel_box = (x1, y1, x1 + 480, y1 + 220)
        oi = OBSTACLES[o[0]]
        c = make_button(x1 + 30, y1 + 150, 260, 46, f"Clear it: {oi['cost']} {oi['pays']}", "clear", of, 16, True)
        c.off = not can_pay(r, oi["pays"], oi["cost"])
        c.hot = not c.off
    elif kind == "shop":
        tab = global_vars.shop_tab
        rows = shop_rows(r, tab)
        x1, y1 = VIEW_W / 2 - 380, HUD_H + 8
        global_vars.panel_box = (x1, y1, x1 + 760, y1 + 66 + max(len(rows), 3) * SHOP_ROW)
        for j, (t, words) in enumerate(GROUPS):
            b = make_button(x1 + 110 + j * 112, y1 + 10, 104, 38, words, "shop_tab", t, 14, True)
            b.picked = t == tab
        for i, (k, name, price, pays, why) in enumerate(rows):
            b = make_button(x1 + 500, y1 + 60 + i * SHOP_ROW, 230, SHOP_ROW - 8,
                            why if why else f"{big_number(price)} {pays}", "buy", k, 14, True)
            b.off = bool(why)
            b.hot = not b.off
    box = global_vars.panel_box
    make_button(box[2] - 46, box[1] + 8, 38, 34, "X", "close", None, 16, True)
    if was is not None:
        global_vars.focus = next((b for b in instances("Button") if b.in_panel and (b.act, b.arg) == was), None)


ALLY_ROWS = 8              # alliances listed, or requests shown
ARMY_ROW = 52              # the Army window's rows, a troop each
CAMP_ROW = 112             # the Attack window's cards, four to a row
DEFENSE_ROWS, DEFENSE_ROW = 8, 56   # the Classmates tab's raids on you


def shop_rows(r, tab):
    """A tab of the Build window: (kind, name, price, paid in, why it can't be bought now, or "")."""
    rows = []
    for kind, i in BUILDINGS.items():
        if i["group"] != tab or kind == "keep":
            continue
        if kind == "builder_hut":
            price = builder_cost(r)
            rows.append((kind, i["name"], price or 0, "gold", "" if price is not None and can_pay(r, "gold", price)
                         else ("All five built" if price is None else f"Needs {big_number(price)} gold")))
            continue
        why = can_build(r, kind) or ""
        if why.startswith("Upgrade your keep to level"):
            why = "Keep level " + why.split("level ")[1].split()[0].rstrip(".")
        elif why.startswith("That needs"):
            why = "Needs " + why[len("That needs "):].rstrip(".")
        elif why == "You have all you can build.":
            why = "All built"
        elif why == "Every builder is busy.":
            why = "Builders busy"
        rows.append((kind, i["name"], i["cost"][0], i["pays"], why))
    return rows


def do_act(what, arg):
    r = getattr(global_vars, "realm", None)       # None on the title: no kingdom loaded yet
    if what == "play":
        room_goto("Realm")
    elif what == "close":
        close_panel()
    elif what == "research":
        res = research(r, arg)
        if res == "started":
            sound_play("build", volume=0.5)
            keep_save(r)
        else:
            sound_play("nope", volume=0.5)
            say(res, RED)
        open_panel("forge")
    elif what == "ally_tab":
        global_vars.ally_tab = arg
        open_panel("alliance")
    elif what == "ally_pick":
        n, d = arg
        pick = list(getattr(global_vars, "ally_pick", [0, 0, 0]))
        sizes = [len(ALLY_FIRST), len(ALLY_SECOND), len(BANNERS)]
        pick[n] = (pick[n] + d) % sizes[n]
        global_vars.ally_pick = pick
    elif what == "ally_found":
        pick = getattr(global_vars, "ally_pick", [0, 0, 0])
        ally_create(pick[0], pick[1], pick[2])
        sound_play("levelup", volume=0.5)
        say(f"{ally_name(pick[:2])} is founded!", MINT)
    elif what == "ally_join":
        ally_join(arg)
        sound_play("click", volume=0.5)
    elif what == "ally_leave":
        ally_leave()
        sound_play("click", volume=0.5)
        close_panel()
    elif what == "ally_ask":
        res = ask_troops(r)
        if res == "asked":
            sound_play("click", volume=0.5)
            say("Your allies can see you're asking.", MINT)
        else:
            say(res, RED)
    elif what == "ally_give":
        req = next((q for q in (my_alliance() or {}).get("requests", []) if q["id"] == arg), None)
        res = give_troop(r, req) if req else "That request's gone."
        if res == "given":
            sound_play("coin", volume=0.5)
            keep_save(r)
            open_panel("alliance")
        else:
            say(res, RED)
    elif what == "ally_say":
        ally_say(arg)
        sound_play("click", volume=0.4)
    elif what in ("shop", "army", "campaign", "forge", "alliance"):
        if global_vars.panel == what:
            close_panel()
        else:
            open_panel(what)
    elif what == "train":
        res = train(r, arg)
        if res == "queued":
            sound_play("click", volume=0.4)
            keep_save(r)
        else:
            sound_play("nope", volume=0.5)
            say(res, RED)
        open_panel("army")
    elif what == "army_tab":
        global_vars.army_tab = arg
        open_panel("army")
    elif what == "brew":
        res = brew(r, arg)
        if res == "queued":
            sound_play("click", volume=0.4)
            keep_save(r)
        else:
            sound_play("nope", volume=0.5)
            say(res, RED)
        open_panel("army")
    elif what == "unbrew":
        if unbrew(r, arg):
            keep_save(r)
        open_panel("army")
    elif what == "spell":
        for f in instances("Battlefield"):
            f.spell = None if f.spell == arg else arg
    elif what == "ability":
        res = ability(global_vars.battle, arg)
        if res == "used":
            sound_play("levelup", volume=0.5)
            u = champ_unit(global_vars.battle, arg)
            effect("sparkle", *tile_xy(u["x"], u["y"]), None, 1.5)
        else:
            say(res, RED)
    elif what == "untrain":
        if untrain(r, arg):
            keep_save(r)
        open_panel("army")
    elif what == "attack":
        b = start_raid(r, arg)
        if isinstance(b, str):
            sound_play("nope", volume=0.5)
            say(b, RED)
        else:
            close_panel()
            global_vars.battle = b
            global_vars.raid = {"kind": "village", "village": arg, "name": CAMPAIGN[arg]["name"]}
            room_goto("Battle")
    elif what == "attack_tab":
        global_vars.attack_tab = arg
        open_panel("campaign")
    elif what in ("search", "next_raid"):
        res = search(r)
        if res == "searching":
            sound_play("click", volume=0.5)
            global_vars.searching = True
            keep_save(r)
            if what == "next_raid":
                room_goto("Realm")          # back home while the next one's found; it opens the battle
            else:
                open_panel("campaign")
        else:
            sound_play("nope", volume=0.5)
            say(res, RED)
    elif what == "watch":
        d = raid_news()["defenses"][arg]
        close_panel()
        global_vars.battle = new_battle(found_layout(d), replay_army(d["replay"]), [d["gold"], d["food"]])
        global_vars.raid = {"kind": "replay", "name": d["name"], "steps": d["replay"]}
        room_goto("Battle")
    elif what == "troop":
        for f in instances("Battlefield"):
            f.chosen, f.spell = arg, None
    elif what == "end_battle":
        end_battle(global_vars.battle)
    elif what == "go_home":
        room_goto("Realm")
    elif what == "shop_tab":
        global_vars.shop_tab = arg
        open_panel("shop")
    elif what == "buy":
        close_panel()
        global_vars.placing = arg
        if arg == "wall":
            say("Tap or drag along the grass to lay walls. Done when you're finished.", MINT)
        else:
            n = info(arg)["size"]
            say(f"Tap where the {info(arg)['name'].lower()} goes: it needs {n} × {n} clear tiles.", MINT)
    elif what == "upgrade":
        b = r["buildings"][arg]
        res, gained = upgrade(r, b)
        if res in ("started", "done"):
            sound_play("build", volume=0.6)
            x, y = building_xy(b["kind"], b["gx"], b["gy"])
            effect("dust", x, y, None, 1.2)
            level_up(gained)
            keep_save(r)
            close_panel()
            say(f"{info(b['kind'])['name']} to level {b['level'] + (1 if res == 'started' else 0)}" +
                (f": ready in {clock_words(time_left(b))}." if res == "started" else "!"), MINT)
        else:
            sound_play("nope", volume=0.5)
            say(res, RED)
    elif what == "walls_all":
        n = wall_upgrade_all(r, arg)
        if n:
            sound_play("build", volume=0.6)
            keep_save(r)
            say(f"{n} wall{'s' if n != 1 else ''} up to level {arg + 1}!", MINT)
        close_panel()
    elif what == "cancel":
        b = r["buildings"][arg]
        cancel(r, b)
        keep_save(r)
        close_panel()
    elif what == "collect":
        b = r["buildings"][arg]
        got = collect(r, b)
        if got:
            sound_play("coin", volume=0.6)
            keep_save(r)
        open_panel("building", arg)
    elif what == "move":
        b = r["buildings"][arg]
        close_panel()
        global_vars.placing = "move"
        global_vars.moving = b
        say("Tap where it goes (its top corner).", MINT)
    elif what == "clear":
        o = r["obstacles"][arg]
        res, gained = clear(r, o)
        if res == "cleared":
            sound_play("build", volume=0.5)
            x, y = tile_xy(o[1], o[2])
            effect("dust", x, y, None, 1)
            level_up(gained)
            keep_save(r)
            close_panel()
        else:
            sound_play("nope", volume=0.5)
            say(res, RED)
    elif what == "zoom":
        zoom_by(arg)
    elif what == "stop_placing":
        global_vars.placing = False
        global_vars.moving = None
    elif what == "title":
        room_goto("Title")
