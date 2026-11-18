# object: Car
# One car of the train: the engine (k 0) or a wagon behind it (k 1, 2, …), on the
# railway where `train_engine` says the engine is. A car each, not one train, so each
# stands at its own depth, in front of the station it stops along and behind what's
# further down the valley.

# === create
self.k = 0
self.wx = 0
self.wy = 0
self.shown = False
self.fade = 1.0

# === step
e = train_engine(farm())
self.shown = e is not None
if self.shown:
    gx = e - self.k
    self.wx, self.wy = tile_xy(gx, RAIL_GY)
    self.depth = -self.wy
    # Past the end of the railway, off the edge of the valley, it fades away.
    self.fade = clamp(MAP_W - 0.5 - gx + 1, 0, 1)

# === draw
if self.shown and self.fade > 0:
    f = farm()
    if self.k == 0:
        draw_sprite_ext("train_engine", 0, self.wx, self.wy, 1, 1, 0, "white", self.fade)
    else:
        # Loaded wagons show their crates; leaving, they're all full.
        wagons = f["train"]["wagons"]
        full = not train_here(f) or (self.k - 1 < len(wagons) and wagons[self.k - 1]["loaded"])
        draw_sprite_ext("train_wagon", 1 if full else 0, self.wx, self.wy, 1, 1, 0, "white", self.fade)
