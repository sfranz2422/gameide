# object: Director
# The room's side of the game, in every player's game: keeps a copy of the
# round ("g", from the host), shows the other players and the frozen, sends
# where you are, and, in the host's game only, runs the round (see the room
# script). Outside a room it does nothing: the station is practice.

# === create
global_vars.director = self
global_vars.g = new_game()
global_vars.role = None          # "crew" or "mimic" in a round; None waiting or alone
global_vars.mates = []           # a Mimic's fellow Mimics
global_vars.chat = []            # [(number, words)], the meeting's, newest last
global_vars.my_vote = None
global_vars.cool = 0             # a Mimic's steps until they can freeze again
global_vars.calls_left = CALLS_EACH
self.t = 0
self.inbox = []                  # what players told the host: [(number, dict)]
self.host_for = 0                # steps this game has been the host
self.lost_at = -1000             # when this game stopped being the host
self.last_host = None
self.round_seen = 0
self.phase_seen = "lobby"
self.others = {}                 # number -> Other
self.bodies = {}                 # number -> Body
self.said_at = -SAY_WAIT
# The host's own records: never sent to anyone.
self.roles, self.done, self.coolness, self.calls, self.votes, self.seen = {}, {}, {}, {}, {}, {}

# === step
if net_room() is None:
    return
self.t += 1
me = net_me().number
host = net_host()
players = net_players()
g = global_vars.g

# The newest copy of the round anyone sends (the host's; or, as the host
# changes, the old host's for a moment, which the new one carries on from).
for p in players:
    pg = p.get("g")
    if isinstance(pg, dict) and pg.get("v", -1) > g["v"]:
        global_vars.g = g = pg

# What arrived.
for m in net_messages():
    d = m.data
    if not isinstance(d, dict):
        continue
    if m.private and "role" in d and m.sender == host:
        take_role(d)
    elif m.private:
        self.inbox.append((m.sender, d))
    elif "say" in d and m.sender in g["in"] and m.sender not in ghosts(g):
        words = phrase_text(*d["say"][:3]) if isinstance(d["say"], list) else None
        if words and g["ph"] == "meeting":
            global_vars.chat.append((m.sender, words))

# Tell the host who you are and how your jobs are going: every second, and at
# once when the host changes (a new host knows nobody's role until told).
if host != self.last_host or self.t % 60 == 0:
    if host != self.last_host:
        if self.last_host == me:
            self.lost_at = self.t
        self.host_for = 0
    self.last_host = host
    done = len([i for i in global_vars.done if i in global_vars.jobs]) if global_vars.role == "crew" else 0
    to_host({"me": global_vars.role, "done": done, "r": g["r"]})

if host == me:
    self.host_for += 1
    # Half a second to hear the old host's last word before running anything.
    if self.host_for >= 30:
        run_round(self)
        global_vars.g["v"] += 1
g = global_vars.g

# A new round, a meeting, the end: what changes in this game.
if g["r"] != self.round_seen:
    self.round_seen = g["r"]
    if global_vars.job is not None:
        job_closed(global_vars.job)
    if me not in g["in"]:
        global_vars.role = None
    global_vars.calls_left = CALLS_EACH
    global_vars.cool = FIRST_WAIT
    sit_down(g)
if g["ph"] != self.phase_seen:
    was, self.phase_seen = self.phase_seen, g["ph"]
    if g["ph"] == "meeting":
        if global_vars.job is not None:
            job_closed(global_vars.job)
        global_vars.chat = []
        global_vars.my_vote = None
        sit_down(g)
        sound_play("alarm", volume=0.6)
    if g["ph"] in ("meeting", "result") and not instances("Meeting"):
        instance_create(0, 0, "Meeting")
    if g["ph"] == "play" and was == "result":
        global_vars.cool = FIRST_WAIT
    if g["ph"] == "lobby":
        global_vars.role = None
        global_vars.jobs = []
        global_vars.done = set()
if g["ph"] not in ("meeting", "result"):
    for o in instances("Meeting"):
        o.destroy()
if global_vars.cool > 0 and g["ph"] == "play":
    global_vars.cool -= 1

# Where you are, for the others; the host adds the round.
pl = global_vars.player
state = {"x": round(pl.x), "y": round(pl.y), "vx": round(pl.vx, 2), "vy": round(pl.vy, 2),
         "f": pl.facing, "p": pl.image_index, "s": pl.suit}
if host == me or self.t - self.lost_at < 120:
    state["g"] = g
net_send(state)

# The others: one Other each, where the engine's smoothing says, and seen only if
# they're still in the round (a ghost sees everyone, ghosts too).
seeing_ghosts = am_ghost() or g["ph"] in ("lobby", "over")
numbers = set()
for p in players:
    if p.draw_x is None:
        continue
    numbers.add(p.number)
    o = self.others.get(p.number)
    if o is None or not instance_exists(o):
        o = instance_create(p.draw_x, p.draw_y, "Other")
        self.others[p.number] = o
    o.number, o.name = p.number, p.name
    o.x, o.y = p.draw_x, p.draw_y
    o.suit = p.get("s", "coral") if p.get("s") in SUIT_NAMES else "coral"
    o.sprite = "crew_" + o.suit
    o.image_index = p.get("p", 0)
    o.facing = -1 if p.get("f", 1) < 0 else 1
    o.ghost = p.number in ghosts(g) and g["ph"] not in ("lobby", "over")
    o.visible = seeing_ghosts or not o.ghost
for n in list(self.others):
    if n not in numbers:
        if instance_exists(self.others[n]):
            self.others[n].destroy()
        del self.others[n]

# The frozen, where they were frozen, until a meeting clears them away.
found = {b[0] for b in g["b"]}
for b in g["b"]:
    if b[0] not in self.bodies or not instance_exists(self.bodies[b[0]]):
        body = instance_create(b[1], b[2], "Body")
        body.number = b[0]
        body.sprite = "crew_" + (b[3] if b[3] in SUIT_NAMES else "coral")
        self.bodies[b[0]] = body
for n in list(self.bodies):
    if n not in found:
        if instance_exists(self.bodies[n]):
            self.bodies[n].destroy()
        del self.bodies[n]
