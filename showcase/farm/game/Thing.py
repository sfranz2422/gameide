# object: Thing
# A building, a tree or a rock on the map: a picture standing on its tile (or, for
# a building, the middle of its footprint), drawn in front of what's behind it:
# its depth is minus how far down the screen it stands.

# === create
self.kind = ""
self.gx = 0
self.gy = 0
self.of = None          # something built: ("homes", 0) and so on; where it is is the farm's

# === step
if self.of is not None:
    # Read from the farm each step, so a moved building moves (and stands at its new depth).
    b = farm()[self.of[0]][self.of[1]]
    self.gx, self.gy = b["gx"], b["gy"]
self.depth = -(building_xy(self.kind, self.gx, self.gy)[1] if self.kind in FOOTPRINT else tile_xy(self.gx, self.gy)[1])

# === draw
pic_x, pic_y = building_xy(self.kind, self.gx, self.gy) if self.kind in FOOTPRINT else tile_xy(self.gx, self.gy)
held = global_vars.moving is not None and tuple(global_vars.moving) == self.of
draw_sprite_ext(self.kind, 0, pic_x, pic_y, 1, 1, 0, "white", 0.35 if held else 1)
# An animal home: its animals in the yard, and what's ready over it. A factory: what's
# finished over it, or a little clock while it's making something.
f = farm()
if self.kind in HOMES:
    home = home_of(f, self.gx, self.gy)
    if home is not None:
        info = HOMES[self.kind]
        ready_ = False
        for i in range(ANIMALS_EACH):
            st = animal_state(home, i)
            ready_ = ready_ or st == "ready"
            wander = math.sin(global_vars.t * 0.02 + i * 2.1) * 10 if st == "hungry" else 0
            ax = pic_x - 40 + i * 34 + wander
            ay = pic_y + 6 + (i % 2) * 14
            pose = {"hungry": "walk" if (global_vars.t // 20 + i) % 2 else "stand", "eating": "eat", "ready": "ready"}[st]
            draw_sprite_ext(f"animal_{info['animal']}_{pose}", 0, ax, ay, -1 if wander < 0 else 1, 1, 0, "white", 1)
        if ready_:
            bubble_y = pic_y - 110 + math.sin(global_vars.t * 0.08) * 4
            diamond(pic_x, bubble_y, "#fff4dc", 0.95, 0.5)
            icon(info["makes"], pic_x, bubble_y, 34)
elif self.kind in HOUSES and self.of is not None:
    i = self.of[1]
    bubble_y = pic_y - 120 + math.sin(global_vars.t * 0.08) * 4
    if rent_ready(f, i):
        diamond(pic_x, bubble_y, "#fff4dc", 0.95, 0.5)
        icon("rent", pic_x, bubble_y, 34)
    elif i not in lived_in(f):
        # Empty: no room in town for its people yet.
        icon("people", pic_x, bubble_y, 30, 0.45 + 0.25 * math.sin(global_vars.t * 0.06))
elif self.kind in FACTORIES:
    mill = mill_of(f, self.gx, self.gy)
    if mill is not None and mill["queue"]:
        bubble_y = pic_y - 110 + math.sin(global_vars.t * 0.08) * 4
        if mill_done(mill):
            diamond(pic_x, bubble_y, "#fff4dc", 0.95, 0.5)
            icon(mill["queue"][0]["item"], pic_x, bubble_y, 34)
        elif global_vars.t % 40 < 30:
            icon("clock", pic_x, bubble_y, 26, 0.9)
