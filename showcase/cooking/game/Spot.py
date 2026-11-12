# object: Spot
# Something in the kitchen you can tap: the parent of Cooker, Source, Plate, Shelf,
# Bin and Customer. It holds the box a tap must land in (x, y, wide, high) and
# hands a click to tap() in the acts script, which hands it to the kitchen's rules.

# === create
self.wide = 80
self.high = 80
self.shown = True
self.off = False
# The day it was made for: drawn from that, never global_vars.k, which a new day replaces
# a step before the room changes (the old spots would draw the new day's cookers).
self.kday = global_vars.k

# === step
# A press here is the Kitchen's to handle (pointer() in the acts script): it waits to
# see whether the press is a tap or the start of a drag, and where a drag is let go.
pass
