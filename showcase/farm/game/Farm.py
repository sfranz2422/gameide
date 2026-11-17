# object: Farm
# depth: -100000
# The farm: puts everything on the map (fields, buildings, trees), runs the pointer,
# the keys and the camera, keeps the orders coming, and draws the bar along the top,
# the seed bar, the windows and the news. The rules are the farm script's.

# === create
global_vars.farm = load_farm()
global_vars.t = 0
global_vars.sel = None              # the field chosen (its tile), for the seed bar or its clock
global_vars.panel = None            # "barn", "orders", "shop" or None
global_vars.panel_box = None
global_vars.panel_of = None         # which home or factory a "home" or "mill" window is for
global_vars.placing = False         # buying a field: the next tap places it
global_vars.drag = None
global_vars.said = None
global_vars.levelup = None
global_vars.pops = []               # harvests rising off their fields: [crop, x, y, age]
global_vars.focus = None
global_vars.cursor = (8, 5)
global_vars.last_crop = "wheat"
if getattr(global_vars, "cam", None) is None:
    x, y = tile_xy(6, 6)
    move_camera(x - VIEW_W / 2, y - VIEW_H / 2)
f = global_vars.farm
fill_orders(f)
high_score(f["level"])
instance_create(0, 0, "Ground")
for kind, gx, gy in START_FARM + DECOR:
    o = instance_create(0, 0, "Thing")
    o.kind, o.gx, o.gy = kind, gx, gy
    o.depth = -(building_xy(kind, gx, gy)[1] if kind in FOOTPRINT else tile_xy(gx, gy)[1])
self.fields = 0
self.built = 0                      # animal homes and factories on the map so far
self.orders_b = make_button(VIEW_W - 330, 8, 104, 36, "Orders", "orders", None, 15)
self.orders_b.icon = "order"
self.barn_b = make_button(VIEW_W - 220, 8, 96, 36, "Barn", "barn", None, 15)
self.barn_b.icon = "barn"
self.shop_b = make_button(VIEW_W - 118, 8, 108, 36, "Build", "shop", None, 15)
self.shop_b.icon = "shovel"
self.stop = make_button(VIEW_W / 2 - 80, VIEW_H - 56, 160, 40, "Done", "stop_placing", None, 16)

# === step
global_vars.t += 1
f = global_vars.farm
question_ok(dragged() is None)          # never in the middle of a drag
# Fields bought since: each one an object of its own on the map.
while self.fields < len(f["fields"]):
    fl = f["fields"][self.fields]
    o = instance_create(0, 0, "Field")
    o.i = self.fields
    o.depth = -tile_xy(fl["gx"], fl["gy"])[1]
    self.fields += 1
# Animal homes and factories built since: a Thing each.
built = f["homes"] + f["mills"]
while self.built < len(built):
    b = built[self.built]
    o = instance_create(0, 0, "Thing")
    o.kind, o.gx, o.gy = b["kind"], b["gx"], b["gy"]
    o.depth = -building_xy(b["kind"], b["gx"], b["gy"])[1]
    self.built += 1
if global_vars.t % FPS == 0:
    before = [dict(o) for o in f["orders"]]
    fill_orders(f)
    if f["orders"] != before:
        keep(f)
        if global_vars.panel == "orders":
            open_panel("orders")
    # An open home's or factory's window keeps up with its clocks (its buttons too).
    if global_vars.panel in ("home", "mill"):
        open_panel(global_vars.panel, global_vars.panel_of)
track_mouse()
pointer()
if global_vars.panel:
    run_buttons()
    if act("back"):
        close_panel()
else:
    keys_on_map()
self.stop.shown = global_vars.placing
self.orders_b.picked = global_vars.panel == "orders"
self.barn_b.picked = global_vars.panel == "barn"
self.shop_b.picked = global_vars.panel == "shop"
self.orders_b.hot = any(can_deliver(f, o) for o in f["orders"])
camera_set(*global_vars.cam)
for p in global_vars.pops:
    p[3] += 1
global_vars.pops = [p for p in global_vars.pops if p[3] < 50]
if global_vars.said is not None:
    global_vars.said[2] -= 1
    if global_vars.said[2] <= 0:
        global_vars.said = None
if global_vars.levelup is not None:
    global_vars.levelup[1] -= 1
    if global_vars.levelup[1] <= 0:
        global_vars.levelup = None

# === draw
# In front of the map: where a new field would go, and the keys' cursor.
f = global_vars.farm
if global_vars.placing:
    t = tile_at(mouse_x, mouse_y) if not keyed() else global_vars.cursor
    if t is not None and global_vars.placing == "field":
        x, y = tile_xy(*t)
        ok = can_place(f, *t)
        draw_sprite_ext("soil", 0, x, y, 1, 1, 0, "white", 0.7)
        diamond(x, y, MINT if ok else RED, 0.35)
    elif t is not None:
        kind = global_vars.placing
        x, y = building_xy(kind, *t)
        ok = can_place_area(f, kind, *t)
        diamond(x, y, MINT if ok else RED, 0.35, FOOTPRINT[kind])
        draw_sprite_ext(kind, 0, x, y, 1, 1, 0, "white", 0.75)
if keyed():
    x, y = tile_xy(*global_vars.cursor)
    diamond(x, y, "#ffd23f", 1, 1, True)

# === draw_gui
f = global_vars.farm
# The bar along the top: level and XP, coins, the barn.
draw_set_alpha(0.85)
draw_set_color("#3a2410")
draw_rect(0, 0, VIEW_W, HUD_H)
draw_set_alpha(1)
icon("star", 30, 26, 40)
text(30, 13, str(f["level"]), "#5a3a00", 18, "center")
lo, hi = xp_for(f["level"]), xp_for(f["level"] + 1)
draw_set_color("#1e1208")
draw_rect(56, 18, 216, 34)
draw_set_color("#9fe06a")
draw_rect(56, 18, 56 + 160 * min(1, (f["xp"] - lo) / max(1, hi - lo)), 34)
text(136, 18, f"{f['xp'] - lo} / {hi - lo} XP", INK, 12, "center")
icon("coin", 250, 26, 36)
text(272, 14, str(f["coins"]), GOLD, 20)
icon("crate", 360, 26, 36)
text(382, 14, f"{barn_used(f)} / {BARN_SPACE}", INK if barn_free(f) > 4 else RED, 18)
# What the chosen field is doing.
sel = global_vars.sel
if sel is not None and not global_vars.panel:
    fl = field_at(f, *sel)
    if fl is not None and fl["crop"] is not None and not ready(fl):
        x, y = tile_xy(*sel)
        bx, by = x - view_x, y - view_y - 70
        panel(bx - 80, by - 26, bx + 80, by + 18, 0.9)
        icon("clock", bx - 60, by - 4, 30)
        text(bx + 14, by - 18, f"{CROPS[fl['crop']]['name']}: {clock_words(time_left(fl))}", INK, 14, "center")
# The seed bar.
if seed_bar_open():
    chips = seed_chips()
    panel(chips[0][1] - 10, chips[0][2] - 30, chips[-1][1] + SEED_W + 10, VIEW_H - 6, 0.9)
    text(VIEW_W / 2, chips[0][2] - 26, "Plant: tap a seed, or drag it across your fields", DIM, 13, "center")
    for n, (k, x, y) in enumerate(chips):
        c = CROPS[k]
        open_ = c["level"] <= f["level"]
        draw_set_color("#fff4dc" if open_ else "#8a7f72")
        draw_rect(x, y, x + SEED_W, y + SEED_H)
        icon(k, x + SEED_W / 2, y + 36, 54, 1 if open_ else 0.35)
        if open_:
            plain(x + SEED_W / 2, y + 68, "free" if not c["seed"] else f"{c['seed']} coins", "#5a3a1c" if f["coins"] >= c["seed"] else "#b0402a", 13, "center")
            plain(x + 6, y + 3, str(n + 1), "#8a6a40", 12)
        else:
            icon("lock", x + SEED_W / 2, y + 36, 30)
            text(x + SEED_W / 2, y + 66, f"Level {c['level']}", INK, 12, "center")
# Harvests and goods rising off where they came from.
for item, x, y, age, n in global_vars.pops:
    draw_set_alpha(min(1, (50 - age) / 15))
    icon(item, x - view_x, y - view_y - age * 0.8, 40)
    text(x - view_x + 22, y - view_y - age * 0.8 - 10, f"+{n}", GOLD, 16)
draw_set_alpha(1)
# The open window's words and pictures (its buttons draw themselves).
box = global_vars.panel_box
if global_vars.panel and box:
    x1, y1, x2, y2 = box
    panel(x1, y1, x2, y2)
    if global_vars.panel == "barn":
        text(x1 + 20, y1 + 14, "The barn", GOLD, 26)
        text(x1 + 20, y1 + 50, f"{barn_used(f)} of {BARN_SPACE} spaces used", DIM, 14)
        items = barn_items(f)
        if not items:
            text(x1 + 20, y1 + 90, "Empty. Harvest a field and it comes here.", INK, 16)
        cols = 2 if len(items) > 5 else 1
        for i, k in enumerate(items):
            x, y = barn_slot(i, cols, x1, y1)
            icon(k, x + 22, y + 19, 42)
            text(x + 50, y + 9, f"{item_info(k)['name']} × {f['barn'][k]}", INK, 15)
    elif global_vars.panel == "orders":
        text(x1 + 20, y1 + 14, "Orders", GOLD, 26)
        text(x1 + 140, y1 + 22, "Fill one from the barn for coins and XP. A new one comes after.", DIM, 13)
        for i, o in enumerate(f["orders"]):
            cx, cy = x1 + 20 + (i % 3) * 312, y1 + 60 + (i // 3) * 220
            draw_set_color("#fff4dc")
            draw_rect(cx, cy, cx + 298, cy + 210)
            draw_set_color("#8a5226")
            draw_rect(cx, cy, cx + 298, cy + 210, True)
            if "want" not in o:
                icon("clock", cx + 149, cy + 70, 56)
                plain(cx + 149, cy + 112, f"A new order in {clock_words(max(0, o['wait'] - now()))}", "#5a3a1c", 14, "center")
                continue
            for j, (k, n) in enumerate(o["want"].items()):
                ix = cx + 50 + j * 98
                icon(k, ix, cy + 50, 56)
                have = f["barn"].get(k, 0)
                plain(ix, cy + 82, f"{min(have, n)}/{n}", "#2a8a3a" if have >= n else "#b0402a", 16, "center")
            icon("coin", cx + 40, cy + 128, 30)
            plain(cx + 60, cy + 117, str(o["coins"]), "#7a5a10", 18)
            icon("star", cx + 160, cy + 128, 30)
            plain(cx + 180, cy + 117, f"{o['xp']} XP", "#7a5a10", 18)
    elif global_vars.panel == "shop":
        text(x1 + 20, y1 + 14, "Build", GOLD, 26)
        text(x1 + 120, y1 + 22, "Buy one, then tap where it goes.", DIM, 14)
        for i, (k, name, cost, why) in enumerate(shop_rows(f)):
            y = y1 + 56 + i * SHOP_ROW
            icon("shovel" if k == "field" else ("barn" if k in HOMES else "hammer"), x1 + 40, y + 18, 34)
            words = f"{name}  ({len(f['fields'])} of {most_fields(f)})" if k == "field" else name
            if k in HOMES:
                words += f": {GOODS[HOMES[k]['makes']]['name'].lower()}"
            elif k in FACTORIES:
                words += ": " + ", ".join(GOODS[g]["name"].lower() for g in FACTORIES[k]["makes"])
            text(x1 + 66, y + 9, words, INK if not why else DIM, 14, "left", 370)
    elif global_vars.panel == "home":
        home = f["homes"][global_vars.panel_of]
        info = HOMES[home["kind"]]
        text(x1 + 20, y1 + 14, info["name"], GOLD, 26)
        text(x1 + 20, y1 + 52, f"Feed each {info['animal']} one {GOODS[info['feed']]['name'].lower()}; "
             f"after {clock_words(info['time'])} it makes {GOODS[info['makes']]['name'].lower()}.", DIM, 14, "left", 560)
        for i in range(ANIMALS_EACH):
            ax = x1 + 100 + i * 180
            st = animal_state(home, i)
            draw_sprite_ext(f"animal_{info['animal']}_{ {'hungry': 'stand', 'eating': 'eat', 'ready': 'ready'}[st] }", 0, ax, y1 + 170, 1.3, 1.3, 0, "white", 1)
            words = {"hungry": "Hungry", "eating": clock_words(animal_left(home, i)), "ready": "Ready!"}[st]
            text(ax, y1 + 196, words, MINT if st == "ready" else INK, 15, "center")
    elif global_vars.panel == "mill":
        mill = f["mills"][global_vars.panel_of]
        info = FACTORIES[mill["kind"]]
        text(x1 + 20, y1 + 14, info["name"], GOLD, 26)
        # The queue: making first, then waiting; finished ones wait to be collected.
        for i in range(FACTORY_QUEUE):
            qx = x1 + 40 + i * 120
            draw_set_color("#3a2410")
            draw_rect(qx - 4, y1 + 60, qx + 100, y1 + 140)
            if i < len(mill["queue"]):
                job = mill["queue"][i]
                icon(job["item"], qx + 48, y1 + 92, 52)
                left = job["end"] - now()
                text(qx + 48, y1 + 120, "Done!" if left <= 0 else clock_words(left), MINT if left <= 0 else INK, 13, "center")
        for i, (item, recipe) in enumerate(info["makes"].items()):
            y = y1 + 176 + i * 70
            icon(item, x1 + 46, y + 22, 52)
            text(x1 + 80, y + 2, GOODS[item]["name"], INK, 16)
            text(x1 + 80, y + 24, clock_words(recipe["time"]), DIM, 13)
            for j, (k, n) in enumerate(recipe["needs"].items()):
                nx = x1 + 250 + j * 96
                icon(k, nx, y + 20, 40)
                have = f["barn"].get(k, 0)
                text(nx + 24, y + 10, f"{min(have, n)}/{n}", MINT if have >= n else RED, 14)
if global_vars.placing:
    text(VIEW_W / 2, HUD_H + 10, f"Tap grass for a new field ({field_cost(f)} coins)", MINT, 18, "center")
# A new level.
if global_vars.levelup is not None:
    level, left = global_vars.levelup
    draw_set_alpha(min(1, left / 30))
    panel(VIEW_W / 2 - 220, 80, VIEW_W / 2 + 220, 180, 0.95)
    text(VIEW_W / 2, 92, f"Level {level}!", GOLD, 34, "center")
    opened = opened_at(level)
    text(VIEW_W / 2, 138, (f"New: {', '.join(opened)}.  " if opened else "") + f"+{LEVEL_COINS} coins, room for {FIELDS_PER_LEVEL} more fields.", INK, 15, "center")
    draw_set_alpha(1)
if global_vars.said is not None:
    words, colour, left = global_vars.said
    draw_set_alpha(min(1, left / 20))
    panel(VIEW_W / 2 - 300, VIEW_H - 150, VIEW_W / 2 + 300, VIEW_H - 110, 0.85)
    text(VIEW_W / 2, VIEW_H - 141, words, colour, 15, "center")
    draw_set_alpha(1)
