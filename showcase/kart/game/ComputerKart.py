# object: ComputerKart
# parent: Kart
# A kart that drives itself, as well as its racer's skill says.

# === begin_step
self.gas, self.steer = computer_keys(self, 0.55 if self.done is not None else RACERS[self.who]["skill"])
