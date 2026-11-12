# object: Bot
# parent: Kid
# A computer kid. It thinks every THINK_EVERY steps (bot_think in the bots script),
# walks its path every step, and throws at enemies it can see.

# === create
super().on_create()
self.role = "attack"
self.goal = None
self.path = []
self.path_t = 0
self.post = None
self.why = ""
self.stuck = 0
self.last_x = self.last_y = 0
self.lane = []
self.wait_t = 0            # steps carrying their flag while ours is gone too (a standoff)
self.wait_from = None      # the match step that standoff began

# === step
if self.puppet:
    super().on_step()
    return
if self.stun == 0 and global_vars.m["over"] is None:
    if (global_vars.m_t + self.k * 5 + (0 if self.team == TEAMS[0] else 2)) % THINK_EVERY == 0 or not self.path:
        bot_think(self)
    bot_walk(self)
    if global_vars.m_t % 6 == self.k % 6:
        bot_throw(self)
super().on_step()
