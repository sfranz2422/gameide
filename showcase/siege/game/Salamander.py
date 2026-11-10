# object: Salamander
# parent: Unit
# A fire salamander: small and hot, and triple damage to snow things (SNOWY:
# snowmen, walls, ice, and the snow forts themselves; strike).
# (Drawn from another troop's picture until the teacher's own come.)

# === create
super().on_create()
setup_unit(self, "Salamander")

# === draw
draw_troop(self, "fox", 0.85, "#ff6a2a")
super().on_draw()
