# object: Link
# depth: -10
# The room's side of a match, in both players' games (it does nothing alone).
# The host's game sends the battle every step and plays the other player's cards
# when they arrive; the other player's game shows the battle from what arrives
# (see the duel script). If the other player is away (a Python question), the
# match holds still; gone for good, the one still here wins.

# === create
self.puppets = {}
self.away_for = 0
global_vars.shots = []

# === step
if not in_room():
    return
m = global_vars
them = opponent()
self.away_for = 0 if them is not None else self.away_for + 1
if runs_battle():
    for msg in net_messages():
        d = msg.data
        if not msg.private or not isinstance(d, dict) or d.get("n") != m.match_no:
            continue
        if "play" in d and isinstance(d["play"], list) and len(d["play"]) == 3:
            slot, x, y = d["play"]
            if isinstance(slot, int) and isinstance(x, (int, float)) and isinstance(y, (int, float)):
                play_card(1, slot, x, y)
        elif d.get("again") and m.over:
            m.again[1] = True
    # Hold the match while they're away; gone this long, they've left.
    m.halt = them is None and not m.over
    if m.halt and self.away_for > GONE_STEPS:
        m.halt = False
        end_match(0)
    if m.over and all(m.again):
        new_match()
    net_send({"g": snapshot()})
else:
    g = them.get("g") if them is not None else None
    if isinstance(g, dict) and "u" in g:
        show(g, self.puppets)
    elif them is None and not m.over:
        # The host is away (a question) or gone: held, then won if they don't come back.
        m.halt = True
        if self.away_for > GONE_STEPS:
            m.halt = False
            m.over, m.winner = True, 0

# === draw
# The host's shots, in the other player's game (it has no Shot objects of its own).
for x, y, side, kind in global_vars.shots:
    draw_sprite_ext(kind, 0, x, y, 1, 1, 0 if kind == "snowshot" else (0 if side == 0 else 180))
