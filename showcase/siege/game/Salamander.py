# object: Salamander
# parent: Unit
# A fire salamander: small and hot, and triple damage to snow things (SNOWY:
# snowmen, walls, ice, and the snow forts themselves; strike).

# === create
super().on_create()
setup_unit(self, "Salamander")

# === draw
draw_troop(self, "salamander")
super().on_draw()
