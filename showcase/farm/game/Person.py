# object: Person
# A townsperson: out walking along the roads, tile to tile, or (with `visitor` set)
# waiting at the farm stand with what they want over their head. Which one they look
# like is `who` (an index into PEOPLE); a visitor's is the visitor's own.

# === create
self.who = 0
self.visitor = None     # a place in the farm's visitors, or None: out walking
self.at = (6, 6)        # walking: the tile it's leaving…
self.to = (6, 7)        # …and the one it's walking to
self.came = None        # the one before, so it doesn't turn straight back
self.k = 0              # steps of the game along the way (WALK_STEPS a tile)
self.wx = 0
self.wy = 0

# === step
if self.visitor is None:
    walk_step(self, farm())
    self.depth = -self.wy
else:
    x, y = tile_xy(*VISITOR_SPOTS[self.visitor % len(VISITOR_SPOTS)])
    self.wx, self.wy = x, y
    self.depth = -y

# === draw
if self.visitor is None:
    dx, dy = self.to[0] - self.at[0], self.to[1] - self.at[1]
    # Walking down the screen (more gx or gy) shows the front; up it, the back. The
    # pictures face left: walking right (+gx going down, -gy going up), they're turned.
    pose = "front" if dx + dy > 0 else "back"
    turned = dx > 0 or dy < 0
    frame = (global_vars.t // 12) % 2
    draw_sprite_ext(f"person_{PEOPLE[self.who]}_{pose}", frame, self.wx, self.wy, -1 if turned else 1, 1, 0, "white", 1)
else:
    v = farm()["visitors"][self.visitor] if self.visitor < len(farm()["visitors"]) else {}
    if "want" in v:
        # Facing the stand, up and to the left of them; what they want over their head.
        draw_sprite(f"person_{PEOPLE[v['who']]}_back", 0, self.wx, self.wy)
        (item, n), = v["want"].items()
        by = self.wy - 66 + math.sin(global_vars.t * 0.08 + self.visitor) * 3
        diamond(self.wx, by, "#fff4dc", 0.95, 0.42)
        icon(item, self.wx, by, 28)
