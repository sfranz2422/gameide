# object: Trio
# sprite: trio
# parent: Shot
# Click while it flies and it's three smaller shots, fanned out.

# === create
super().on_create()
self.weight = 2

# === mouse global pressed left
if self.flying and not self.touched:
    sound_play("split", volume=0.7)
    for turn in (-11, 0, 11):
        bit = instance_create(self.x, self.y, "Bit")
        way = math.radians(turn)
        launch(bit, self.hspeed * math.cos(way) + self.vspeed * math.sin(way), self.vspeed * math.cos(way) - self.hspeed * math.sin(way))
    self.destroy()
