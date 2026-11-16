# object: Breads
# depth: 1000
# Pick your bread, then cut a slice: tap the loaf (or press Space) and the knife
# comes down. The sandwich starts with that bread's bottom slice on the plate.

# === create
global_vars.focus = None
global_vars.drag = None
global_vars.picked = None
global_vars.chop = 0
self.t = 0
for i, b in enumerate(BREADS):
    c, r = i % 3, i // 3
    make_spot(VIEW_W / 2 - 360 + c * 250, 120 + r * 215, 220, 200, "bread", b["key"])
self.back = make_button(12, 12, 90, 34, "Back", "title", None, 15)

# === step
question_ok(False)
self.t += 1
if global_vars.chop == 0:
    pointer()
    run_controls(None)
else:
    global_vars.chop += 1
    if global_vars.chop == CHOP_STEPS:
        sound_play("chop", volume=0.8)
        camera_shake(3, 8)
    if global_vars.chop >= SLICED_STEPS:
        global_vars.s = new_sandwich(global_vars.picked)
        global_vars.tab = "meat"
        room_goto("Kitchen")

# === draw
sunburst(VIEW_W / 2, VIEW_H / 2, self.t)
b = global_vars.picked
if b is None:
    text(VIEW_W / 2, 50, "Pick Your Bread", "#fff6d8", 44, "center")
else:
    text(VIEW_W / 2, 50, "Cut a Slice", "#fff6d8", 44, "center")
    cx, cy = VIEW_W / 2, 330
    big_plate(cx, cy + 70, 460)
    pic(f"loaf_{b}", cx, cy, 1.5)
    c = global_vars.chop
    # The slice: once the knife is through, it falls away to the right.
    if c >= CHOP_STEPS:
        p = min(1, (c - CHOP_STEPS) / 20)
        pic(f"bottom_{b}", cx + 150 + p * 90, cy + 20 + p * 40, 0.9, 1, 0, -70 * (1 - p))
    # The knife: over the loaf's right end, down through it as it cuts.
    if c == 0:
        kx = clamp(mouse_x, cx - 160, cx + 200) if not keyed() else cx + 130
        ky = cy - 150
    else:
        kx = cx + 130
        ky = cy - 150 + min(1, c / CHOP_STEPS) * 190
    draw_set_color("#d8dde4")
    draw_triangle(kx - 6, ky, kx + 10, ky, kx + 10, ky + 150)
    draw_rect(kx - 6, ky, kx + 10, ky + 120)
    draw_set_color("#ffffff")
    draw_line(kx - 5, ky + 4, kx - 5, ky + 116, 2)
    draw_set_color("#6b3a1c")
    draw_rect(kx - 9, ky - 80, kx + 13, ky)
    draw_set_color("#3a1a08")
    draw_rect(kx - 9, ky - 80, kx + 13, ky, True)
    if c == 0:
        text(cx, 520, "Tap the loaf to cut it", CREAM, 20, "center")
