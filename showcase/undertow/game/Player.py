# object: Player
# parent: Crew
# You. Walks the station in the dark with a lamp, and does the jobs you were
# given: walk up to a panel and press E (or click it).

# === create
super().on_create()
self.suit = save_get("suit", "coral")
self.sprite = "crew_" + self.suit
global_vars.player = self
# Alone, your jobs are a random five; in a room the host deals them (phase 3).
global_vars.jobs = deal_jobs(random.randrange(1 << 30))
global_vars.near = None
global_vars.done = set()
global_vars.job = None
global_vars.all_done = 0
camera_follow(self, 0.18)
touch_controls(True, ("e",))

# === step
# A job open: you're at the panel, not walking.
if global_vars.job is None:
    dx = (keyboard_check("right") or keyboard_check("d")) - (keyboard_check("left") or keyboard_check("a"))
    dy = (keyboard_check("down") or keyboard_check("s")) - (keyboard_check("up") or keyboard_check("w"))
    if dx and dy:
        dx, dy = dx * 0.7071, dy * 0.7071
    # Across, then up and down: against a wall you slide along it.
    self.move_and_collide(dx * SPEED, 0)
    self.move_and_collide(0, dy * SPEED)
    if dx:
        self.facing = 1 if dx > 0 else -1
    if dx or dy:
        self.walk_t += 0.12
        self.image_index = 1 + int(self.walk_t) % 2
    else:
        self.image_index = 0
    # A panel within reach that's one of yours and not done: E (or a click on it) opens its job.
    near = None
    for s in instances("Station"):
        if s.i in global_vars.jobs and s.i not in global_vars.done and point_distance(self.x, self.y, s.x, s.y) < REACH:
            near = s
    global_vars.near = near
    clicked = mouse_check_pressed("left") and near is not None and point_distance(mouse_x, mouse_y, near.x, near.y) < 32
    if near is not None and (keyboard_check_pressed("e") or keyboard_check_pressed("space") or clicked):
        job = instance_create(0, 0, JOB_OBJECT[near.kind])
        job.station = near.i
        global_vars.job = job
        self.image_index = 3
        sound_play("open", volume=0.5)
else:
    global_vars.near = None
self.image_xscale = self.facing
# Your lamp: all there is to see by in the dark.
light(self.x, self.y - 16, 150, "#cfeaff", 1)
# A Python question waits while a job's open.
question_ok(global_vars.job is None)
