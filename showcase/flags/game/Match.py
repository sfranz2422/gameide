# object: Match
# The match: makes the kids and the flags, runs the referee each step (the match
# script), works out who can see whom, and darkens the woods round you. In a room
# (the room script) it starts in the lobby with only you: the host's game deals
# the teams and fills them with computer kids.

# === create
global_vars.match = self
global_vars.m_t = 0
global_vars.sees = {}
global_vars.thrown = []
global_vars.in_charge = False
for team in TEAMS:
    sx, sy = stand_of(team)
    f = instance_create(sx, sy, "Flag")
    f.team = team
    s = instance_create(sx, sy, "Stand")
    s.team = team
look = save_get("look", 0)
if in_room():
    new_match("lobby")
    room_create(self)
    # You, waiting in the middle of Red's half until the host puts you on a team.
    me = instance_create(COLS * TILE / 4, ROWS * TILE / 2, "Player")
    me.team, me.look = None, look % len(LOOKS[TEAMS[0]])
else:
    new_match("play")
    mine = TEAMS[0]
    for team in TEAMS:
        for k in range(TEAM_SIZE):
            x, y = spawn_spot(team, k)
            if team == mine and k == 0:
                kid = instance_create(x, y, "Player")
                kid.look = look % len(LOOKS[team])
            else:
                kid = instance_create(x, y, "Bot")
                kid.role = BOT_ROLES[k % len(BOT_ROLES)]
                kid.team = team
                kid.tag = f"b{team[0]}{k}"
                if kid.role == "attack":
                    pick_lane(kid)
                # The computer's kids wear the looks the player didn't pick first.
                kid.look = (look + k) % len(LOOKS[team]) if team == mine else k % len(LOOKS[team])
            kid.team, kid.k = team, k
            kid.facing = 1 if team == TEAMS[0] else -1
            kid.sprite = kid_sprite(team, kid.look)
self.dark = 0
self.shown = -1

# === step
global_vars.m_t += 1
if in_room():
    room_step(self)
if global_vars.m_t % SIGHT_EVERY == 0:
    work_out_sight()
if runs_match():
    if playing_match():
        for k in kids():
            touch_flags(k)
    run_clock()
count_mine()

# The woods: dark all round, but for a circle round you.
me = global_vars.player
want = WOODS_DARK if in_woods(me.x, me.y) else 0
self.dark = approach(self.dark, want, 0.04)
if round(self.dark, 2) != self.shown:
    self.shown = round(self.dark, 2)
    lighting(self.shown, "#0b1a2a")
if self.dark > 0:
    light(me.x, me.y - 16, WOODS_LIGHT, "#ffffff", 1)
# Questions wait while you carry the flag, or are knocked down.
question_ok(me.carry is None and me.stun == 0)
