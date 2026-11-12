# object: Kid
# A kid on the field, either team: the player's (Player), the computer's (Bot), and
# in a room another player's (Remote) are all Kids. A child says which way it wants
# to walk (mx, my) and whether it's scooping, then runs this. Walking, being knocked
# down and getting up, scooping, footprints and the pictures are all here, so a bot
# can do nothing a player can't.
#
# A PUPPET is a kid in a room game that isn't in charge: the host's game runs it,
# and this one only shows it where the host (or, for another player, their own
# game) says it is. A puppet decides nothing: every step that simulates returns.

# === create
self.team = "red"
self.look = 0
self.k = 0                 # its place in its team: where it comes back after a hit
self.tag = ""              # who it is in a room's match: "p3" (player #3), "br1" (Red's computer kid 1), "you"
self.stock = STOCK_START
self.stun = 0              # steps left knocked down
self.safe = 0              # steps left just back at the fort, when it can't be hit
self.carry = None          # the other team's Flag, while carrying it
self.throw_t = 0
self.scoop_t = 0
self.scooping = False
self.mx = self.my = 0      # which way it wants to walk, -1 to 1
self.vx = self.vy = 0      # how far it really moved this step (others aim ahead by it)
self.facing = 1            # which way it faces across: 1 right, -1 left (a throw with no aim goes that way)
self.dir = "down"          # which way its picture looks: "down" (towards you), "up" or "side"
self.xs = 1                # its picture's flip, as drawn (a side picture faces right; a walk toward you alternates)
self.walk_t = 0
self.pose_t = 0            # steps left showing a throw
self.cheer_t = 0           # steps left cheering (after a capture)
self.print_t = 0
self.image_speed = 0
self.life = 0              # one more each time it's put at its fort (the room uses it: see Remote)
self.downs = 0             # times knocked down (the others' games show a fall when it goes up)
self.away = False          # a room player answering a question: off the field
self.puppet = False
self.catch_up = 1          # how many times its pace it may walk in one step (the host's copy of a player: more)
# A puppet's word from the host: where it is, which way it's going, and since when.
self.word = None
self.since = 0

# === step
self.depth = -self.y
if self.puppet:
    puppet_step(self)
    return
x0, y0 = self.x, self.y
if self.safe > 0:
    self.safe -= 1
if self.throw_t > 0:
    self.throw_t -= 1
if self.pose_t > 0:
    self.pose_t -= 1
if self.cheer_t > 0:
    self.cheer_t -= 1
if self.stun > 0:
    self.stun -= 1
    pick_pose(self, False)
    if self.stun == 0:
        back_to_fort(self)
    self.vx = self.vy = 0
    return
if global_vars.m["over"] is not None:
    pick_pose(self, False)
    return
if self.away:
    self.vx = self.vy = 0
    return

# Walking: across, then up and down, so against a bank you slide along it.
dx, dy = self.mx, self.my
size = math.hypot(dx, dy)
if size > self.catch_up:
    dx, dy = dx / size * self.catch_up, dy / size * self.catch_up
pace = CARRY_PACE if self.carry is not None else PACE
self.move_and_collide(dx * pace, 0)
self.move_and_collide(0, dy * pace)
self.vx, self.vy = self.x - x0, self.y - y0
moving = abs(self.vx) + abs(self.vy) > 0.3
if abs(dx) > 0.2:
    self.facing = 1 if dx > 0 else -1
if moving:
    # Which way the picture looks: across if walking mostly across, else towards you or away.
    if abs(self.vx) >= abs(self.vy) * 0.8:
        self.dir = "side"
    else:
        self.dir = "down" if self.vy > 0 else "up"

# Scooping at a drift: one more snowball every SCOOP_STEPS of standing at it.
self.scoop_t = 0 if not self.scooping else self.scoop_t
if self.scooping and not moving and self.stock < STOCK_MAX:
    if any(point_distance(self.x, self.y, d.x, d.y) < SCOOP_REACH for d in instances("Drift")):
        self.scoop_t += 1
        if self.scoop_t >= SCOOP_STEPS:
            self.scoop_t = 0
            self.stock += 1
            if getattr(self, "is_player", False):
                sound_play("scoop", volume=0.4)

# Footprints in fresh snow (not on paths, not in the woods).
leave_prints(self, moving)

# Which picture: a throw, scooping, walking, or standing.
pick_pose(self, moving)

# === draw
draw_kid(self, self.x, self.y)
