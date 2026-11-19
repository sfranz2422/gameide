# object: Battlefield
# depth: -100000
# A battle on screen: the village's buildings and walls (Props: the engine draws them),
# a Prop for every troop put down, moved each step to where the battle script says it is,
# the shots flying, and the bar along the top and the troops to choose along the bottom.
# The battle itself is the battle script's (global_vars.battle); this only shows it and
# passes on the taps: tap outside the village to put the chosen troop down, hold still to
# keep putting them down, drag to look round.
#
# global_vars.raid says whose: {"kind": "village", "village": i, "name"}, a classmate's
# kingdom {"kind": "player", "id", "name", "trophies", "win", "lose"} (raids script), or a
# replay of a raid on you {"kind": "replay", "name", "steps"}: no taps then, the troops go
# down when the raider's did.

# === create
r = global_vars.realm
b = global_vars.battle
global_vars.t = 0
global_vars.focus = None
global_vars.drag = None
global_vars.said = None
global_vars.panel = None
global_vars.panel_box = None
instance_create(0, 0, "Ground")
self.props = {}                      # a building's number: its Prop
for i, s in enumerate(b["bs"]):
    x, y = building_xy(s["kind"], s["gx"], s["gy"])
    o = instance_create(x, y, "Prop")
    o.sprite = f"wall_{tier(s['level'])}" if s["kind"] == "wall" else f"{s['kind']}_{tier(s['level'])}"
    o.depth = -y
    self.props[i] = o
walls = {(s["gx"], s["gy"]) for s in b["bs"] if s["kind"] == "wall"}
for i, s in enumerate(b["bs"]):
    if s["kind"] == "wall":
        gx, gy = s["gx"], s["gy"]
        if ((gx, gy - 1) in walls or (gx, gy + 1) in walls) and not ((gx - 1, gy) in walls or (gx + 1, gy) in walls):
            self.props[i].sprite += "_gy"
self.troops = []                     # a Prop for each troop, in the battle's order
self.chosen = next(iter(b["army"]), None)
self.kind = global_vars.raid["kind"]
self.steps = list(global_vars.raid.get("steps", []))     # a replay's: [seconds, troop, x, y], in order
self.tray = []
for k, kind in enumerate(TROOPS):
    if self.kind != "replay" and r["army"].get(kind, 0):
        bt = make_button(16 + len(self.tray) * 108, VIEW_H - 96, 100, 82, TROOPS[kind]["name"], "troop", kind, 11)
        bt.pic = f"troop_{kind}_front"
        self.tray.append(bt)
self.end = make_button(VIEW_W - 170, 66, 156, 40, "Stop watching" if self.kind == "replay" else "End battle", "end_battle", None, 15)
# A classmate's kingdom: before the first troop, Next looks for another (a search's cost).
self.next = make_button(VIEW_W - 170, 114, 156, 40, f"Next: {search_cost(r):,} gold", "next_raid", None, 14)
self.next.shown = self.kind == "player"
self.home = make_button(VIEW_W / 2 - 140, VIEW_H / 2 + 120, 280, 54, "Back to your kingdom", "go_home", None, 20)
self.home.hot = True
self.home.shown = False
self.result = None
self.hold = 0                        # steps the pointer's been held still on the field
camera_zoom(global_vars.zoom)
x, y = tile_xy(MID, MID)
w, h = shown(global_vars.zoom)
move_camera(x - w / 2, y - h / 2)
global_vars.cursor = (MID - 24, MID)

# === step
global_vars.t += 1
b = global_vars.battle
r = global_vars.realm
question_ok(b["over"])              # a question only once the battle's over
track_mouse()
# Choosing a troop: its button, or a number key.
for j, bt in enumerate(self.tray):
    if keyboard_check_pressed(str(j + 1)):
        self.chosen = bt.arg
    bt.picked = bt.arg == self.chosen
    bt.off = b["army"].get(bt.arg, 0) == 0
    bt.count = b["army"].get(bt.arg, 0)
    bt.shown = not b["over"]
self.end.shown = not b["over"]
self.next.shown = self.kind == "player" and not b["units"] and not b["over"]
self.next.off = r["gold"] < search_cost(r)
if self.chosen is not None and b["army"].get(self.chosen, 0) == 0:
    self.chosen = next(iter(b["army"]), None)
if b["over"]:
    run_buttons(self.home)          # only then: in battle, Space sends a troop and 1-7 choose one
if not b["over"]:
    if self.kind == "replay":
        # The raider's troops, each at the moment it went down.
        while self.steps and self.steps[0][0] <= b["time"] + 1e-6:
            s = self.steps.pop(0)
            deploy(b, s[1], s[2], s[3])
    else:
        battle_pointer(self)
        battle_keys(self)
    if global_vars.t % 2 == 0:
        tick(b)
camera_set(*global_vars.cam)
if b["over"] and self.result is None:
    # Over: the troops sent are gone, the loot goes home, the stars are kept (once).
    if self.kind == "village":
        self.result = finish_raid(r, global_vars.raid["village"], b)
    elif self.kind == "player":
        self.result = finish_player_raid(r, global_vars.raid, b)
    else:
        self.result = {"stars": b["stars"], "new_stars": 0, "gold": b["loot"][0], "food": b["loot"][1], "lost": 0, "levels": []}
    keep_save(r)
    level_up(self.result["levels"])
    self.home.shown = True
    sound_play("levelup" if b["stars"] else "nope", volume=0.6)
# The village: a building knocked down is rubble, a wall gone.
for i, s in enumerate(b["bs"]):
    o = self.props.get(i)
    if o is not None and s["dead"]:
        if s["kind"] == "wall":
            o.destroy()
            del self.props[i]
        elif not o.sprite.startswith("rubble"):
            o.sprite = f"rubble_{s['n']}"
            x, y = building_xy(s["kind"], s["gx"], s["gy"])
            effect("dust", x, y - 20, None, 1.2)
            sound_play("build", volume=0.4)
# The troops: a Prop each, where the battle has them, facing their way, stepping or swinging.
while len(self.troops) < len(b["units"]):
    o = instance_create(0, 0, "Prop")
    o.image_speed = 0
    self.troops.append(o)
for j, (u, o) in enumerate(zip(b["units"], self.troops)):
    if o is None:
        continue
    if u["dead"]:
        o.destroy()
        self.troops[j] = None
        continue
    x, y = tile_xy(u["x"], u["y"])
    dx, dy = u["dir"]
    sx, sy = dx - dy, dx + dy                     # its way on the screen
    o.sprite = f"troop_{u['kind']}_{'front' if sy >= 0 else 'back'}"
    o.x, o.y, o.depth = x, y, -y - 1
    o.image_xscale = -1 if sx > 0 else 1          # drawn facing left; turned round to face right
    step_ = (global_vars.t // 8 + int(u["x"] * 3)) % 2
    o.image_index = step_ if u["moving"] else (2 + step_ if u["hit"] is not None else 0)
if global_vars.said is not None:
    global_vars.said[2] -= 1
    if global_vars.said[2] <= 0:
        global_vars.said = None

# === draw
b = global_vars.battle
# Shots in flight.
for sh in b["shots"]:
    x, y = tile_xy(sh["x"], sh["y"])
    lift = 40
    if sh["kind"] == "stone":
        draw_set_color("#5a5650")
        draw_circle(x, y - lift, 7)
    else:
        tx, ty = tile_xy(sh["tx"], sh["ty"])
        d = math.hypot(tx - x, ty - y) or 1
        draw_set_color("#3a2a18" if sh["kind"] == "arrow" else "#2a2a2a")
        draw_line(x, y - lift, x + (tx - x) / d * 18, y - lift + (ty - y) / d * 18, 2 if sh["kind"] == "arrow" else 4)
# Hit points over anything hurt.
for s in b["bs"]:
    if not s["dead"] and s["hp"] < s["max"] and s["kind"] != "wall":
        x, y = building_xy(s["kind"], s["gx"], s["gy"])
        top = y - s["n"] * TILE_H / 2 - 40
        draw_set_color("#1a1a1a")
        draw_rect(x - 30, top, x + 30, top + 6)
        draw_set_color("#e05040" if s["hp"] < s["max"] / 3 else "#e8c040")
        draw_rect(x - 30, top, x - 30 + 60 * s["hp"] / s["max"], top + 6)
for u in b["units"]:
    if not u["dead"] and u["hp"] < u["max"]:
        x, y = tile_xy(u["x"], u["y"])
        draw_set_color("#1a1a1a")
        draw_rect(x - 12, y - 58, x + 12, y - 54)
        draw_set_color("#6fd16a")
        draw_rect(x - 12, y - 58, x - 12 + 24 * u["hp"] / u["max"], y - 54)
# Where the chosen troop would go: green outside the village, red too close.
if not b["over"] and self.chosen is not None:
    t = tile_at(mouse_x, mouse_y) if not keyed() else global_vars.cursor
    if t is not None:
        ok = can_deploy(b, self.chosen, *t) is None
        diamond(*tile_xy(*t), MINT if ok else RED, 0.45)

# === draw_gui
b = global_vars.battle
r = global_vars.realm
raid = global_vars.raid
draw_set_alpha(0.88)
draw_set_color("#1d1b18")
draw_rect(0, 0, VIEW_W, HUD_H)
draw_set_alpha(1)
draw_set_color(EDGE)
draw_line(0, HUD_H, VIEW_W, HUD_H, 2)
text(16, 14, ("Watching: " if self.kind == "replay" else "") + raid["name"], GOLD, 22)
if self.kind == "player":
    # The trophies at stake (the server's), under the bar.
    icon("trophy", 30, HUD_H + 26, 30)
    text(50, HUD_H + 12, f"{raid['trophies']}  ·  win +{raid['win']}  ·  lose -{raid['lose']}", INK, 15)
left = battle_left(b)
text(VIEW_W / 2 - 40, 12, f"{int(left) // 60}:{int(left) % 60:02d}", INK if left > 30 else RED, 24, "center")
for k in range(3):
    icon("star", VIEW_W / 2 + 70 + k * 34, 28, 30, 1 if k < b["stars"] else 0.25)
text(VIEW_W / 2 + 176, 16, f"{destroyed_pct(b)}%", INK, 20)
icon("gold", VIEW_W - 250, 28, 30)
text(VIEW_W - 230, 16, big_number(b["loot"][0]), GOLD, 17)
icon("food", VIEW_W - 130, 28, 30)
text(VIEW_W - 110, 16, big_number(b["loot"][1]), FOOD, 17)
if not b["over"] and not b["units"] and self.kind != "replay":
    text(VIEW_W / 2, HUD_H + 14, "Look round, then tap the grass outside to send in your troops: the clock starts then.", MINT, 16, "center")
if b["over"] and self.result is not None:
    res = self.result
    panel(VIEW_W / 2 - 300, VIEW_H / 2 - 170, VIEW_W / 2 + 300, VIEW_H / 2 + 190)
    if self.kind == "replay":
        title = "They won!" if res["stars"] else "You held them off!"
        good = not res["stars"]
    else:
        title, good = ("Victory!" if res["stars"] else "Defeat"), bool(res["stars"])
    text(VIEW_W / 2, VIEW_H / 2 - 156, title, GOLD if good else RED, 40, "center")
    text(VIEW_W / 2, VIEW_H / 2 - 104, b["ended"], DIM, 15, "center")
    for k in range(3):
        icon("star", VIEW_W / 2 - 60 + k * 60, VIEW_H / 2 - 50, 52, 1 if k < res["stars"] else 0.2)
    text(VIEW_W / 2, VIEW_H / 2 - 12, f"{destroyed_pct(b)}% knocked down", INK, 17, "center")
    icon("gold", VIEW_W / 2 - 120, VIEW_H / 2 + 40, 34)
    text(VIEW_W / 2 - 98, VIEW_H / 2 + 28, f"+{big_number(res['gold'])}", GOLD, 18)
    icon("food", VIEW_W / 2 + 40, VIEW_H / 2 + 40, 34)
    text(VIEW_W / 2 + 62, VIEW_H / 2 + 28, f"+{big_number(res['food'])}", FOOD, 18)
    if self.kind == "player":
        # The trophies: the server's answer once it's come, what it should be till then.
        got = raid_result()
        n = got["trophies"] if got and "trophies" in got else res["trophies"]
        icon("trophy", VIEW_W / 2 - 50, VIEW_H / 2 + 92, 30)
        text(VIEW_W / 2 - 30, VIEW_H / 2 + 80, f"{'+' if n >= 0 else ''}{n} trophies", MINT if n >= 0 else RED, 17)
    if res["lost"]:
        text(VIEW_W / 2, VIEW_H / 2 + 66, f"{big_number(res['lost'])} didn't fit in your storage.", RED, 13, "center")
    elif res["new_stars"]:
        text(VIEW_W / 2, VIEW_H / 2 + 66, f"{res['new_stars']} new star{'s' if res['new_stars'] > 1 else ''}!", MINT, 15, "center")
if global_vars.said is not None:
    words, colour, n = global_vars.said
    draw_set_alpha(min(1, n / 20))
    panel(VIEW_W / 2 - 300, VIEW_H - 150, VIEW_W / 2 + 300, VIEW_H - 112, 0.88)
    text(VIEW_W / 2, VIEW_H - 141, words, colour, 15, "center")
    draw_set_alpha(1)
