# object: TubeButton
# sprite: button
# parent: Button
# One extra empty tube, once a level. It costs the third star.

# === create
super().on_create()
self.words = "+ Tube (X)"

# === step
self.off = global_vars.director.extra or global_vars.director.won

# === mouse pressed left
add_tube(global_vars.director)
