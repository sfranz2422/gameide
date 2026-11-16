# object: Title
# depth: 1000
# The front of the game: a sandwich turning on the sunburst, and the way in.

# === create
global_vars.focus = None
global_vars.drag = None
self.t = 0
self.play = make_button(VIEW_W / 2 - 130, 430, 260, 58, "Make a Sandwich", "play", None, 24)
self.play.hot = True
self.book = make_button(VIEW_W / 2 - 100, 500, 200, 40, "Recipe Book", "book", None, 18)
# The sandwich on the front: built by the same rules as any other.
self.demo = new_sandwich("white")
for k, dx in (("lettuce", -4), ("tomato", 3), ("cheddar", -2), ("ham", 4), ("bacon", -3), ("top", 0)):
    self.demo["layers"].append({"k": k, "dx": dx})
self.demo["topped"] = True

# === step
question_ok(False)      # questions only in the recipe book (the teacher's choice)
self.t += 1
run_controls(self.play)

# === draw
sunburst(VIEW_W / 2, 250, self.t)
big_plate(VIEW_W / 2, 372, 330)
bob = math.sin(self.t * 0.05) * 6
draw_sandwich(self.demo, VIEW_W / 2, 366 + bob * 0.2, 1.05, math.sin(self.t * 0.04) * 0.02)

# === draw_gui
text(VIEW_W / 2, 26, "Stack Shack", "#fff6d8", 78, "center")
text(VIEW_W / 2, 118, "Pile it high. Don't let it fall. Eat the whole thing.", CREAM, 20, "center")
found, made = found_count(), save_get("made", 0)
if made:
    text(VIEW_W / 2, 552, f"Recipes found: {found} of {len(RECIPES)}   ·   Tallest eaten: {best()} layers", CREAM, 15, "center")
else:
    text(VIEW_W / 2, 552, "Click or tap, or drag. Or arrows and Space; Tab moves on too.", CREAM, 14, "center")
