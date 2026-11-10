# object: ShapesButton
# sprite: button
# parent: Button
# Puts a shape on every colour of sand, for anyone who finds two colours hard to
# tell apart. Kept in the save, so it stays on.

# === create
super().on_create()

# === step
self.words = "Shapes: on" if global_vars.shapes else "Shapes: off"

# === mouse pressed left
global_vars.shapes = not global_vars.shapes
save_set("shapes", global_vars.shapes)
sound_play("click", volume=0.5)
