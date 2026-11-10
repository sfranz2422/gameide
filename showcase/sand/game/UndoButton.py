# object: UndoButton
# sprite: button
# parent: Button
# Takes back the last pour. As many as you like: the pours still count.

# === create
super().on_create()
self.words = "Undo (Z)"

# === step
self.off = not global_vars.director.history

# === mouse pressed left
undo(global_vars.director)
