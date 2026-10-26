# object: Ending

# === create
self.t = 0
music_play("music_forest")
screen_fade(0, 40)

# === step
self.t += 1
if self.t > 90 and confirm_pressed():
    room_goto("Title")

# === draw_gui
draw_sprite("bg_sky", 0, 0, 0)
draw_sprite("bg_pines_near", 0, 0, 84)
draw_sprite("bg_pines_near", 0, 352, 84)
draw_words_centered(240, 50, "The forest is quiet.", size=2, gold=True)
lines = [f"Coins found: {global_vars.coins}", f"Enemies beaten: {global_vars.kills}",
         f"Falls: {global_vars.deaths}", f"Time: {global_vars.frames // 3600}:{global_vars.frames // 60 % 60:02d}",
         "", "More of the Thornwood is coming.", "Press Enter for the title."]
for i, line in enumerate(lines):
    draw_words_centered(240, 96 + i * 14, line)
