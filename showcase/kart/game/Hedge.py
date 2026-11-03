# object: Hedge
# sprite: bush
# parent: Scenery
# The edge of the track. Karts stop against its box (move_and_collide in Kart's
# Step), which lies along the road: it's turned with image_angle as it's placed.

# === create
self.image_speed = 0
self.image_xscale = self.image_yscale = HEDGE_LONG / BUSH_W
self.look_low = HEDGE_LOW
