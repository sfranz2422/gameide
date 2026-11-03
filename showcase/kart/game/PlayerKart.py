# object: PlayerKart
# parent: Kart
# The kart the keyboard drives. Past the finish line, it drives itself.

# === begin_step
if self.done is not None:
    self.gas, self.steer = computer_keys(self, 0.55)
    self.brake = self.drifting = False
    return
self.gas = keyboard_check("up") or keyboard_check("x") or gamepad_check("a") or gamepad_check("rt")
self.brake = keyboard_check("down") or gamepad_check("b") or gamepad_check("lt")
self.steer = (keyboard_check("right") or gamepad_check("right")) - (keyboard_check("left") or gamepad_check("left"))
self.drifting = bool(keyboard_check("z") or keyboard_check("shift") or gamepad_check("rb"))
