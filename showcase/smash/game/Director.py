# object: Director
# depth: -90
# Runs the level: loads the shots one at a time, keeps score, and says when it's
# over. There's one in each level's room.

# === create
self.level = level_of_room()
level = LEVELS[self.level]
self.left = list(level["shots"])
self.used = 0
self.stars = 0
self.wait = 0
self.calm = 0
self.hint = level["hint"]
global_vars.director = self
global_vars.score = 0
global_vars.shot = None
global_vars.mode = "aim"
load_shot(self)

# === step
if keyboard_check_pressed("r"):
    room_restart()
if keyboard_check_pressed("escape"):
    room_goto("Title")
clear_strays()
if global_vars.mode in ("won", "lost"):
    return
if not instance_exists("Jar"):
    self.wait += 1
    if self.wait > 50:
        finish_level(self, True)
    return
if global_vars.mode != "flying":
    return
self.wait += 1
quiet = not instance_exists("Shot") and all(b.speed < QUIET for b in instances("Block"))
self.calm = self.calm + 1 if quiet else 0
# Blocks can rock for a long time: don't keep anyone waiting more than 8 seconds.
if self.calm > 20 or self.wait > 480:
    for s in instances("Shot"):
        s.destroy()
    if self.left:
        load_shot(self)
    else:
        finish_level(self, False)

# === draw_gui
level = LEVELS[self.level]
draw_set_alpha(0.55)
draw_set_color(SHADOW)
draw_rect(8, 8, 420, 44)
draw_set_alpha(1)
text(18, 15, level["name"], GOLD, 18)
text(250, 15, f"{global_vars.score}", INK, 18)
for k, name in enumerate(self.left):
    draw_sprite_ext(name.lower(), 0, SLING_X - 40 - k * 30, GROUND_Y - 15, 0.8, 0.8)
if self.used == 0 and global_vars.mode == "aim":
    text(VIEW_W / 2, 66, self.hint, INK, 20, "center")
if global_vars.mode in ("won", "lost"):
    draw_set_alpha(0.75)
    draw_set_color(SHADOW)
    draw_rect(262, 130, VIEW_W - 262, 390)
    draw_set_alpha(1)
    if global_vars.mode == "won":
        text(VIEW_W / 2, 150, "All free!", GOLD, 40, "center")
        for k in range(3):
            draw_sprite_ext("star", 0, VIEW_W / 2 - 60 + k * 60, 240, 0.8, 0.8, 0, "white" if k < self.stars else "#404850")
        text(VIEW_W / 2, 280, f"Score {global_vars.score}", INK, 20, "center")
    else:
        left = instance_number("Jar")
        text(VIEW_W / 2, 170, "Out of shots", RED, 40, "center")
        text(VIEW_W / 2, 240, f"{left} jelly still in a jar" if left == 1 else f"{left} jellies still in jars", INK, 20, "center")
