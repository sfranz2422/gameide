# object: Prop
# A snowman, a sled, a bench… (prop_spots in the map script): solid at its feet only.

# === create
self.sprite = "prop_" + (prop_at(self.x, self.y - 8) or PROP_KINDS[0])
self.depth = -self.y
