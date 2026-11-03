# object: Crate
# sprite: crate
# parent: Block
# Goes bang when it breaks, and that can break another crate.

# === create
super().on_create()
made_of(self, 0.8, 2, "#ffcc00", 75, "crack_wood")

# === destroy
super().on_destroy()
blast(self.x, self.y, 130, 13)
