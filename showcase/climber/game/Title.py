# object: Title
# The front: pick a climber (arrows, or click one), then climb.

# === create
names = [c[0] for c in CLIMBERS]
self.pick = names.index(save_get("climber", "red")) if save_get("climber", "red") in names else 0
self.t = 0
music_play("music", volume=0.3)

# === step
self.t += 1
if keyboard_check_pressed("left") or keyboard_check_pressed("a"):
    self.pick = (self.pick - 1) % len(CLIMBERS)
    sound_play("click", volume=0.4)
if keyboard_check_pressed("right") or keyboard_check_pressed("d"):
    self.pick = (self.pick + 1) % len(CLIMBERS)
    sound_play("click", volume=0.4)
go = keyboard_check_pressed("space") or keyboard_check_pressed("enter")
if mouse_check_pressed("left"):
    for i in range(len(CLIMBERS)):
        x = 56 + i * 68
        if x <= mouse_x <= x + 60 and 250 <= mouse_y <= 310:
            if self.pick == i:
                go = True
            self.pick = i
            sound_play("click", volume=0.4)
    if 220 <= mouse_x <= 420 and 318 <= mouse_y <= 352:
        go = True
if go:
    save_set("climber", CLIMBERS[self.pick][0])
    room_goto("Mountain")

# === draw
draw_sprite("title", 0, 0, 0)
words(VIEW_W / 2, 18, "Snowcap Scramble", 40, "white", "center")
words(VIEW_W / 2, 66, "How high can you climb?", 16, "#e8f6ff", "center")
draw_set_alpha(0.6)
draw_set_color("#0b1620")
draw_rect(40, 222, VIEW_W - 40, 356)
draw_set_alpha(1)
words(VIEW_W / 2, 228, "Pick your climber: " + CLIMBERS[self.pick][1], 15, "white", "center")
for i, (name, _) in enumerate(CLIMBERS):
    x = 56 + i * 68
    if i == self.pick:
        draw_set_color("#ffd84a")
        draw_rect(x - 3, 247, x + 63, 313)
    draw_set_color("#1d3446")
    draw_rect(x, 250, x + 60, 310)
    draw_sprite_ext("face_" + name, 0, x + 2, 252, 0.875, 0.875)
# The button glows, gently.
draw_set_color("#2e9e6e" if (self.t // 30) % 2 else "#38b57f")
draw_rect(220, 318, 420, 350)
words(VIEW_W / 2, 322, "Climb!", 20, "white", "center")
words(VIEW_W / 2, 92, "Arrows run · Up or Space jumps · X or a click throws · P pauses", 13, "#e8f6ff", "center")
