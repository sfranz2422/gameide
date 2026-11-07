# object: Director
# depth: -90
# Runs the level: money, lives, waves, placing towers, and how it ends. There's
# one in each level's room.

# === create
self.level = next(i for i, l in enumerate(LEVELS) if l["name"] == room_name())
level = LEVELS[self.level]
global_vars.director = self
global_vars.gold = level["gold"]
global_vars.lives = level["lives"]
global_vars.wave = 0
global_vars.mode = "playing"
global_vars.buying = None
global_vars.selected = None
road = [cell_middle(c, r) for c, r in level["path"]]
global_vars.road_route = road[1:]
global_vars.air_route = [road[-1]]
self.stars = 0
self.was_busy = False

# === step
# A Python check question (in a showcase game) waits for a fair moment: between waves,
# never while one's on its way.
question_ok(global_vars.mode != "playing" or not wave_busy())
level = LEVELS[self.level]
if global_vars.selected is not None and not global_vars.selected._alive:
    global_vars.selected = None
if keyboard_check_pressed("escape"):
    global_vars.buying = global_vars.selected = None
if global_vars.mode != "playing":
    return
busy = wave_busy()
if global_vars.lives <= 0:
    finish_level(self, False)
elif global_vars.wave >= len(level["waves"]) and not busy:
    finish_level(self, True)
elif self.was_busy and not busy:
    global_vars.gold += WAVE_BONUS
    sound_play("coin", volume=0.5)
self.was_busy = busy

# === mouse global pressed left
if global_vars.mode != "playing":
    return
if global_vars.buying is not None:
    if mouse_y < FIELD_H:
        if build(global_vars.buying, mouse_x, mouse_y) is None:
            sound_play("nope", volume=0.5)
        global_vars.buying = None
elif mouse_y < FIELD_H and not collision_point(mouse_x, mouse_y, "Tower"):
    global_vars.selected = None

# === draw
if global_vars.mode != "playing":
    # Under the end panel's buttons; its words are in Draw GUI, over them.
    draw_set_alpha(0.8)
    draw_set_color(SHADOW)
    draw_rect(232, 150, VIEW_W - 232, 410)
    draw_set_alpha(1)
# The tower you're about to place: where it would go and how far it would reach.
if global_vars.buying is not None and mouse_y < FIELD_H:
    c, r = int(mouse_x // CELL), int(mouse_y // CELL)
    mx, my = cell_middle(c, r)
    ok = can_build(mouse_x, mouse_y)
    draw_set_alpha(0.3)
    draw_set_color(MINT if ok else RED)
    draw_rect(c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL)
    draw_set_alpha(0.1)
    draw_set_color("white")
    draw_circle(mx, my, BUILD_RANGE[global_vars.buying])
    draw_set_alpha(1)

# === draw_gui
level = LEVELS[self.level]
draw_set_alpha(0.65)
draw_set_color(SHADOW)
draw_rect(8, 8, 330, 44)
draw_set_alpha(1)
text(18, 15, f"Gold {int(global_vars.gold)}", GOLD, 18)
text(130, 15, f"Lives {global_vars.lives}", RED if global_vars.lives <= 3 else INK, 18)
text(240, 15, f"{min(global_vars.wave, len(level['waves']))}/{len(level['waves'])}", MINT, 18)
if global_vars.mode != "playing":
    if global_vars.mode == "won":
        text(VIEW_W / 2, 176, "The fort holds!", GOLD, 40, "center")
        text(VIEW_W / 2, 236, stars_text(self.stars), GOLD, 44, "center")
    else:
        text(VIEW_W / 2, 186, "The fort has fallen", RED, 36, "center")
        text(VIEW_W / 2, 246, f"You got to wave {global_vars.wave} of {len(level['waves'])}", INK, 18, "center")
if question_waiting():
    text(VIEW_W / 2, VIEW_H - 40, "Python question after this wave", GOLD, 15, "center")
