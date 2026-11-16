# object: Title
# depth: 1000
# The front of the game: everything found so far circling the name.

# === create
global_vars.focus = None
global_vars.drag = None
self.t = 0
self.play = make_button(VIEW_W / 2 - 120, 400, 240, 56, "Play", "play", None, 26)
self.play.hot = True
make_button(VIEW_W / 2 - 90, 468, 180, 40, "Awards", "awards", None, 17)

# === step
question_ok(True)
self.t += 1
run_controls(self.play)

# === draw
draw_sprite("bench", 0, 0, 0)
draw_set_alpha(0.55)
draw_set_color("#1a1030")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)
p = progress()
shown = p["found"][-24:]
for i, k in enumerate(shown):
    a = self.t * 0.004 + i * 2 * math.pi / len(shown)
    r = 300 if i % 2 else 230
    icon(k, VIEW_W / 2 + math.cos(a) * r * 1.3, 230 + math.sin(a) * r * 0.62, 0.9, 0.9)

# === draw_gui
text(VIEW_W / 2, 120, "Mix Lab", GOLD, 84, "center")
text(VIEW_W / 2, 222, "Mix two things and see what they make. Can you build a whole world?", INK, 19, "center")
p = progress()
text(VIEW_W / 2, 260, f"Found {len(p['found'])} of {len(THINGS)}   ·   {len(p['awards'])} of {len(ACHIEVEMENTS)} awards", DIM, 16, "center")
text(VIEW_W / 2, 548, "Drag, or tap two things. Or arrows and Space; Tab moves on too.", DIM, 14, "center")
