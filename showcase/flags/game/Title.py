# object: Title
# The front: pick your look with the arrows (or click one), then Space to play.
# You're on Red; the computer fills both teams.

# === create
self.pick = save_get("look", 0) % len(LOOKS[TEAMS[0]])
touch_controls(True, ("space",))

# === step
n = len(LOOKS[TEAMS[0]])
if keyboard_check_pressed("left") or keyboard_check_pressed("a"):
    self.pick = (self.pick - 1) % n
if keyboard_check_pressed("right") or keyboard_check_pressed("d"):
    self.pick = (self.pick + 1) % n
go = keyboard_check_pressed("space") or keyboard_check_pressed("enter") or gamepad_check_pressed("a")
if mouse_check_pressed("left"):
    for i in range(n):
        x = VIEW_W / 2 + (i - (n - 1) / 2) * 90
        if abs(mouse_x - x) < 36 and 170 < mouse_y < 260:
            go = go or self.pick == i
            self.pick = i
if go:
    save_set("look", self.pick)
    room_goto("Field")

# === draw_gui
if "title_pic" in SIZES:
    draw_sprite("title_pic", 0, 0, 0)      # the teacher's picture of the park at sunset
else:
    draw_rect_gradient(0, 0, VIEW_W, VIEW_H, "#f2b6c8", "#9fd0f5", True)
# A soft dark band behind the words and the kids, so they read on the busy picture.
draw_set_color("#0b1a2a")
draw_set_alpha(0.45)
draw_rect(0, 132, VIEW_W, 336)
draw_set_alpha(1)
words(VIEW_W / 2, 30, "Snowfort Flags", 40, "#ffffff", "center")
words(VIEW_W / 2, 84, "Grab their flag. Bring it home. Don't get splatted.", 14, "#ffffff", "center")
if in_room():
    words(VIEW_W / 2, 108, f"Room {net_room()}: the host deals the teams", 12, "#ffe27a", "center")
n = len(LOOKS[TEAMS[0]])
for i in range(n):
    x = VIEW_W / 2 + (i - (n - 1) / 2) * 90
    if i == self.pick:
        draw_set_color("#ffffff")
        draw_set_alpha(0.35)
        draw_circle(x, 218, 44)
        draw_set_alpha(1)
    draw_sprite_ext(f"kid_{TEAMS[0]}_{i}", 0, x, 268, 2, 2, 0, "white", 1)
words(VIEW_W / 2, 284, "Arrows to choose, Space to play", 14, "#ffffff", "center")
words(VIEW_W / 2, 308, "WASD walk · mouse aims, hold and let go to throw · E at a drift scoops", 12, "#dceeff", "center")
