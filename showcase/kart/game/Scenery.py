# object: Scenery
# What stands beside the road, drawn on the floor at the size floor_point says.

# === draw
at = floor_point(self.x, self.y)
if not at or at[2] < FAR or at[2] > NEAR:
    return
self.depth = FOCAL / at[2]        # further away is drawn first, from the next frame on
k = at[2] * self.image_xscale
if -130 * k < at[0] < VIEW_W + 130 * k:
    draw_sprite_ext(self.sprite, self.image_index, at[0], at[1], k, k * self.look_low)
