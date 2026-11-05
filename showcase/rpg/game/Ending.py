# object: Ending
# depth: -100
# The valley with all its lights back. The first time here, the finish time goes on the board.

# === create
screen_fade(0, 50)
music_play("theme")
self.age = 0
if not flag("won"):
    set_flag("won")
    high_score(finish_seconds())
    save_game()
self.time = clock_words(finish_seconds())

# === step
self.age += 1
if self.age > 120 and confirm_pressed():
    room_goto("Title")

# === draw
draw_sprite("ending", 0, 0, 0)

# === draw_gui
draw_set_halign("center")
draw_set_font(None, 26)
draw_set_color("#ffd166")
draw_text(320, 26, "The lanterns of Hollowmere burn again.")
draw_set_font(None, 16)
draw_set_color("#ffffff")
if self.age > 60:
    draw_text(320, 66, f"Your journey took {self.time}.")
if self.age > 120:
    draw_text(320, 334, "Thank you for playing. Press Z.")
draw_set_halign("left")
