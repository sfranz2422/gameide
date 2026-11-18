# object: Title
# depth: 1000
# The front of the game: the kingdom's name, and the way in.

# === create
global_vars.focus = None
weather(None)
self.play = make_button(VIEW_W / 2 - 120, 440, 240, 56, "Play", "play", None, 26)
self.play.hot = True

# === step
question_ok(True)
track_mouse()
run_buttons(self.play)

# === draw
draw_sprite("title", 0, 0, 0)

# === draw_gui
# The name and the line under it, with room between: Lilita One stands taller than
# Ubuntu did, and at the same places the name ran over the line (2026-11-18).
draw_set_alpha(0.45)
draw_set_color("#000000")
draw_rect(0, 14, VIEW_W, 222)
draw_set_alpha(1)
text(VIEW_W / 2, 22, "Highmoor", "#f4ead2", 72, "center")
# The teacher's words (2026-11-18), on two lines.
text(VIEW_W / 2, 146, "Step onto the battlefield like never before.", "#f4ead2", 19, "center")
text(VIEW_W / 2, 178, "Experience the iconic world of village building and clan warfare reimagined.", "#f4ead2", 17, "center")
r = save_get("realm", None)
if r:
    keep = next(b["level"] for b in r["buildings"] if b["kind"] == "keep")
    text(VIEW_W / 2, 510, f"Renown {r['level']}  ·  Keep level {keep}  ·  {big_number(r['gold'])} gold  ·  {big_number(r['food'])} food", "#f4ead2", 16, "center")
text(VIEW_W / 2, 542, "Drag to look around. Keys: arrows, Space, B to build, Q and E to zoom, Escape.", "#f4ead2", 14, "center")
