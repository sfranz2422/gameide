# object: Title
# The front: pick a suit (arrows, or click one), then dive.

# === create
names = [s[0] for s in SUITS]
self.pick = names.index(save_get("suit", "coral")) if save_get("suit", "coral") in names else 0
self.t = 0
touch_controls(True, ("e",))

# === step
self.t += 1
if keyboard_check_pressed("left") or keyboard_check_pressed("a"):
    self.pick = (self.pick - 1) % len(SUITS)
    sound_play("click", volume=0.4)
if keyboard_check_pressed("right") or keyboard_check_pressed("d"):
    self.pick = (self.pick + 1) % len(SUITS)
    sound_play("click", volume=0.4)
go = keyboard_check_pressed("space") or keyboard_check_pressed("enter") or keyboard_check_pressed("e")
if mouse_check_pressed("left"):
    for i in range(len(SUITS)):
        x = 56 + i * 68
        if x <= mouse_x <= x + 60 and 236 <= mouse_y <= 296:
            go = go or self.pick == i
            self.pick = i
            sound_play("click", volume=0.4)
    if 220 <= mouse_x <= 420 and 312 <= mouse_y <= 346:
        go = True
if go:
    save_set("suit", SUITS[self.pick][0])
    room_goto("Station")

# === draw
draw_sprite_ext("title", 0, 0, 0, VIEW_W / SIZES["title"][0], VIEW_H / SIZES["title"][1])
words(VIEW_W / 2, 24, "Undertow", 44, "#cfeaff", "center")
words(VIEW_W / 2, 78, "Keep the station running. Not everyone is who they seem.", 14, "#9fd0ff", "center")
draw_set_alpha(0.6)
draw_set_color("#020a14")
draw_rect(40, 208, VIEW_W - 40, 354)
draw_set_alpha(1)
words(VIEW_W / 2, 214, "Pick your suit: " + SUITS[self.pick][1], 15, "white", "center")
for i, (name, _, color) in enumerate(SUITS):
    x = 56 + i * 68
    if i == self.pick:
        draw_set_color("#ffd23f")
        draw_rect(x - 3, 233, x + 63, 299)
    draw_set_color("#0d2233")
    draw_rect(x, 236, x + 60, 296)
    draw_sprite_ext("face_" + name, 0, x + 2, 238, 56 / SIZES["face_" + name][0], 56 / SIZES["face_" + name][1])
draw_set_color("#1f8f9f" if (self.t // 30) % 2 else "#27a9bb")
draw_rect(220, 312, 420, 346)
words(VIEW_W / 2, 317, "Dive!", 20, "white", "center")
