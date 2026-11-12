# object: Lump
# A snowbank or a hedge on its tile (the tile is what's solid; this is its picture).

# === create
self.sprite = "lump_bank" if letter_at(self.x, self.y - 8) == "B" else "lump_hedge"
self.depth = -self.y
