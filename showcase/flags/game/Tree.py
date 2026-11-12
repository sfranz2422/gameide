# object: Tree
# A pine on a pine tile (the tile is what's solid; this is its picture), drawn in
# front of anyone behind it and behind anyone in front. Which of three sizes is
# picked from where it stands, so the woods look the same every match.

# === create
self.sprite = PINES[(int(self.x // TILE) * 7 + int(self.y // TILE) * 13) % len(PINES)]
self.depth = -self.y
