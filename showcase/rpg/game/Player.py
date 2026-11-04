# object: Player
# sprite: wren_down
# The party on the map, led by Wren. Arrow keys walk, Z or Space talks, X opens the bag.

# === create
self.walk = 2.4
self.settling = 3
self.facing = "down"
self.safe = S.pop("safe", 0)      # just out of a fight: nobody can start another for a moment
if S.get("at"):
    self.x, self.y = S["at"]
    S["at"] = None
self.depth = -self.y
camera_follow(self, 0.15)

# === step
self.depth = -self.y
if self.safe > 0:
    self.safe -= 1
    self.image_alpha = 0.5 if self.safe // 6 % 2 else 1
# A moment's wait after anything closes: the key that closed it is still down, and
# would talk to the same person again, or open the menu as a scene is skipped with Esc.
if busy():
    self.image_speed = 0
    self.settling = 3
    return
if self.settling > 0:
    self.settling -= 1
    return
dx = keyboard_check("right") - keyboard_check("left")
dy = keyboard_check("down") - keyboard_check("up")
if dx and dy:
    dx, dy = dx * 0.71, dy * 0.71
if dx or dy:
    move_and_collide(dx * self.walk, dy * self.walk)
    self.facing = "left" if dx < 0 else "right" if dx > 0 else "up" if dy < 0 else "down"
    self.sprite = "wren_" + ("side" if self.facing in ("left", "right") else self.facing)
    self.image_xscale = -1 if self.facing == "left" else 1
    self.image_speed = 1
else:
    self.image_speed = 0
    self.image_index = 0
near = instance_nearest(self.x, self.y, "Usable")
self.near = near if near and point_distance(self.x, self.y, near.x, near.y) < near.reach else None
if self.near and (confirm_pressed() or mouse_check_pressed("left")):
    self.near.use()
elif back_pressed():
    pause_menu()

# === collision MapFoe
if self.safe <= 0 and not busy():
    other.touched(self)
