# object: SledRider
# parent: Unit
# Two kids on a sled: fast, and the first hit after a run-up (CHARGE_RUN) does double.
# (Drawn from another troop's picture until the teacher's own come.)

# === create
super().on_create()
setup_unit(self, "SledRider")

# === draw
draw_sprite_ext("sled", 0, self.x, self.y + 6, (self.face or forward(self.side)) * 0.8, 0.8)
draw_troop(self, "kid")
super().on_draw()
