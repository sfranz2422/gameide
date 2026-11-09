# object: Player
# parent: Crew
# You. Walks the station in the dark with a lamp. E does what's in reach: tells
# everyone about someone frozen, opens one of your jobs, or (at the beacon) calls
# a meeting. A Mimic freezes crew with F. Out of the round, you're a ghost: you
# walk through walls, and can still do your jobs.

# === create
super().on_create()
self.suit = save_get("suit", "coral")
if self.suit not in SUIT_NAMES:
    self.suit = "coral"
self.sprite = "crew_" + self.suit
self.vx = self.vy = 0
global_vars.player = self
# Alone, it's practice: five random jobs. In a room, you wait for the host to deal.
global_vars.jobs = [] if in_room() else deal_jobs(random.randrange(1 << 30))
global_vars.near = None          # (what, thing): "body", "job" or "beacon" in reach
global_vars.target = None        # a Mimic's: crew in reach to freeze
global_vars.done = set()
global_vars.job = None
global_vars.all_done = 0
camera_follow(self, 0.18)
touch_controls(True, ("e", "f"))

# === step
g = global_vars.g
ghost = am_ghost()
held = global_vars.job is not None or g["ph"] in ("meeting", "result")
self.vx = self.vy = 0
if not held:
    dx = (keyboard_check("right") or keyboard_check("d")) - (keyboard_check("left") or keyboard_check("a"))
    dy = (keyboard_check("down") or keyboard_check("s")) - (keyboard_check("up") or keyboard_check("w"))
    if dx and dy:
        dx, dy = dx * 0.7071, dy * 0.7071
    x0, y0 = self.x, self.y
    if ghost:
        # Ghosts drift through walls, but stay in the station's waters.
        self.x = clamp(self.x + dx * SPEED * 1.2, 16, COLS * TILE - 16)
        self.y = clamp(self.y + dy * SPEED * 1.2, 16, ROWS * TILE - 16)
    else:
        # Across, then up and down: against a wall you slide along it.
        self.move_and_collide(dx * SPEED, 0)
        self.move_and_collide(0, dy * SPEED)
    self.vx, self.vy = self.x - x0, self.y - y0
    if dx:
        self.facing = 1 if dx > 0 else -1
    if dx or dy:
        self.walk_t += 0.12
        self.image_index = 1 + int(self.walk_t) % 2
    else:
        self.image_index = 0
    if ghost:
        self.image_index = 5

    # What's in reach, nearest first: someone frozen, one of your jobs, the beacon.
    near = None
    if playing() and g["ph"] == "play":
        for b in instances("Body"):
            if point_distance(self.x, self.y, b.x, b.y) < REPORT_REACH:
                near = ("body", b)
    if near is None:
        for s in instances("Station"):
            if s.i in global_vars.jobs and s.i not in global_vars.done and point_distance(self.x, self.y, s.x, s.y) < REACH:
                near = ("job", s)
    if near is None and playing() and g["ph"] == "play" and global_vars.calls_left > 0:
        for b in instances("Beacon"):
            if point_distance(self.x, self.y, b.x, b.y) < REACH:
                near = ("beacon", b)
    global_vars.near = near
    clicked = mouse_check_pressed("left") and near is not None and point_distance(mouse_x, mouse_y, near[1].x, near[1].y) < 32
    if near is not None and (keyboard_check_pressed("e") or keyboard_check_pressed("space") or clicked):
        what, thing = near
        if what == "body":
            try_report(thing.number)
        elif what == "beacon":
            try_call()
        else:
            job = instance_create(0, 0, JOB_OBJECT[thing.kind])
            job.station = thing.i
            global_vars.job = job
            self.image_index = 3
            sound_play("open", volume=0.5)

    # A Mimic's cold touch: the nearest crew member in reach (never a fellow Mimic).
    target = None
    if global_vars.role == "mimic" and playing() and g["ph"] == "play":
        best = FREEZE_REACH
        for o in instances("Other"):
            if o.visible and not o.ghost and o.number not in global_vars.mates:
                d = point_distance(self.x, self.y, o.x, o.y)
                if d <= best:
                    best, target = d, o
    global_vars.target = target
    if target is not None and global_vars.cool <= 0 and (keyboard_check_pressed("f") or keyboard_check_pressed("q")):
        try_freeze(target.number)
else:
    global_vars.near = None
    global_vars.target = None
self.image_xscale = self.facing
self.image_alpha = 0.55 if ghost else 1
# Your lamp: all there is to see by in the dark. A Mimic's eyes see further.
light(self.x, self.y - 16, LIGHT["ghost" if ghost else global_vars.role or "crew"], "#cfeaff", 1)
# A Python question waits while a job or a meeting is open.
question_ok(global_vars.job is None and g["ph"] not in ("meeting", "result"))

# === draw
draw_self()
me = net_me()
if me is not None:
    words(self.x, self.y - 62, f"#{me.number}", 12, "#ffd23f", "center")
