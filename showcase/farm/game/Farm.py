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
global_vars.shop_tab = "farm"       # the Build window's tab: "farm", "houses" or "town"
global_vars.moving = None           # moving: what's been picked up, ("homes", 0) and so on
global_vars.move_from = None        # …and the tile it was picked up by
if getattr(global_vars, "cam", None) is None:
    x, y = tile_xy(6, 6)
    move_camera(x - VIEW_W / 2, y - VIEW_H / 2)
f = global_vars.farm
fill_orders(f)
high_score(f["level"])
instance_create(0, 0, "Ground")
for kind, gx, gy in START_FARM:
    o = instance_create(0, 0, "Thing")
    o.kind, o.gx, o.gy = kind, gx, gy
    o.depth = -building_xy(kind, gx, gy)[1]
# Trees, rocks and signs: Props, drawn by the engine alone (see Prop).
self.props = {}                     # (gx, gy): the Prop standing there
for kind, gx, gy in DECOR:
    if kind not in CLEAR:
        make_prop(self, kind, gx, gy)
for (gx, gy), kind in wilds().items():
    if wild_at(f, gx, gy):
        make_prop(self, kind, gx, gy)
self.signs = {}                     # a locked plot's index: its sign
for i in range(len(LAND)):
    if locked(f, i):
        self.signs[i] = make_prop(self, "sign", *sign_tile(i))
self.cleared = len(f["cleared"])
self.land = len(f["land"])
shade_props(self)
instance_create(0, 0, "Roads")
instance_create(0, 0, "Land")
for k in range(TRAIN_WAGONS + 1):
    o = instance_create(0, 0, "Car")
    o.k = k
self.fields = 0
self.made = {"homes": 0, "mills": 0, "town": 0, "trees": 0}     # how many of each have a Thing on the map
self.walkers = []                   # townspeople out walking (Person objects)
self.queue = []                     # townspeople at the farm stand, one a visitor's place
self.orders_b = make_button(VIEW_W - 330, 8, 104, 36, "Orders", "orders", None, 15)
self.orders_b.icon = "order"
self.barn_b = make_button(VIEW_W - 220, 8, 96, 36, "Barn", "barn", None, 15)
self.barn_b.icon = "barn"
self.shop_b = make_button(VIEW_W - 118, 8, 108, 36, "Build", "shop", None, 15)
self.shop_b.icon = "shovel"
self.awards_b = make_button(VIEW_W - 384, 8, 46, 36, "", "awards", None, 15)
self.awards_b.icon = "trophy"
self.claims = to_claim(f)            # prizes waiting: a new one says so
self.weather = "unset"               # what's falling now (set the first second)
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
# Animal homes, factories, the town's buildings and fruit trees built since: a Thing
# each, which reads where it is from the farm (so moving one moves its Thing).
for name in ("homes", "mills", "town", "trees"):
    while self.made[name] < len(f[name]):
        o = instance_create(0, 0, "Thing")
        o.of = (name, self.made[name])
        o.kind = f[name][self.made[name]]["kind"]
        self.made[name] += 1
# Townspeople: as many out walking as the town has people for, and one at the farm
# stand for each visitor's place.
while len(self.walkers) < walkers(f):
    o = instance_create(0, 0, "Person")
    o.who = len(self.walkers) % len(PEOPLE)
    self.walkers.append(o)
    start_walk(o, f)
while len(self.walkers) > walkers(f):
    self.walkers.pop().destroy()
# Cleared away: their Props go. Land bought: its sign goes, and what's on it brightens.
if len(f["cleared"]) != self.cleared:
    for c in f["cleared"][self.cleared:]:
        o = self.props.pop((c[0], c[1]), None)
        if o is not None:
            o.destroy()
    self.cleared = len(f["cleared"])
if len(f["land"]) != self.land:
    for i in f["land"]:
        if i in self.signs:
            self.signs.pop(i).destroy()
    self.land = len(f["land"])
    shade_props(self)
while len(self.queue) < len(f["visitors"]):
    o = instance_create(0, 0, "Person")
    o.visitor = len(self.queue)
    self.queue.append(o)
if global_vars.t % FPS == 0:
    before = [dict(o) for o in f["orders"]] + [dict(v) for v in f["visitors"]] + [len(f["train"]["wagons"])]
    fill_orders(f)
    fill_visitors(f)
    town_tick(f)
    fill_train(f)
    # The week's event starts with the week; a prize newly reached says so.
    week = f["event"]["week"] if f["event"] else None
    e = event_now(f)
    if e is not None and e["week"] != week:
        keep(f)
    n = to_claim(f)
    if n > self.claims and not global_vars.said:
        sound_play("coin", volume=0.6)
        say("A prize is waiting: tap the trophy to collect it!", GOLD)
    self.claims = n
    # The season's weather: snow and showers are the engine's; autumn's leaves are ours.
    w = season_weather()
    if w != self.weather:
        weather(w if w in ("rain", "snow") else None, 1)
        self.weather = w
    if [dict(o) for o in f["orders"]] + [dict(v) for v in f["visitors"]] + [len(f["train"]["wagons"])] != before:
        keep(f)
        if global_vars.panel in ("orders", "visitors", "train"):
            open_panel(global_vars.panel)
    # An open home's, factory's or house's window keeps up with its clocks (its buttons too).
    if global_vars.panel in ("home", "mill", "house", "awards") or (global_vars.panel == "train" and not train_here(f)):
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
self.awards_b.picked = global_vars.panel == "awards"
self.awards_b.hot = self.claims > 0
# Autumn: now and then a leaf drifts down across the view (the engine moves it).
if self.weather == "leaves" and global_vars.t % 9 == 0:
    particles(view_x + random.uniform(0, VIEW_W), view_y + random.uniform(-20, VIEW_H * 0.6), 1,
              ["#d9822b", "#c0504d", "#e8b04a", "#a5652a"], speed=1.2, size=8, life=200, gravity=0.015,
              spread=70, direction=250, shape="square")
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
# In front of the map: the season's tint, where a new field would go, and the keys' cursor.
f = global_vars.farm
s = SEASONS[season_now()]
draw_set_alpha(s["tint_alpha"])
draw_set_color(s["tint"])
draw_rect(view_x, view_y, view_x + VIEW_W, view_y + VIEW_H)
draw_set_alpha(1)
if global_vars.placing:
    t = tile_at(mouse_x, mouse_y) if not keyed() else global_vars.cursor
    if t is not None and global_vars.placing in ("field", "road"):
        x, y = tile_xy(*t)
        ok = can_place(f, *t)
        draw_sprite_ext("soil" if global_vars.placing == "field" else "path", 0, x, y, 1, 1, 0, "white", 0.7)
        diamond(x, y, MINT if ok else RED, 0.35)
    elif t is not None and global_vars.placing == "move":
        if global_vars.moving is None:
            ref = thing_at(f, *t)
            if ref is not None:
                n = thing_size(f, ref)
                gx, gy = thing_place(f, ref)
                diamond(*tile_xy(gx + (n - 1) / 2, gy + (n - 1) / 2), GOLD, 1, n, True)
        else:
            held = global_vars.moving
            kind, n = thing_kind(f, held), thing_size(f, held)
            gx, gy = move_spot(t)
            x, y = tile_xy(gx + (n - 1) / 2, gy + (n - 1) / 2)
            diamond(x, y, MINT if can_move(f, held, gx, gy) else RED, 0.35, n)
            draw_sprite_ext(kind, 0, x, y, 1, 1, 0, "white", 0.75)
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
text(382, 14, f"{barn_used(f)} / {barn_space(f)}", INK if barn_free(f) > 4 else RED, 18)
if f["level"] >= ROAD_LEVEL or f["town"]:
    # The town: people living here, of the room there is.
    icon("people", 500, 26, 36)
    text(522, 14, f"{population(f)} / {room_in_town(f)}", INK if housing(f) <= room_in_town(f) else GOLD, 18)
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
        text(x1 + 20, y1 + 50, f"{barn_used(f)} of {barn_space(f)} spaces used", DIM, 14)
        # The kit: tools, and the materials a bigger barn needs (have / need).
        draw_set_alpha(0.35)
        draw_set_color("#1e1208")
        draw_rect(x1 + 12, y1 + 78, x2 - 12, y1 + 132)
        draw_set_alpha(1)
        needs = barn_needs(f)
        for j, k in enumerate(KIT):
            kx = x1 + 40 + j * 54
            icon(k, kx, y1 + 96, 34)
            n = f["kit"].get(k, 0)
            words, colour = (f"{n}/{needs[k]}", MINT if n >= needs[k] else INK) if k in needs else (str(n), INK if n else RED)
            text(kx, y1 + 113, words, colour, 12, "center")
        items = barn_items(f)
        if not items:
            text(x1 + 20, y1 + BARN_TOP + 4, "Empty. Harvest a field and it comes here.", INK, 16)
        cols, rows, w, h, cell = barn_grid(f)
        for i, k in enumerate(items):
            x, y = barn_slot(i, x1, y1)
            icon(k, x + 18, y + 18, 36)
            if cols <= 2:
                text(x + 42, y + 9, f"{item_info(k)['name']} × {f['barn'][k]}", INK, 15)
            else:
                text(x + 40, y + 1, item_info(k)["name"], DIM, 12)
                text(x + 40, y + 17, f"× {f['barn'][k]}", INK, 14)
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
            if o.get("season"):
                # A tag on the card's top edge (three things wanted fill the card's top).
                draw_set_color("#3f9b4a")
                draw_rect(cx + 186, cy - 10, cx + 292, cy + 12)
                draw_set_color("#1e5a24")
                draw_rect(cx + 186, cy - 10, cx + 292, cy + 12, True)
                text(cx + 239, cy - 8, f"In season +{round((SEASON_PAY - 1) * 100)}%", INK, 12, "center")
    elif global_vars.panel == "shop":
        text(x1 + 20, y1 + 14, "Build", GOLD, 26)
        for i, (k, name, cost, why) in enumerate(shop_rows(f, global_vars.shop_tab)):
            y = y1 + 56 + i * SHOP_ROW
            pic = {"field": "shovel", "road": "road"}.get(k, "barn" if k in HOMES else ("house" if k in HOUSES else ("people" if k in COMMUNITY else (TREES[k]["fruit"] if k in TREES else "hammer"))))
            icon(pic, x1 + 40, y + 18, 34)
            words = f"{name}  ({len(f['fields'])} of {most_fields(f)})" if k == "field" else name
            if k in HOMES:
                words += f": {GOODS[HOMES[k]['makes']]['name'].lower()}"
            elif k in FACTORIES:
                words += ": " + ", ".join(GOODS[g]["name"].lower() for g in FACTORIES[k]["makes"])
            elif k in HOUSES:
                words += f": {HOUSES[k]['people']} people, {HOUSES[k]['rent']} rent"
            elif k in COMMUNITY:
                words += f": room for {COMMUNITY[k]['room']} people"
            elif k in TREES:
                words += f": {GOODS[TREES[k]['fruit']]['name'].lower()} every {clock_words(TREES[k]['grow'])}"
            text(x1 + 66, y + 9, words, INK if not why else DIM, 14, "left", 370)
    elif global_vars.panel == "house":
        i = global_vars.panel_of
        b = f["town"][i]
        info = HOUSES[b["kind"]]
        text(x1 + 20, y1 + 14, info["name"], GOLD, 26)
        if i in lived_in(f):
            text(x1 + 20, y1 + 60, f"{info['people']} people live here.", INK, 17)
            text(x1 + 20, y1 + 92, f"Rent: {info['rent']} coins every {clock_words(info['every'])}.", DIM, 15)
            left = rent_left(f, i)
            text(x1 + 20, y1 + 130, "The rent is ready!" if left == 0 else f"Next rent in {clock_words(left)}", MINT if left == 0 else INK, 17)
        else:
            text(x1 + 20, y1 + 60, f"Empty: the town has no room for its {info['people']} people.", GOLD, 17)
            text(x1 + 20, y1 + 92, "Build a fountain, a park, a school… for room in town.", DIM, 15, "left", 520)
            text(x1 + 20, y1 + 130, f"{population(f)} people live in town; there's room for {room_in_town(f)}.", INK, 15)
    elif global_vars.panel == "visitors":
        text(x1 + 20, y1 + 14, "The farm stand", GOLD, 26)
        text(x1 + 20, y1 + 48, "Townspeople come to buy. They pay well!", DIM, 14)
        for i, v in enumerate(f["visitors"]):
            cx, cy = x1 + 20 + i * 232, y1 + 76
            draw_set_color("#fff4dc")
            draw_rect(cx, cy, cx + 220, cy + 240)
            draw_set_color("#8a5226")
            draw_rect(cx, cy, cx + 220, cy + 240, True)
            if "want" not in v:
                icon("clock", cx + 110, cy + 70, 50)
                plain(cx + 110, cy + 108, f"Someone comes in {clock_words(max(0, v['wait'] - now()))}", "#5a3a1c", 13, "center")
                continue
            draw_sprite_ext(f"person_{PEOPLE[v['who']]}_front", 0, cx + 56, cy + 110, 1.4, 1.4, 0, "white", 1)
            (k, n), = v["want"].items()
            icon(k, cx + 150, cy + 50, 56)
            have = f["barn"].get(k, 0)
            plain(cx + 150, cy + 82, f"{min(have, n)}/{n}", "#2a8a3a" if have >= n else "#b0402a", 16, "center")
            icon("coin", cx + 30, cy + 150, 28)
            plain(cx + 48, cy + 140, str(v["coins"]), "#7a5a10", 17)
            icon("star", cx + 120, cy + 150, 28)
            plain(cx + 138, cy + 140, f"{v['xp']} XP", "#7a5a10", 17)
    elif global_vars.panel == "home":
        home = f["homes"][global_vars.panel_of]
        info = home_info(home["kind"])
        text(x1 + 20, y1 + 14, info["name"], GOLD, 26)
        if home["kind"] == "dock":
            text(x1 + 20, y1 + 52, f"Bait each line with one corn; after {clock_words(info['time'])} a fish bites.", DIM, 14, "left", 560)
        else:
            text(x1 + 20, y1 + 52, f"Feed each {info['animal']} one {GOODS[info['feed']]['name'].lower()}; "
                 f"after {clock_words(info['time'])} it makes {GOODS[info['makes']]['name'].lower()}.", DIM, 14, "left", 560)
        for i in range(ANIMALS_EACH):
            ax = x1 + 100 + i * 180
            st = animal_state(home, i)
            if home["kind"] == "dock":
                # A fishing line: a fish on it, the clock while it waits, corn for bait.
                icon({"hungry": "corn", "eating": "clock", "ready": "fish"}[st], ax, y1 + 140, 64, 0.45 if st == "hungry" else 1)
            else:
                draw_sprite_ext(f"animal_{info['animal']}_{ {'hungry': 'stand', 'eating': 'eat', 'ready': 'ready'}[st] }", 0, ax, y1 + 170, 1.3, 1.3, 0, "white", 1)
            words = {"hungry": "No bait" if home["kind"] == "dock" else "Hungry", "eating": clock_words(animal_left(home, i)), "ready": "Ready!"}[st]
            text(ax, y1 + 196, words, MINT if st == "ready" else INK, 15, "center")
    elif global_vars.panel == "mill":
        mill = f["mills"][global_vars.panel_of]
        info = mill_info(mill["kind"])
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
            text(x1 + 80, y + 2, item_info(item)["name"], INK, 16)
            text(x1 + 80, y + 24, clock_words(recipe["time"]), DIM, 13)
            for j, (k, n) in enumerate(recipe["needs"].items()):
                nx = x1 + 250 + j * 96
                icon(k, nx, y + 20, 40)
                have = f["barn"].get(k, 0)
                text(nx + 24, y + 10, f"{min(have, n)}/{n}", MINT if have >= n else RED, 14)
    elif global_vars.panel == "land":
        p = LAND[global_vars.panel_of]
        i = global_vars.panel_of
        text(x1 + 20, y1 + 14, p["name"], GOLD, 26)
        icon("land", x2 - 90, y1 + 90, 64)
        text(x1 + 20, y1 + 60, f"New land: {p['w'] * p['h']} tiles, with {wild_in(f, i)} trees and rocks to clear.", INK, 16, "left", 440)
        extra = [s["name"] for s in SITES.values() if s["land"] == i]
        if extra:
            text(x1 + 20, y1 + 110, f"It comes with: {', '.join(extra).lower()}" + (" by the lake." if "Fishing dock" in extra else "."), MINT, 16, "left", 440)
        text(x1 + 20, y1 + 150, "Clear the wild with an axe, a pickaxe or a shovel.", DIM, 14, "left", 440)
        text(x1 + 20, y1 + 180, f"Opens at level {p['level']} · {p['cost']} coins", DIM, 14)
    elif global_vars.panel == "awards":
        text(x1 + 20, y1 + 14, "Awards", GOLD, 26)
        # This week's event.
        draw_set_alpha(0.35)
        draw_set_color("#1e1208")
        draw_rect(x1 + 16, y1 + 56, x1 + 314, y1 + 306)
        draw_rect(x1 + 16, y1 + 316, x1 + 314, y1 + AWARDS_H - 14)
        draw_set_alpha(1)
        e = event_now(f)
        if e is None:
            icon("ribbon", x1 + 165, y1 + 120, 64)
            text(x1 + 165, y1 + 166, f"A new event every week, from level {EVENT_LEVEL}.", DIM, 14, "center", 260)
        else:
            ev = EVENTS[e["kind"]]
            goals = ev["goals"]
            icon("ribbon", x1 + 50, y1 + 92, 52)
            text(x1 + 84, y1 + 66, "This week", DIM, 12)
            text(x1 + 84, y1 + 82, ev["name"], GOLD, 20)
            nxt = next((g for g in goals if e["got"] < g), goals[-1])
            text(x1 + 30, y1 + 126, f"{ev['about']}: {min(e['got'], nxt)} / {nxt}", INK, 15)
            # The bar to the last goal, a mark at each, its prize under it.
            bx1, bx2 = x1 + 30, x1 + 290
            draw_set_color("#1e1208")
            draw_rect(bx1, y1 + 152, bx2, y1 + 166)
            draw_set_color("#9fe06a")
            draw_rect(bx1, y1 + 152, bx1 + (bx2 - bx1) * min(1, e["got"] / goals[-1]), y1 + 166)
            for j, g in enumerate(goals):
                gx = bx1 + (bx2 - bx1) * g / goals[-1]
                draw_set_color("#3a1e08")
                draw_rect(gx - 1, y1 + 148, gx + 1, y1 + 170)
                px = min(bx2 - 22, max(bx1 + 22, gx))
                icon("gift", px, y1 + 192, 34, 1 if e["got"] >= g else 0.45)
                text(px, y1 + 210, "Got it" if j < e["claimed"] else str(g), MINT if j < e["claimed"] else INK, 12, "center")
            icon("calendar", x1 + 100, y1 + 238, 24)
            text(x1 + 118, y1 + 230, f"Ends in {clock_words(week_left())}", DIM, 12)
        # The season.
        sk = season_now()
        se = SEASONS[sk]
        icon(sk, x1 + 50, y1 + 352, 52)
        text(x1 + 84, y1 + 328, "The season", DIM, 12)
        text(x1 + 84, y1 + 344, se["name"], GOLD, 20)
        text(x1 + 30, y1 + 388, f"Orders for these pay {round((SEASON_PAY - 1) * 100)}% more:", INK, 13)
        for j, k in enumerate(se["likes"]):
            icon(k, x1 + 56 + j * 66, y1 + 440, 48)
        # The achievements: three stars each, one for every tier collected.
        for i, (k, a) in enumerate(ACHIEVEMENTS.items()):
            x, y = award_slot(i, x1, y1)
            t = award_tier(f, k)
            draw_set_color("#fff4dc" if not award_ready(f, k) else "#d8efc8")
            draw_rect(x, y, x + AWARD_W, y + AWARD_ROW - 6)
            draw_set_color("#8a5226")
            draw_rect(x, y, x + AWARD_W, y + AWARD_ROW - 6, True)
            icon(a["icon"], x + 30, y + 32, 44)
            plain(x + 58, y + 6, a["name"], "#5a3a1c", 15)
            goal = a["goals"][min(t, len(a["goals"]) - 1)]
            plain(x + 58, y + 26, a["about"], "#7a5a10", 12)
            for j in range(len(a["goals"])):
                icon("star", x + 66 + j * 22, y + 50, 18, 1 if j < t else 0.25)
            plain(x + 132, y + 41, f"{min(progress(f, k), goal)} / {goal}" if t < len(a["goals"]) else "All three stars!",
                  "#2a8a3a" if award_ready(f, k) or t == len(a["goals"]) else "#5a3a1c", 13)
    elif global_vars.panel == "train":
        text(x1 + 20, y1 + 14, "The train", GOLD, 26)
        if not train_here(f):
            icon("train", x1 + 80, y1 + 120, 72)
            text(x1 + 140, y1 + 90, "Away on its trip.", INK, 18)
            text(x1 + 140, y1 + 120, f"Back in {clock_words(train_left(f))}", MINT, 18)
        else:
            text(x1 + 150, y1 + 22, "Load each wagon from the barn: it brings back what it shows.", DIM, 13)
            for i, wg in enumerate(f["train"]["wagons"]):
                cx, cy = x1 + 20 + i * 312, y1 + 60
                draw_set_color("#fff4dc" if not wg["loaded"] else "#d8efc8")
                draw_rect(cx, cy, cx + 298, cy + 236)
                draw_set_color("#8a5226")
                draw_rect(cx, cy, cx + 298, cy + 236, True)
                (k, n), = wg["want"].items()
                icon(k, cx + 70, cy + 60, 64)
                have = f["barn"].get(k, 0)
                plain(cx + 70, cy + 98, "Loaded" if wg["loaded"] else f"{min(have, n)}/{n}", "#2a8a3a" if wg["loaded"] or have >= n else "#b0402a", 16, "center")
                plain(cx + 149, cy + 48, "→", "#8a5226", 28, "center")
                icon(wg["prize"], cx + 226, cy + 60, 64)
                plain(cx + 226, cy + 98, KIT[wg["prize"]]["name"], "#5a3a1c", 14, "center")
                icon("star", cx + 120, cy + 150, 28)
                plain(cx + 138, cy + 140, f"{wg['xp']} XP", "#7a5a10", 17)
            text(x1 + 300, y1 + 322, f"Or send it off with what's loaded: back in {clock_words(TRAIN_AWAY)}.", DIM, 13)
if global_vars.placing:
    p = global_vars.placing
    if p == "field":
        words = f"Tap grass for a new field ({field_cost(f)} coins)"
    elif p == "road":
        words = f"Tap or drag across grass to lay road ({ROAD_COST} coins a piece)"
    elif p in TREES:
        words = f"Tap grass for an {TREES[p]['name'].lower()} ({tree_cost(f, p)} coins)" if p == "apple_tree" else f"Tap grass for a {TREES[p]['name'].lower()} ({tree_cost(f, p)} coins)"
    elif p == "move":
        words = "Tap something to pick it up" if global_vars.moving is None else "Tap where it goes"
    else:
        words = f"Tap where the {building_info(p)['name'].lower()} goes"
    text(VIEW_W / 2, HUD_H + 10, words, MINT, 18, "center")
# A new level.
if global_vars.levelup is not None:
    level, left = global_vars.levelup
    draw_set_alpha(min(1, left / 30))
    panel(VIEW_W / 2 - 330, 80, VIEW_W / 2 + 330, 196, 0.95)
    text(VIEW_W / 2, 90, f"Level {level}!", GOLD, 34, "center")
    opened = opened_at(level)
    # Two lines: what's new could be five things long, and one line ran off the panel.
    if opened:
        text(VIEW_W / 2, 136, f"New: {', '.join(opened)}.", MINT, 15, "center")
    text(VIEW_W / 2, 162, f"+{LEVEL_COINS} coins, room for {FIELDS_PER_LEVEL} more fields.", INK, 15, "center")
    draw_set_alpha(1)
if global_vars.said is not None:
    words, colour, left = global_vars.said
    draw_set_alpha(min(1, left / 20))
    panel(VIEW_W / 2 - 300, VIEW_H - 150, VIEW_W / 2 + 300, VIEW_H - 110, 0.85)
    text(VIEW_W / 2, VIEW_H - 141, words, colour, 15, "center")
    draw_set_alpha(1)
