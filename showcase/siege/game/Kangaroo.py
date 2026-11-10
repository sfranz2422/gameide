# object: Kangaroo
# parent: Unit
# A kangaroo: on foot, but it hops straight over the frozen creek anywhere, not just
# on a bridge (self.hops: Unit walks it straight at its target).
# (Drawn from another troop's picture until the teacher's own come.)

# === create
super().on_create()
setup_unit(self, "Kangaroo")
self.hops = True

# === draw
# A hop every 24 steps while it moves.
draw_troop(self, "fox", 1.35, "#e0a86a", abs(math.sin(getattr(self, "anim", 0) * math.pi / 24)) * 8 if getattr(self, "still", 0) < 8 else 0)
super().on_draw()
