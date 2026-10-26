# object: Title
# The title screen: New game, or Continue from the last level reached.

# === create
self.t = 0
self.choice = 0
self.saved = save_get("level", None)
self.options = ["New game"] + (["Continue"] if self.saved is not None else [])
self.choice = len(self.options) - 1
self.started = False
music_play("music_forest")

# === step
self.t += 1
if self.started:
    return
if keyboard_check_pressed("up") or keyboard_check_pressed("down") or gamepad_check_pressed("up") or gamepad_check_pressed("down"):
    self.choice = (self.choice + 1) % len(self.options)
    sound_play("jump", volume=0.3)
if confirm_pressed():
    self.started = True
    new_game()
    if self.options[self.choice] == "Continue":
        global_vars.level = min(int(self.saved), len(LEVELS) - 1)
        global_vars.max_hp = save_get("max_hp", 5)
        global_vars.coins = save_get("coins", 0)
        global_vars.abilities = set(save_get("abilities", []))
    sound_play("power")
    screen_fade(1, 30)
    self.alarm[0] = 34

# === alarm 0
room_goto(LEVELS[global_vars.level][0])

# === draw_gui
draw_sprite("bg_sky", 0, 0, 0)
for name, width, speed, drop in (("bg_ridge", 96, 0.04, 30), ("bg_pines_far", 416, 0.1, 44), ("bg_pines_near", 416, 0.25, 90)):
    x = -((self.t * speed) % width)
    while x < 480:
        draw_sprite(name, 0, x, drop)
        x += width
draw_sprite("hero_idle", int(self.t / 8) % 4, 240, 236)
draw_words_centered(240, 44, "THORNWOOD", size=2, gold=True)
draw_words_centered(240, 70, "a sword, a forest, and what lives in it")
for i, label in enumerate(self.options):
    on = i == self.choice
    draw_words_centered(240, 112 + i * 16, ("> " + label + " <") if on else label, gold=on)
draw_words(6, 258, "Art: Legacy Fantasy by Anokolisa  ·  Made in GameIDE")
