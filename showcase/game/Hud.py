# object: Hud
# depth: -1000
# Life, coins, the key and the boss's health, drawn on the screen (Draw
# GUI: the camera never moves it). Also starts each level's music.

# === create
screen_fade(0, 30)
level = LEVELS[global_vars.level]
if global_vars.boss is None or not instance_exists(global_vars.boss):
    global_vars.boss = None
    music_play(level[2])
self.banner = 200 if global_vars.checkpoint is None else 0   # the level's name, as it starts

# === step
if global_vars.message_time > 0:
    global_vars.message_time -= 1
if self.banner > 0:
    self.banner -= 1

# === draw_gui
# Life: one pip each, full or empty
for i in range(global_vars.max_hp):
    draw_sprite("hud_pip_full" if i < global_vars.hp else "hud_pip_empty", 0, 10 + i * 13, 10)
# Coins, and what's been found
draw_sprite("coin", 0, 14, 38)
draw_words(24, 29, f"× {global_vars.coins}")
x = 60
if global_vars.keys > 0:
    draw_sprite("key", 0, x + 4, 36)
    x += 20
if "double_jump" in global_vars.abilities:
    draw_sprite("relic", 0, x + 4, 38)

# The boss's health, along the bottom
b = global_vars.boss
if b is not None and instance_exists(b) and b.hp > 0:
    w = 240
    x0, y0 = (480 - w) // 2, 246
    draw_set_color("#1b1410")
    draw_rect(x0 - 2, y0 - 2, x0 + w + 2, y0 + 8)
    draw_set_color("#5a1a1a")
    draw_rect(x0, y0, x0 + w, y0 + 6)
    draw_set_color("#e04848")
    draw_rect(x0, y0, x0 + w * b.hp / b.max_hp, y0 + 6)
    draw_words(x0, y0 - 13, b.name)

# A message, along the bottom
if global_vars.message_time > 0 and global_vars.message:
    draw_set_alpha(min(1, global_vars.message_time / 30))
    draw_set_color("#000000")
    draw_set_alpha(min(0.55, global_vars.message_time / 30))
    draw_rect(0, 220, 480, 238)
    draw_set_alpha(min(1, global_vars.message_time / 30))
    draw_words_centered(240, 224, global_vars.message)
    draw_set_alpha(1)

# The level's name as it starts
if self.banner > 0:
    draw_set_alpha(min(1, self.banner / 40))
    draw_words_centered(240, 74, LEVELS[global_vars.level][1], size=2)
    if global_vars.level == 0:
        draw_words_centered(240, 102, "← → run  ·  Space jumps  ·  X swings the sword")
        draw_words_centered(240, 114, "Down on a plank drops through it")
    draw_set_alpha(1)
