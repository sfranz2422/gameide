# object: ComputerKart
# parent: Kart
# A kart that drives itself, as well as its racer's skill says.

# === create
super().on_create()
self.stuck = 0          # steps on the gas without getting anywhere
self.backing = 0        # steps left backing out of a hedge
self.back_steer = 0

# === begin_step
gas, steer = computer_keys(self, 0.55 if self.done is not None else RACERS[self.who]["skill"])
self.gas, self.brake, self.steer = computer_unstuck(self, gas, steer)
self.use = False
if self.item:
    self.item_wait -= 1
    if self.item_wait <= 0 and self.done is None:
        self.use = True
