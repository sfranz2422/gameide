# object: SledRider
# parent: Unit
# Two kids on a sled: fast, and the first hit after a run-up (CHARGE_RUN) does double.

# === create
super().on_create()
setup_unit(self, "SledRider")

# === draw
draw_troop(self, "sled")
super().on_draw()
