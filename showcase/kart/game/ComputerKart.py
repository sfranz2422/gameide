# object: ComputerKart
# parent: Kart
# A kart that drives itself, as well as its racer's skill says.

# === begin_step
self.gas, self.steer = computer_keys(self, 0.55 if self.done is not None else RACERS[self.who]["skill"])
self.use = False
if self.item:
    self.item_wait -= 1
    if self.item_wait <= 0 and self.done is None:
        self.use = True
