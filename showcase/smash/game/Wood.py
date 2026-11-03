# object: Wood
# parent: Block
# Takes a few knocks, and light enough to send flying.

# === create
super().on_create()
made_of(self, 1, 8, "#b07a3f", 50, "crack_wood")
