# object: Hud
# depth: -1000
# What's on the glass: your height, your best, where you are on the mountain,
# and the name of each part of it the first time you climb into it (by your
# best, so a fall and the climb back don't show them all again). P pauses, and
# the Hud keeps working while paused.

# === create
self.ignore_pause = True
self.reached = None      # the part of the mountain your best is in
self.zone = ""           # the name showing
self.banner = 0

# === step
if keyboard_check_pressed("p") or keyboard_check_pressed("escape"):
    game_pause(not game_paused())
    net_away(game_paused())
if self.reached is None:
    # Starting out: where you are.
    self.reached = zone_at(global_vars.best)
    self.zone, self.banner = zone_at(global_vars.height), 180
elif zone_at(global_vars.best) != self.reached:
    self.reached = zone_at(global_vars.best)
    self.zone, self.banner = self.reached, 180
    sound_play("zone", volume=0.4)

# === draw_gui
pic = global_vars.player.pic
draw_sprite_ext("face_" + pic, 0, 10, 8, 0.75, 0.75)
words(64, 8, f"{global_vars.height} m", 26)
words(64, 40, f"Best {global_vars.best} m", 14, "#cfe8ff")

# The bar on the right: the whole climb so far, with you on it.
top = max(global_vars.best, global_vars.height, 50) * 1.15
x, y0, y1 = VIEW_W - 30, 40, VIEW_H - 30
draw_set_color("#10202c")
draw_rect(x - 4, y0 - 4, x + 4, y1 + 4)
draw_set_color("#5f8fb4")
draw_rect(x - 2, y0, x + 2, y1)
best_y = y1 - (y1 - y0) * global_vars.best / top
draw_set_color("#ffd84a")
draw_rect(x - 8, best_y - 1, x + 8, best_y + 1)
me_y = y1 - (y1 - y0) * global_vars.height / top
draw_sprite_ext("face_" + pic, 0, x - 12, me_y - 12, 0.375, 0.375)

if self.banner > 0:
    self.banner -= 1
    a = min(1, self.banner / 30, (180 - self.banner) / 15)
    draw_set_alpha(a)
    words(VIEW_W / 2, 70, self.zone, 30, "white", "center")
    draw_set_alpha(1)
if global_vars.wind != 0 and abs(global_vars.wind) > 0.2:
    words(VIEW_W / 2, VIEW_H - 34, "wind  " + ("→" if global_vars.wind > 0 else "←"), 16, "#e8f6ff", "center")
if game_paused():
    draw_set_alpha(0.55)
    draw_set_color("#0b1620")
    draw_rect(0, 0, VIEW_W, VIEW_H)
    draw_set_alpha(1)
    words(VIEW_W / 2, VIEW_H / 2 - 30, "Paused", 36, "white", "center")
    words(VIEW_W / 2, VIEW_H / 2 + 16, "P to carry on", 16, "#cfe8ff", "center")
