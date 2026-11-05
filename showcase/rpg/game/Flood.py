# object: Flood
# sprite: flood
# depth: 400
# The water over the causeway. Solid until all three sluices are open, and gone for good after.

# === create
self.solid = True
if flag("drained"):
    self.destroy()
