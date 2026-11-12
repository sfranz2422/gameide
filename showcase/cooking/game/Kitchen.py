# object: Kitchen
# depth: 1000
# The day: lays out the kitchen (only what's on today's menu), seats customers as
# they come, keeps everything cooking, and closes up. The rules are the kitchen
# script's; this runs them each step and draws the restaurant and the top bar.

# === create
k = global_vars.k
rs = RESTAURANTS[k["rest"]]
global_vars.focus = None
global_vars.pose = ("ready", 0)
self.closing = 0
# Cookers: one Spot a slot, side by side from where the restaurant puts that machine.
for c, cooker in enumerate(k["cookers"]):
    x0 = next(d["x"] for d in rs["cookers"] if d["key"] == cooker["key"])
    pic_name = next(d["pic"] for d in rs["cookers"] if d["key"] == cooker["key"])
    for s in range(len(cooker["slots"])):
        o = instance_create(x0 + s * SLOT_W, COOKER_Y, "Cooker")
        o.c, o.s, o.machine, o.wide, o.high = c, s, pic_name, SLOT_W - 4, SLOT_H
# Sources: the parts on today's menu, sharing the left of the counter.
parts = [p for p in rs["sources"] if on_menu(k["rest"], k["day"], p)]
w = min(76, 380 / max(1, len(parts)))
for j, part in enumerate(parts):
    o = instance_create(SOURCE_X + j * w, SOURCE_Y, "Source")
    o.part, o.wide, o.high = part, w - 4, SOURCE_H
for i in range(PLATES):
    o = instance_create(PLATE_X + i * PLATE_W, SOURCE_Y, "Plate")
    o.i, o.wide, o.high = i, PLATE_W - 6, SOURCE_H
for i in range(SHELF_SLOTS):
    o = instance_create(SHELF_X + i * SHELF_W, SHELF_Y, "Shelf")
    o.i, o.wide, o.high = i, SHELF_W - 4, SHELF_H
b = instance_create(BIN_X, BIN_Y, "Bin")
b.wide, b.high = BIN_W, BIN_H
self.leave = make_button(VIEW_W - 92, 4, 84, 28, "Leave", "leave", None, 14)

# === step
question_ok(False)      # questions come between days, never in the middle of a rush
k = global_vars.k
if not k["over"]:
    pointer()
    run_controls(None)
    k["t"] += 1
    tick_kitchen(k)
    arrive(k)
    pose, left = global_vars.pose
    if left > 0:
        global_vars.pose = (pose, left - 1)
    if day_finished(k):
        finish_day(k)
        sound_play("bell", volume=0.6)
        self.closing = 60
else:
    self.closing -= 1
    if self.closing <= 0:
        room_goto("Summary")

# === draw
k = global_vars.k
rs = RESTAURANTS[k["rest"]]
draw_sprite(f"place_{rs['key']}", 0, 0, 0)      # the build makes it exactly the screen's size
# The cook, at the left behind the counter: how things are going shows on their face.
pose, left = global_vars.pose
if left <= 0:
    waiting = [c for c in instances("Customer") if c.phase == "wait"]
    low = any(c.wait / c.full < IMPATIENT for c in waiting)
    pose = "worried" if low else ("wipe" if len(waiting) >= SEATS else "ready")
draw_sprite(f"cook_{rs['cook']}", COOK_POSES.index(pose), 78, COUNTER_Y)
# The shelf's label, and the counter's two rows.
text(SHELF_X + 4, SHELF_Y - 18, "Ready to serve", DIM, 12)

# === draw_gui
k = global_vars.k
rs = RESTAURANTS[k["rest"]]
panel(0, 0, VIEW_W, 36, 0.85)
text(10, 7, f"{rs['name']}  ·  Day {k['day'] + 1}", INK, 18)
left = max(0, DAY_STEPS - k["t"]) // FPS
text(VIEW_W / 2 - 150, 7, f"{left // 60}:{left % 60:02d}", GOLD if left > 15 else RED, 18, "center")
# Coins, against the three star goals.
goals = star_goals(k["goal"])
bx, bw = VIEW_W / 2 - 90, 300
draw_set_color("#20140c")
draw_rect(bx, 10, bx + bw, 26)
draw_set_color("#ffcf3a")
draw_rect(bx, 10, bx + bw * min(1, k["coins"] / goals[2]), 26)
for g in goals:
    gx = bx + bw * g / goals[2]
    draw_set_color("#ffffff")
    draw_line(gx, 8, gx, 28, 2)
text(bx + bw + 12, 7, f"{k['coins']} / {goals[2]}", GOLD, 18)
mult = min(COMBO_MAX, 1 + COMBO_STEP * max(0, k["combo"] - 1))
if k["combo"] >= 2:
    text(VIEW_W - 110, 7, f"Combo ×{mult:g}", MINT, 16, "right")
door = waiting_at_door(k)
if door:
    text(VIEW_W - 10, 42, f"{door} waiting at the door", GOLD, 14, "right")

# What's being dragged, under the pointer, over everything.
d = dragged()
if d is not None and not k["over"]:
    what = drag_picture(d)
    if what is not None and what[0] == "pic":
        pic(what[1], mouse_x, mouse_y, 0.9, 0.85)
    elif what is not None:
        draw_dish(what[1], RESTAURANTS[k["rest"]]["dish"], mouse_x, mouse_y + 30, 0.9)
