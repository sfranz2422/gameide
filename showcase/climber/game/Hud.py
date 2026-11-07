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

others = [g for g in instances("Ghost")]
# The bar on the right: the whole climb so far, with you on it (and the room).
top = max([global_vars.best, global_vars.height, 50] + [g.height for g in others]) * 1.15
x, y0, y1 = VIEW_W - 30, 40, VIEW_H - 30
draw_set_color("#10202c")
draw_rect(x - 4, y0 - 4, x + 4, y1 + 4)
draw_set_color("#5f8fb4")
draw_rect(x - 2, y0, x + 2, y1)
best_y = y1 - (y1 - y0) * global_vars.best / top
draw_set_color("#ffd84a")
draw_rect(x - 8, best_y - 1, x + 8, best_y + 1)
for g in others:
    gy = y1 - (y1 - y0) * g.height / top
    draw_set_color(number_color(g.number))
    draw_rect(x - 6, gy - 3, x + 6, gy + 3)
me_y = y1 - (y1 - y0) * global_vars.height / top
draw_sprite_ext("face_" + pic, 0, x - 12, me_y - 12, 0.375, 0.375)

if net_room() is not None:
    # The room's board: everyone's best since joining, highest first. It stays up
    # as long as the room does: there's no end and no winner, only who's highest.
    me = global_vars.player
    rows = [(g.best, g.number, g.name, False) for g in others] + [(global_vars.room_best, me.number, "You", True)]
    rows.sort(key=lambda r: (-r[0], r[1]))
    shown = rows[:6]
    if not any(r[3] for r in shown):
        shown[-1] = next(r for r in rows if r[3])
    bx, by = VIEW_W - 196, 8
    draw_set_alpha(0.55)
    draw_set_color("#0b1620")
    draw_rect(bx - 6, by - 2, VIEW_W - 44, by + 22 + 17 * len(shown))
    draw_set_alpha(1)
    words(bx, by, f"Room {net_room()}  ·  {len(rows)} here", 12, "#cfe8ff")
    for k, (best, n, name, mine) in enumerate(shown):
        ry = by + 19 + k * 17
        draw_set_color(number_color(n))
        draw_rect(bx, ry + 1, bx + 18, ry + 15)
        words(bx + 9, ry, str(n), 11, "white", "center")
        words(bx + 24, ry, name[:12], 12, "#ffd84a" if mine else "white")
        words(VIEW_W - 50, ry, f"{best} m", 12, "#ffd84a" if mine else "white", "right")
    # Arrows at the edge of the screen toward anyone out of sight.
    for g in others:
        sx, sy = g.x - view_x, g.y - 30 - view_y
        if 0 <= sx <= VIEW_W and 0 <= sy <= VIEW_H:
            continue
        ax = clamp(sx, 20, VIEW_W - 56)
        # Clear of your height up top on the left, and of the board on the right.
        ay = clamp(sy, (by + 40 + 17 * len(shown)) if ax > bx - 20 else 80, VIEW_H - 20)
        d = math.atan2(sy - ay, sx - ax)
        draw_set_color(number_color(g.number))
        draw_triangle(ax + 14 * math.cos(d), ay + 14 * math.sin(d), ax + 8 * math.cos(d + 2.3), ay + 8 * math.sin(d + 2.3),
                      ax + 8 * math.cos(d - 2.3), ay + 8 * math.sin(d - 2.3))
        draw_circle(ax, ay, 9)
        words(ax, ay - 8, str(g.number), 11, "white", "center")

if self.banner > 0:
    self.banner -= 1
    a = min(1, self.banner / 30, (180 - self.banner) / 15)
    draw_set_alpha(a)
    words(VIEW_W / 2, 70, self.zone, 30, "white", "center")
    draw_set_alpha(1)
if question_waiting():
    # A question is waiting for you to land: it comes as soon as you're standing.
    draw_set_color("#0b1620")
    draw_set_alpha(0.6)
    draw_rect(VIEW_W / 2 - 150, VIEW_H - 64, VIEW_W / 2 + 150, VIEW_H - 40)
    draw_set_alpha(1)
    words(VIEW_W / 2, VIEW_H - 64, "Question coming: land somewhere safe!", 15, "#ffd84a", "center")
if global_vars.wind != 0 and abs(global_vars.wind) > 0.2:
    words(VIEW_W / 2, VIEW_H - 34, "wind  " + ("→" if global_vars.wind > 0 else "←"), 16, "#e8f6ff", "center")
if game_paused():
    draw_set_alpha(0.55)
    draw_set_color("#0b1620")
    draw_rect(0, 0, VIEW_W, VIEW_H)
    draw_set_alpha(1)
    words(VIEW_W / 2, VIEW_H / 2 - 30, "Paused", 36, "white", "center")
    words(VIEW_W / 2, VIEW_H / 2 + 16, "P to carry on", 16, "#cfe8ff", "center")
