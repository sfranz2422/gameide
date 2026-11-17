# object: Thing
# A building, a tree or a rock on the map: a picture standing on its tile (or, for
# a building, the middle of its footprint), drawn in front of what's behind it:
# its depth is minus how far down the screen it stands.

# === create
self.kind = ""
self.gx = 0
self.gy = 0

# === draw
pic_x, pic_y = building_xy(self.kind, self.gx, self.gy) if self.kind in FOOTPRINT else tile_xy(self.gx, self.gy)
draw_sprite(self.kind, 0, pic_x, pic_y)
