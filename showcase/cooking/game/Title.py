# object: Title
# depth: 1000
# The front of the game.

# === create
global_vars.focus = None
global_vars.k = None
if not hasattr(global_vars, "rest"):
    global_vars.rest = 0
self.play = make_button(VIEW_W / 2 - 120, 470, 240, 54, "Play", "play", None, 24)
self.play.hot = True

# === step
question_ok(True)
run_controls(self.play)

# === draw
draw_sprite("title", 0, 0, 0)
# Dark bands behind the words: the teacher's title picture is busy right up to the top.
draw_set_alpha(0.5)
draw_set_color("#1a0f08")
draw_rect(0, 22, VIEW_W, 168)
draw_rect(0, 524, VIEW_W, VIEW_H)
draw_set_alpha(1)

# === draw_gui
text(VIEW_W / 2, 36, "Order Up!", GOLD, 76, "center")
text(VIEW_W / 2, 130, "Cook it, build it, serve it, before they lose their patience.", INK, 20, "center")
p = progress()
if total_stars(p):
    text(VIEW_W / 2, 532, f"{total_stars(p)} stars · {coins_words(p['coins'])}", DIM, 15, "center")
text(VIEW_W / 2, 552, "Click or tap. Or arrows and Space; Tab moves on too.", "#fff6d8", 14, "center")
