# script: acts
# What every Button does, and what a tap or a drag does on the map. All of it is
# here, so a click, a tap on a phone, the keys and a pad end up in the same place.
#
#   Tap bare soil        it's chosen, and the seed bar opens: tap a seed to plant it
#   Drag from a seed     every bare field the pointer crosses is planted
#   Tap a ripe field     it's harvested; drag from it and every ripe field crossed is
#   Tap a growing field  how long it has left
#   Tap the barn         what's in it, to sell; the board: the orders
#   Tap an animal home   collect what's ready and feed the hungry; nothing to do: its window
#   Tap a factory        collect what's finished; nothing finished: its window, to make more
#   Drag anywhere else   the map moves
import random

SHOP_ROW = 44               # the Build window's rows: ten of them fit the screen
DRAG_START = 10             # pixels a press must move before it's a drag, not a tap
HUD_H = 52                  # the bar along the top
PAN_KEYS = 12               # pixels a step the arrows move the view when it follows the cursor

_order = [0]


def farm():
    return global_vars.farm


def make_button(x, y, wide, high, words, act, arg=None, size=16, in_panel=False):
    b = instance_create(x, y, "Button")
    b.wide, b.high, b.words, b.act, b.arg, b.size, b.in_panel = wide, high, words, act, arg, size, in_panel
    _order[0] += 1
    b.order = _order[0]
    return b


def say(words, colour=INK):
    global_vars.said = [words, colour, 150]


# ---- the camera

def move_camera(x, y):
    global_vars.cam = [clamp(x, 0, WORLD_W - VIEW_W), clamp(y, 0, WORLD_H - VIEW_H)]


def look_at(gx, gy):
    """The view moves just enough to keep a tile on screen (the keys' cursor)."""
    x, y = tile_xy(gx, gy)
    cx, cy = global_vars.cam
    margin = 140
    nx = min(max(cx, x - VIEW_W + margin), x - margin)
    ny = min(max(cy, y - VIEW_H + margin), y - margin - HUD_H)
    move_camera(nx, ny)


# ---- what's on a tile

def building_at(gx, gy):
    for kind, bx, by in START_FARM:
        if (gx, gy) in footprint_tiles(kind, bx, by):
            return kind
    return None


BUILDING_WORDS = {
    "house": "Your farmhouse.",
    "silo": "The silo. Animals and their feed are coming to the farm soon.",
    "truck": "The delivery truck. Big deliveries are coming soon.",
    "stand": "The farm stand. Selling is done from the barn for now.",
}


def tap_tile(t):
    """A tap on the map (or Space on the keys' cursor)."""
    f = farm()
    if t is None:
        global_vars.sel = None
        return
    home, mill = home_of(f, *t), mill_of(f, *t)
    if home is not None:
        tap_home(home)
        return
    if mill is not None:
        tap_mill(mill)
        return
    kind = building_at(*t)
    if kind == "barn":
        open_panel("barn")
        return
    if kind == "board":
        open_panel("orders")
        return
    if kind is not None:
        say(BUILDING_WORDS[kind], DIM)
        global_vars.sel = None
        return
    fl = field_at(f, *t)
    if fl is None:
        global_vars.sel = None
        return
    if ready(fl):
        harvest_field(fl)
        return
    global_vars.sel = t
    sound_play("click", volume=0.3)


def pop(item, b, n=1):
    """A good rising off the building it came from: n of it."""
    x, y = building_xy(b["kind"], b["gx"], b["gy"])
    global_vars.pops.append([item, x, y - 60, 0, n])


def tap_home(home):
    """Collect what's ready, feed who's hungry; if there was nothing to do, its window."""
    f = farm()
    info = HOMES[home["kind"]]
    got, gained = collect_home(f, home)
    fed = feed_home(f, home)
    if got:
        sound_play("harvest", volume=0.6)
        pop(info["makes"], home, got)
        level_up(gained)
    if fed:
        sound_play("plant", volume=0.5)
    if got or fed:
        keep(f)
        if any(animal_state(home, i) == "ready" for i in range(ANIMALS_EACH)) and barn_free(f) == 0:
            say("The barn is full! Sell something, or fill an order.", RED)
        return
    open_panel("home", f["homes"].index(home))


def tap_mill(mill):
    """Collect what's finished; if nothing was, its window, to make more."""
    f = farm()
    item = mill["queue"][0]["item"] if mill["queue"] else None
    got, gained = collect_mill(f, mill)
    if got:
        sound_play("harvest", volume=0.6)
        pop(item, mill, got)
        level_up(gained)
        keep(f)
        return
    if mill_done(mill) and barn_free(f) == 0:
        sound_play("nope", volume=0.5)
        say("The barn is full! Sell something, or fill an order.", RED)
        return
    open_panel("mill", f["mills"].index(mill))


def harvest_field(fl):
    f = farm()
    crop = fl["crop"]
    res, gained = harvest(f, fl)
    if res == "harvested":
        sound_play("harvest", volume=0.6)
        x, y = tile_xy(fl["gx"], fl["gy"])
        particles(x, y - 20, 10, ["#ffd23f", "#9ff0a0", "#ffffff"], speed=3, size=4, life=30, gravity=0.2, spread=120, direction=90, shape="circle")
        global_vars.pops.append([crop, x, y - 30, 0, CROPS[crop]["yield"]])
        level_up(gained)
        keep(f)
    elif res == "full":
        sound_play("nope", volume=0.5)
        say("The barn is full! Sell something, or fill an order.", RED)
    return res


def plant_field(fl, crop):
    f = farm()
    res = plant(f, fl, crop)
    if res == "planted":
        sound_play("plant", volume=0.5)
        global_vars.last_crop = crop
        keep(f)
    elif res == "coins":
        sound_play("nope", volume=0.5)
        say(f"{CROPS[crop]['name']} seeds cost {CROPS[crop]['seed']} coins.", RED)
    elif res == "locked":
        sound_play("nope", volume=0.5)
        say(f"{CROPS[crop]['name']} opens at level {CROPS[crop]['level']}.", RED)
    return res


def level_up(gained):
    for level in gained:
        global_vars.levelup = [level, 240]
        sound_play("levelup", volume=0.6)
        effect("confetti", view_x + VIEW_W / 2, view_y + 120, None, 1.5)


# ---- the seed bar: shown while bare soil is chosen

SEED_W, SEED_H = 92, 92


def seed_bar_open():
    t = global_vars.sel
    if t is None or global_vars.panel or global_vars.placing:
        return False
    fl = field_at(farm(), *t)
    return fl is not None and fl["crop"] is None


def seed_chips():
    """The seed bar's chips on the screen: (crop, x, y)."""
    keys = list(CROPS)
    x0 = VIEW_W / 2 - len(keys) * (SEED_W + 8) / 2
    return [(k, x0 + i * (SEED_W + 8), VIEW_H - SEED_H - 14) for i, k in enumerate(keys)]


def chip_at(sx, sy):
    if not seed_bar_open():
        return None
    for k, x, y in seed_chips():
        if x <= sx <= x + SEED_W and y <= sy <= y + SEED_H:
            return k
    return None


# ---- the pointer

def over_gui(sx, sy):
    """Is the screen point on the HUD, a button, or an open window?"""
    if sy < HUD_H:
        return True
    if any(b.shown and inside(b, sx, sy) for b in instances("Button")):
        return True
    box = global_vars.panel_box
    return bool(global_vars.panel and box and box[0] <= sx <= box[2] and box[1] <= sy <= box[3])


def dragged():
    return global_vars.drag


def pointer():
    """Once a step on the farm: a press, a drag, a let-go."""
    d = global_vars.drag
    sx, sy = gui_mouse()
    if mouse_check_pressed("left"):
        d = None
        chip = chip_at(sx, sy)
        if over_gui(sx, sy):
            if global_vars.panel and not any(b.shown and inside(b, sx, sy) for b in instances("Button")):
                box = global_vars.panel_box
                if not (box[0] <= sx <= box[2] and box[1] <= sy <= box[3]):
                    close_panel()
        elif global_vars.panel:
            close_panel()               # a press on the map puts the window away
        elif chip is not None:
            d = {"mode": "plant", "crop": chip}
        else:
            t = tile_at(mouse_x, mouse_y)
            fl = field_at(farm(), *t) if t else None
            if global_vars.placing:
                d = {"mode": "place", "tile": t}
            elif fl is not None and ready(fl):
                d = {"mode": "harvest", "done": set()}
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
            move_camera(d["cam"][0] - (sx - d["sx"]), d["cam"][1] - (sy - d["sy"]))
    elif d["mode"] == "harvest" and t is not None and t not in d["done"]:
        d["done"].add(t)
        fl = field_at(farm(), *t)
        if fl is not None and ready(fl):
            if harvest_field(fl) == "full":
                d["mode"] = "stopped"
    elif d["mode"] == "plant" and d["moved"] and t is not None:
        fl = field_at(farm(), *t)
        if fl is not None and fl["crop"] is None:
            if plant_field(fl, d["crop"]) != "planted":
                d["mode"] = "stopped"
    if mouse_check_released("left") or not mouse_check("left"):
        global_vars.drag = None
        if d["moved"]:
            return
        if d["mode"] == "pan":
            tap_tile(d["tile"])
        elif d["mode"] == "plant":
            fl = field_at(farm(), *global_vars.sel)
            if fl is not None:
                plant_field(fl, d["crop"])
        elif d["mode"] == "place":
            place_at(d["tile"])


# ---- the keys on the map

def keys_on_map():
    """Arrows move the cursor tile; Space taps it; 1-4 plant the chosen soil; B, O, F
    open the barn, the orders and the shop; Escape lets go of what's chosen."""
    c = global_vars.cursor
    for name, (dx, dy) in (("left", (-1, 1)), ("right", (1, -1)), ("up", (-1, -1)), ("down", (1, 1))):
        if act(name):
            nx, ny = c[0] + dx, c[1] + dy
            # A step left or right on the screen is a step on both axes; it stays on the map.
            if on_map(nx, ny):
                c = (nx, ny)
            elif on_map(c[0] + dx, c[1]):
                c = (c[0] + dx, c[1])
            elif on_map(c[0], c[1] + dy):
                c = (c[0], c[1] + dy)
    if c != global_vars.cursor:
        global_vars.cursor = c
        look_at(*c)
    if act("ok"):
        if global_vars.placing:
            place_at(c)
        else:
            fl = field_at(farm(), *c)
            if seed_bar_open() and fl is not None and fl["crop"] is None and tuple(global_vars.sel) == c and global_vars.last_crop:
                plant_field(fl, global_vars.last_crop)
            else:
                tap_tile(c)
    for i, k in enumerate(CROPS):
        if keyboard_check_pressed(str(i + 1)) and seed_bar_open():
            plant_field(field_at(farm(), *global_vars.sel), k)
    if keyboard_check_pressed("b"):
        open_panel("barn")
    if keyboard_check_pressed("o"):
        open_panel("orders")
    if keyboard_check_pressed("f"):
        open_panel("shop")
    if act("back"):
        global_vars.sel = None
        global_vars.placing = False


# ---- building: the Build window's choice, then a tap where it goes (the tapped tile
# is a building's top corner)

def place_at(t):
    if global_vars.placing == "field":
        place_field(t)
    elif global_vars.placing:
        place_building(global_vars.placing, t)


def place_field(t):
    f = farm()
    if t is None:
        return
    res = buy_field(f, *t)
    if res == "bought":
        sound_play("coin", volume=0.6)
        keep(f)
        if len(f["fields"]) >= most_fields(f) or f["coins"] < field_cost(f):
            global_vars.placing = False
    elif res == "taken":
        sound_play("nope", volume=0.5)
        say("Something's already there.", RED)
    elif res == "coins":
        sound_play("nope", volume=0.5)
        say(f"A field costs {field_cost(f)} coins.", RED)
        global_vars.placing = False
    else:
        sound_play("nope", volume=0.5)
        say(f"That's all the fields for level {f['level']}. More come with each level.", RED)
        global_vars.placing = False


def place_building(kind, t):
    f = farm()
    if t is None:
        return
    res = build(f, kind, *t)
    if res == "built":
        sound_play("levelup", volume=0.5)
        x, y = building_xy(kind, *t)
        effect("dust", x, y, None, 1.5)
        global_vars.placing = False
        keep(f)
        say(f"Your {building_info(kind)['name'].lower()} is built! Tap it to use it.", MINT)
    elif res == "taken":
        sound_play("nope", volume=0.5)
        say("There isn't room there: it needs 2 × 2 free tiles.", RED)
    else:
        sound_play("nope", volume=0.5)
        global_vars.placing = False


# ---- windows: the barn, the orders, the shop

def close_panel():
    for b in instances("Button"):
        if b.in_panel:
            b.destroy()
    global_vars.panel = None
    global_vars.panel_box = None
    global_vars.focus = None


def open_panel(kind, of=None):
    """Opens (or redraws) a window, with its buttons. `of`: which home or factory.
    Redrawn (the clocks), the keys stay on the same button."""
    was = global_vars.focus
    was = (was.act, was.arg) if was is not None and global_vars.panel == kind else None
    close_panel()
    global_vars.sel = None
    global_vars.placing = False
    global_vars.panel = kind
    global_vars.panel_of = of
    f = farm()
    if kind == "barn":
        items = barn_items(f)
        cols = 2 if len(items) > 5 else 1
        rows = max(1, (len(items) + cols - 1) // cols)
        w = 520 if cols == 1 else 920
        h = 120 + rows * 58
        x1, y1 = VIEW_W / 2 - w / 2, max(HUD_H + 8, VIEW_H / 2 - h / 2)
        global_vars.panel_box = (x1, y1, x1 + w, y1 + h)
        for i, k in enumerate(items):
            x, y = barn_slot(i, cols, x1, y1)
            make_button(x + 236, y, 92, 38, f"Sell 1 (+{item_info(k)['sell']})", "sell", (k, 1), 12, True)
            make_button(x + 334, y, 92, 38, "Sell all", "sell", (k, f["barn"][k]), 12, True)
    elif kind == "orders":
        slots = f["orders"]
        rows = (len(slots) + 2) // 3
        x1, y1 = VIEW_W / 2 - 480, HUD_H + 14
        global_vars.panel_box = (x1, y1, x1 + 960, y1 + 70 + rows * 220)
        for i, o in enumerate(slots):
            cx, cy = x1 + 20 + (i % 3) * 312, y1 + 60 + (i // 3) * 220
            if "want" in o:
                b = make_button(cx + 14, cy + 160, 190, 40, "Deliver", "deliver", i, 16, True)
                b.off = not can_deliver(f, o)
                b.hot = not b.off
                make_button(cx + 214, cy + 160, 70, 40, "Skip", "discard", i, 13, True)
    elif kind == "shop":
        rows = shop_rows(f)
        x1, y1 = VIEW_W / 2 - 330, HUD_H + 12
        global_vars.panel_box = (x1, y1, x1 + 660, y1 + 64 + len(rows) * SHOP_ROW)
        for i, (k, name, cost, why) in enumerate(rows):
            b = make_button(x1 + 450, y1 + 56 + i * SHOP_ROW, 180, SHOP_ROW - 8, why or f"{cost} coins", "build", k, 14, True)
            b.off = bool(why) or f["coins"] < cost
            b.hot = not b.off
    elif kind == "home":
        home = f["homes"][of]
        x1, y1 = VIEW_W / 2 - 300, VIEW_H / 2 - 160
        global_vars.panel_box = (x1, y1, x1 + 600, y1 + 320)
        info = HOMES[home["kind"]]
        b = make_button(x1 + 30, y1 + 250, 250, 46, f"Feed them ({f['barn'].get(info['feed'], 0)} feed)", "feed", of, 16, True)
        b.off = not any(animal_state(home, i) == "hungry" for i in range(ANIMALS_EACH)) or not f["barn"].get(info["feed"])
        b.hot = not b.off
        b = make_button(x1 + 310, y1 + 250, 260, 46, f"Collect the {GOODS[info['makes']]['name'].lower()}", "collect_home", of, 16, True)
        b.off = not any(animal_state(home, i) == "ready" for i in range(ANIMALS_EACH))
        b.hot = not b.off
    elif kind == "mill":
        mill = f["mills"][of]
        makes = list(FACTORIES[mill["kind"]]["makes"])
        x1, y1 = VIEW_W / 2 - 360, HUD_H + 12
        global_vars.panel_box = (x1, y1, x1 + 720, y1 + 190 + len(makes) * 70)
        for i, item in enumerate(makes):
            recipe = FACTORIES[mill["kind"]]["makes"][item]
            b = make_button(x1 + 560, y1 + 176 + i * 70, 130, 44, "Make", "make", (of, item), 16, True)
            b.off = len(mill["queue"]) >= FACTORY_QUEUE or any(f["barn"].get(k, 0) < n for k, n in recipe["needs"].items())
            b.hot = not b.off
        b = make_button(x1 + 540, y1 + 64, 150, 44, "Collect", "collect_mill", of, 16, True)
        b.off = mill_done(mill) == 0
        b.hot = not b.off
    box = global_vars.panel_box
    make_button(box[2] - 46, box[1] + 8, 38, 34, "X", "close", None, 16, True)
    if was is not None:
        global_vars.focus = next((b for b in instances("Button") if b.in_panel and (b.act, b.arg) == was), None)


def barn_items(f):
    return [k for k in list(CROPS) + list(GOODS) if f["barn"].get(k)]


def barn_slot(i, cols, x1, y1):
    """Where the barn window's i-th thing goes: down the first column, then the second."""
    rows = (len(barn_items(farm())) + cols - 1) // cols
    return x1 + 20 + (i // rows) * 450, y1 + 84 + (i % rows) * 58


def shop_rows(f):
    """The Build window: a field, then every animal home and factory, by the level that
    opens it: (key, name, cost, why it can't be bought now, or "")."""
    rows = [("field", "A field", field_cost(f),
             "" if len(f["fields"]) < most_fields(f) else f"{most_fields(f)} at most now")]
    for k in sorted(list(HOMES) + list(FACTORIES), key=lambda k: building_info(k)["level"]):
        info = building_info(k)
        why = "Built" if owned(f, k) else (f"Level {info['level']}" if f["level"] < info["level"] else "")
        rows.append((k, info["name"], info["cost"], why))
    return rows


def do_act(what, arg):
    f = getattr(global_vars, "farm", None)       # None on the title: no farm loaded yet
    if what == "play":
        room_goto("Farm")
    elif what == "close":
        close_panel()
    elif what in ("barn", "orders", "shop"):
        if global_vars.panel == what:
            close_panel()
        else:
            open_panel(what)
    elif what == "sell":
        item, n = arg
        if sell(f, item, n):
            sound_play("coin", volume=0.6)
            keep(f)
        open_panel("barn")
    elif what == "deliver":
        res, gained = deliver(f, arg)
        if res == "delivered":
            sound_play("coin", volume=0.7)
            effect("sparkle", view_x + VIEW_W / 2, view_y + VIEW_H / 2, None, 1.5)
            level_up(gained)
            keep(f)
        open_panel("orders")
    elif what == "discard":
        discard(f, arg)
        keep(f)
        open_panel("orders")
    elif what == "buy_field" or (what == "build" and arg == "field"):
        close_panel()
        global_vars.placing = "field"
        say("Tap an empty spot of grass for the new field.", MINT)
    elif what == "build":
        close_panel()
        global_vars.placing = arg
        say(f"Tap where the {building_info(arg)['name'].lower()} goes: it needs 2 × 2 free tiles.", MINT)
    elif what == "feed":
        if feed_home(f, f["homes"][arg]):
            sound_play("plant", volume=0.5)
            keep(f)
        open_panel("home", arg)
    elif what == "collect_home":
        got, gained = collect_home(f, f["homes"][arg])
        if got:
            sound_play("harvest", volume=0.6)
            level_up(gained)
            keep(f)
        elif barn_free(f) == 0:
            say("The barn is full! Sell something, or fill an order.", RED)
        open_panel("home", arg)
    elif what == "make":
        i, item = arg
        if make_in(f, f["mills"][i], item) == "queued":
            sound_play("plant", volume=0.5)
            keep(f)
        open_panel("mill", i)
    elif what == "collect_mill":
        got, gained = collect_mill(f, f["mills"][arg])
        if got:
            sound_play("harvest", volume=0.6)
            level_up(gained)
            keep(f)
        elif barn_free(f) == 0:
            say("The barn is full! Sell something, or fill an order.", RED)
        open_panel("mill", arg)
    elif what == "stop_placing":
        global_vars.placing = False
    elif what == "title":
        room_goto("Title")
