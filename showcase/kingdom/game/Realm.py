# object: Realm
# depth: -100000
# The kingdom on screen: keeps a Building for every building and a Prop for every wall,
# tree and rock (walls and trees have no events: the engine draws them alone, and there
# can be hundreds), runs the pointer, the keys and the camera, finishes builders' jobs,
# and draws the bar along the top, the windows and the news. The rules are the realm script's.

# === create
global_vars.realm = load_realm()
global_vars.t = 0
global_vars.panel = None
global_vars.panel_box = None
global_vars.panel_of = None
global_vars.placing = False          # a kind being placed, "wall", "move", or False
global_vars.moving = None            # the building being moved
global_vars.chosen = None            # the building last tapped
global_vars.drag = None
global_vars.said = None
global_vars.levelup = None
global_vars.pops = []                # gold and food rising off where they were collected
global_vars.focus = None
global_vars.cursor = (MID, MID)
global_vars.shop_tab = "economy"
r = global_vars.realm
if getattr(global_vars, "zoom", None) is None:
    global_vars.zoom = ZOOM_START
camera_zoom(global_vars.zoom)
if getattr(global_vars, "cam", None) is None:
    x, y = tile_xy(MID, MID)
    w, h = shown(global_vars.zoom)      # the engine's view takes the zoom from the next step
    move_camera(x - w / 2, y - h / 2)
high_score(r["level"])
instance_create(0, 0, "Ground")
self.shown = {}                      # id(building dict) -> its Building, or its wall's Prop
self.trees = {}                      # (gx, gy) -> the Prop of the tree or rock there
self.shop_b = make_button(VIEW_W - 130, 9, 120, 38, "Build", "shop", None, 16)
self.shop_b.icon = "hammer"
self.army_b = make_button(VIEW_W - 256, 9, 118, 38, "Army", "army", None, 16)
self.army_b.icon = "shield"
self.attack_b = make_button(14, VIEW_H - 74, 150, 60, "Attack!", "campaign", None, 22)
self.attack_b.icon = "sword"
self.attack_b.hot = True
self.stop = make_button(VIEW_W / 2 - 80, VIEW_H - 58, 160, 42, "Done", "stop_placing", None, 16)
self.zoom_out = make_button(VIEW_W - 108, VIEW_H - 56, 46, 44, "-", "zoom", -1, 24)
self.zoom_in = make_button(VIEW_W - 56, VIEW_H - 56, 46, 44, "+", "zoom", 1, 24)
gained = finish_jobs(r)
grow_obstacles(r)
keep_save(r)

# === step
global_vars.t += 1
r = global_vars.realm
question_ok(dragged() is None)          # never in the middle of a drag
# Jobs finish on the real clock (while the game was closed too); trees grow back.
if global_vars.t % 30 == 0:
    jobs = len(busy(r))
    gained = finish_jobs(r)
    grew = grow_obstacles(r)
    if len(busy(r)) < jobs:
        sound_play("levelup", volume=0.4)
        say("A builder has finished!", MINT)
    if len(busy(r)) < jobs or grew:
        level_up(gained)
        keep_save(r)
    if train_tick(r):
        keep_save(r)
    if global_vars.panel in ("building", "army"):
        open_panel(global_vars.panel, global_vars.panel_of)
# What's on the map, kept in step with the kingdom: a Building each, a Prop for a wall.
now_ids = {}
walls = {(b["gx"], b["gy"]) for b in r["buildings"] if b["kind"] == "wall"}
for b in r["buildings"]:
    now_ids[id(b)] = b
    o = self.shown.get(id(b))
    if b["kind"] == "wall":
        # Running along gy (a neighbour that way and none along gx): the mirrored picture.
        gx, gy = b["gx"], b["gy"]
        along_gy = ((gx, gy - 1) in walls or (gx, gy + 1) in walls) and not ((gx - 1, gy) in walls or (gx + 1, gy) in walls)
        pic = f"wall_{tier(max(1, b['level']))}" + ("_gy" if along_gy else "")
        x, y = tile_xy(b["gx"], b["gy"])
        if o is None:
            o = instance_create(x, y, "Prop")
            self.shown[id(b)] = o
        if o.sprite != pic or o.x != x or o.y != y:
            o.sprite, o.x, o.y, o.depth = pic, x, y, -y
    elif o is None:
        o = instance_create(0, 0, "Building")
        o.b = b
        self.shown[id(b)] = o
for k in [k for k in self.shown if k not in now_ids]:
    self.shown.pop(k).destroy()
here = {(o[1], o[2]): o[0] for o in r["obstacles"]}
for t in [t for t in self.trees if t not in here]:
    self.trees.pop(t).destroy()
for t, kind in here.items():
    if t not in self.trees:
        x, y = tile_xy(*t)
        p = instance_create(x, y, "Prop")
        p.sprite, p.depth = kind, -y
        self.trees[t] = p
track_mouse()
pointer()
if global_vars.panel:
    run_buttons()
    if act("back"):
        close_panel()
else:
    keys_on_map()
self.stop.shown = bool(global_vars.placing)
self.shop_b.picked = global_vars.panel == "shop"
self.army_b.picked = global_vars.panel == "army"
self.attack_b.picked = global_vars.panel == "campaign"
# With a window open, the corner buttons step aside (the Attack window reaches the bottom).
self.attack_b.shown = self.zoom_out.shown = self.zoom_in.shown = global_vars.panel is None
self.zoom_out.off = global_vars.zoom <= ZOOMS[0]
self.zoom_in.off = global_vars.zoom >= ZOOMS[-1]
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
# In front of the map: where something being placed would go, the chosen building's
# reach (a defense), and the keys' cursor.
r = global_vars.realm
p = global_vars.placing
if p:
    t = tile_at(mouse_x, mouse_y) if not keyed() else global_vars.cursor
    if t is not None:
        kind = global_vars.moving["kind"] if p == "move" and global_vars.moving else (None if p == "move" else p)
        if kind is not None:
            skip = global_vars.moving if p == "move" else None
            ok = fits(r, kind, *t, skip=skip)
            x, y = building_xy(kind, *t)
            diamond(x, y, MINT if ok else RED, 0.35, info(kind)["size"])
            pic = f"wall_1" if kind == "wall" else f"{kind}_{tier(max(1, skip['level'] if skip else 1))}"
            draw_sprite_ext(pic, 0, x, y, 1, 1, 0, "white", 0.7)
c = global_vars.chosen
if c is not None and c in r["buildings"] and "range" in info(c["kind"]) and c["level"] > 0 and not global_vars.placing:
    x, y = building_xy(c["kind"], c["gx"], c["gy"])
    reach = stat(c["kind"], "range", c["level"])
    draw_set_alpha(0.5)
    draw_set_color("#ffffff")
    draw_ellipse(x - reach * TILE_W / 2 * 1.41, y - reach * TILE_H / 2 * 1.41, x + reach * TILE_W / 2 * 1.41, y + reach * TILE_H / 2 * 1.41, True)
    draw_set_alpha(1)
if keyed():
    x, y = tile_xy(*global_vars.cursor)
    diamond(x, y, GOLD, 1, 1, True)

# === draw_gui
r = global_vars.realm
# The bar along the top: renown, gold, food, builders.
draw_set_alpha(0.88)
draw_set_color("#1d1b18")
draw_rect(0, 0, VIEW_W, HUD_H)
draw_set_alpha(1)
draw_set_color(EDGE)
draw_line(0, HUD_H, VIEW_W, HUD_H, 2)
icon("renown", 30, 28, 42)
text(30, 16, str(r["level"]), INK, 17, "center")
lo, hi = xp_for(r["level"]), xp_for(r["level"] + 1)
draw_set_color("#0c0b0a")
draw_rect(58, 20, 178, 36)
draw_set_color("#c9a44c")
draw_rect(58, 20, 58 + 120 * min(1, (r["xp"] - lo) / max(1, hi - lo)), 36)
text(118, 20, f"{r['xp'] - lo} / {hi - lo}", INK, 11, "center")
for i, res in enumerate(RESOURCES):
    x = 200 + i * 230
    cap = capacity(r, res)
    icon(res, x + 18, 28, 38)
    draw_set_color("#0c0b0a")
    draw_rect(x + 40, 18, x + 210, 38)
    draw_set_color(GOLD if res == "gold" else FOOD)
    draw_rect(x + 40, 18, x + 40 + 170 * min(1, r[res] / max(1, cap)), 38)
    text(x + 125, 19, f"{big_number(r[res])} / {big_number(cap)}", SHADOW if r[res] / max(1, cap) > 0.55 else INK, 13, "center")
icon("builder", 660, 28, 38)
text(682, 17, f"{free_builders(r)} / {builders(r)}", INK if free_builders(r) else RED, 18)
# Something being placed: what to do.
if global_vars.placing:
    p = global_vars.placing
    words = ("Tap or drag to lay walls" if p == "wall" else "Tap where it goes" if p == "move"
             else f"Tap where the {info(p)['name'].lower()} goes")
    text(VIEW_W / 2, HUD_H + 10, words, MINT, 18, "center")
# Gold and food rising off where they were collected.
for item, x, y, age, n in global_vars.pops:
    draw_set_alpha(min(1, (50 - age) / 15))
    px, py = to_screen(x, y)
    icon(item, px, py - age * 0.8, 34)
    text(px + 20, py - age * 0.8 - 10, f"+{big_number(n)}", GOLD if item == "gold" else FOOD, 16)
draw_set_alpha(1)
# The open window's words and pictures (its buttons draw themselves).
box = global_vars.panel_box
if global_vars.panel and box:
    x1, y1, x2, y2 = box
    panel(x1, y1, x2, y2)
    if global_vars.panel == "building":
        b = r["buildings"][global_vars.panel_of]
        kind, lv = b["kind"], b["level"]
        i = info(kind)
        h = y2 - y1
        draw_sprite_ext(f"{kind}_{tier(max(1, lv))}", 0, x1 + 120, y1 + h * 0.62, 160 / (i["size"] * TILE_W), 160 / (i["size"] * TILE_W), 0, "white", 1)
        text(x1 + 24, y1 + 14, i["name"], GOLD, 26)
        text(x1 + 24, y1 + 48, f"Level {lv}" + (f" of {levels(kind)}" if kind != "builder_hut" else ""), DIM, 15)
        text(x1 + 250, y1 + 60, i["about"], DIM, 13, "left", 400)
        # Now, and the next level.
        rows = [(name, words) for name, words in (("hp", "Strength"), ("rate", "Makes an hour"), ("hold", "Holds"),
                                                   ("store", "Keeps"), ("damage", "Damage a second"), ("range", "Reach (tiles)"),
                                                   ("room", "Soldiers")) if name in i]
        y = y1 + 110
        to = lv + 1
        for name, words in rows:
            now_ = big_number(stat(kind, name, lv)) if lv else "-"
            nxt = big_number(stat(kind, name, to)) if to <= levels(kind) else ""
            text(x1 + 250, y, words, INK, 14)
            text(x1 + 470, y, now_, INK, 14, "right")
            if nxt and nxt != now_:
                text(x1 + 490, y, f"→ {nxt}", MINT, 14)
            y += 27
        if kind == "keep":
            text(x1 + 250, y + 4, f"Next level allows: {', '.join(keep_unlocks(r)) or 'more of everything'}", MINT, 12, "left", 400)
        if b["job"] is not None:
            left = time_left(b)
            total = info(kind)["time"][b["job"]["to"] - 1]
            text(x1 + 270, y2 - 132, f"{'Building' if lv == 0 else 'Upgrading to level ' + str(b['job']['to'])}: {clock_words(left)} left", GOLD, 15)
            draw_set_color("#0c0b0a")
            draw_rect(x1 + 270, y2 - 104, x2 - 30, y2 - 94)
            draw_set_color(MINT)
            draw_rect(x1 + 270, y2 - 104, x1 + 270 + (x2 - 30 - x1 - 270) * clamp(1 - left / max(1, total), 0, 1), y2 - 94)
        elif to <= levels(kind) and kind != "builder_hut":
            why = can_upgrade(r, b)
            secs = i["time"][to - 1]
            text(x1 + 345, y2 - 64, "Instant" if secs == 0 else f"Takes {clock_words(secs)}", DIM, 13)
            if why:
                text(x1 + 345, y2 - 42, why, RED, 13)
        if maker(b) and b["level"] and b["job"] is None:
            text(x1 + 270, y2 - 124, f"Waiting: {big_number(waiting(b))} of {big_number(stat(kind, 'hold', lv))}", GOLD if makes(b) == "gold" else FOOD, 14)
    elif global_vars.panel == "army":
        text(x1 + 20, y1 + 12, "Your army", GOLD, 26)
        text(x1 + 230, y1 + 20, f"Camps: {army_used(r)} of {army_room(r)} room", INK if army_used(r) < army_room(r) else GOLD, 16)
        if r["training"]:
            k = r["training"][0]
            text(x1 + 230, y1 + 46, f"Training a {TROOPS[k]['name'].lower()}: {clock_words(train_left(r))}  ·  {len(r['training'])} in the queue", MINT, 13)
        else:
            text(x1 + 230, y1 + 46, f"Barracks level {barracks_level(r)}: each level trains a new kind of troop.", DIM, 13)
        for i, (k, t) in enumerate(TROOPS.items()):
            y = y1 + 92 + i * ARMY_ROW
            locked = barracks_level(r) < t["barracks"]
            draw_sprite_ext(f"troop_{k}_front", 0, x1 + 40, y + 40, 0.7, 0.7, 0, "white", 0.35 if locked else 1)
            text(x1 + 76, y + 2, t["name"] + (f"  (barracks {t['barracks']})" if locked else ""), DIM if locked else INK, 15)
            text(x1 + 76, y + 22, t["about"], DIM, 11, "left", 330)
            text(x1 + 420, y + 4, f"{t['space']} room · {clock_words(t['time'])}", DIM, 12)
            ready = r["army"].get(k, 0)
            queued = r["training"].count(k)
            text(x1 + 420, y + 24, f"{ready} ready" + (f", {queued} coming" if queued else ""), GOLD if ready else DIM, 13)
    elif global_vars.panel == "campaign":
        text(x1 + 20, y1 + 12, "Attack!", GOLD, 26)
        text(x1 + 170, y1 + 22, f"Villages round about. Your army: {army_size(r)} troops.", DIM, 14)
        for i, v in enumerate(CAMPAIGN):
            cx, cy = x1 + 16 + (i % 4) * 240, y1 + 58 + (i // 4) * CAMP_ROW
            open_ = village_open(r, i)
            draw_set_alpha(0.35 if open_ else 0.18)
            draw_set_color("#000000")
            draw_rect(cx, cy, cx + 232, cy + CAMP_ROW - 8)
            draw_set_alpha(1)
            text(cx + 10, cy + 6, f"{i + 1}. {v['name']}", GOLD if open_ else DIM, 16)
            text(cx + 10, cy + 28, f"Keep level {v['keep']}", DIM, 12)
            got = r["campaign"].get(str(i), 0)
            for k in range(3):
                icon("star", cx + 170 + k * 20, cy + 16, 18, 1 if k < got else 0.2)
            left = village_loot(r, i)
            icon("gold", cx + 18, cy + 64, 20)
            text(cx + 30, cy + 56, big_number(left[0]), GOLD if open_ else DIM, 12)
            icon("food", cx + 18, cy + 86, 20)
            text(cx + 30, cy + 78, big_number(left[1]), FOOD if open_ else DIM, 12)
            if not open_:
                text(cx + 182, cy + 70, "Locked", DIM, 13, "center")
    elif global_vars.panel == "obstacle":
        o = r["obstacles"][global_vars.panel_of]
        oi = OBSTACLES[o[0]]
        draw_sprite_ext(o[0], 0, x1 + 400, y1 + 150, 1, 1, 0, "white", 1)
        text(x1 + 24, y1 + 14, oi["name"], GOLD, 26)
        text(x1 + 24, y1 + 56, "In the way? Clear it for a little", DIM, 15)
        text(x1 + 24, y1 + 78, f"{oi['pays']}, and {oi['xp']} renown.", DIM, 15)
    elif global_vars.panel == "shop":
        text(x1 + 20, y1 + 14, "Build", GOLD, 26)
        for i, (k, name, price, pays, why) in enumerate(shop_rows(r, global_vars.shop_tab)):
            y = y1 + 60 + i * SHOP_ROW
            draw_sprite_ext(f"{k}_1" if k != "wall" else "wall_1", 0, x1 + 44, y + 30, 40 / (info(k)["size"] * TILE_W) * 1.4, 40 / (info(k)["size"] * TILE_W) * 1.4, 0, "white", 1)
            text(x1 + 84, y + 4, f"{name}  ({how_many(r, k)} of {allowed(r, k) if k != 'builder_hut' else len(BUILDER_COSTS)})", INK if not why else DIM, 15)
            text(x1 + 84, y + 22, info(k)["about"], DIM, 11, "left", 400)
# A new renown level.
if global_vars.levelup is not None:
    level, left = global_vars.levelup
    draw_set_alpha(min(1, left / 30))
    panel(VIEW_W / 2 - 220, 84, VIEW_W / 2 + 220, 150, 0.95)
    text(VIEW_W / 2, 96, f"Renown {level}!", GOLD, 32, "center")
    draw_set_alpha(1)
if global_vars.said is not None:
    words, colour, left = global_vars.said
    draw_set_alpha(min(1, left / 20))
    panel(VIEW_W / 2 - 320, VIEW_H - 112, VIEW_W / 2 + 320, VIEW_H - 72, 0.88)
    text(VIEW_W / 2, VIEW_H - 103, words, colour, 15, "center")
    draw_set_alpha(1)
