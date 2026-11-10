# object: Kangaroo
# parent: Unit
# A kangaroo: on foot, but it hops straight over the frozen creek anywhere, not just
# on a bridge (self.hops: Unit walks it straight at its target).

# === create
super().on_create()
setup_unit(self, "Kangaroo")
self.hops = True

# === draw
draw_troop(self, "kangaroo")
super().on_draw()
