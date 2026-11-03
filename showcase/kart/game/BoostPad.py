# object: BoostPad
# sprite: pad
# visible: no
# A patch of road the build paints chevrons on, at this object's place. Drive
# over it and you're off.

# === create
self.image_speed = 0
self.image_xscale = self.image_yscale = 1

# === collision Kart
if other.boost < 40 and other.spin <= 0:
    other.boost = 40
    kart_sound(other, "boost")
