# object: Tower
# How every tower works: find the enemy that has got furthest, turn to it, and
# fire. Its children only say how: their own Create events set the numbers, the
# picture and what they fire. To make a new tower, add a child with its numbers,
# and give it a price in the rules script.

# === create
self.cost = PRICES.get(self.object_name, 0)
self.spent = self.cost
self.level = 1
self.range, self.reload, self.damage = 150, 30, 5
self.shot = "Pellet"
self.air = True           # can it hit what flies?
self.top = "top_gun"      # the turret's picture
self.aim = 90
self.cool = 0
self.look = 0
self.target = None
self.depth = -5

# === step
self.look -= 1
if self.look <= 0:
    # Not every step: a field of towers each checking every enemy, every step, adds up.
    self.look = 6
    self.target = best_target(self)
if self.target is not None and not self.target._alive:
    self.target = None
if self.cool > 0:
    self.cool -= 1
if self.target is not None:
    self.aim = point_direction(self.x, self.y, self.target.x, self.target.y)
    if self.cool <= 0:
        self.cool = self.reload
        shot = instance_create(self.x, self.y, self.shot)
        aim_shot(shot, self.target, self.damage)
        sound_play("shot", volume=0.2)

# === mouse pressed left
if global_vars.buying is None:
    global_vars.selected = self
    sound_play("click", volume=0.5)

# === draw
draw_self()
draw_sprite_ext(self.top, 0, self.x, self.y, 1, 1, self.aim - 90)
for k in range(self.level - 1):
    draw_set_color(GOLD)
    draw_circle(self.x - 8 + k * 16, self.y + 24, 4)
if global_vars.selected is self:
    draw_set_alpha(0.14)
    draw_set_color("white")
    draw_circle(self.x, self.y, self.range)
    draw_set_alpha(0.7)
    draw_circle(self.x, self.y, self.range, True)
    draw_set_alpha(1)
