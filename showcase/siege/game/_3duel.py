# script: duel
# Two players in a room. The host's game (net_host()) runs the battle, exactly as
# against the computer, with the other player as side 1; every step it sends a
# small picture of the desk ("g", snapshot()). The other player's game runs no
# battle of its own: it shows copies ("puppets") of the same objects, mirrored so
# that each player sees themselves blue on the left, and its card plays go to the
# host privately, which checks them as it checks its own (play_card).

# Everything the other player's game shows, by its number in snapshot().
KINDS = ["Soldier", "Knight", "Plane", "Archer", "Golem", "Wall", "Tower", "Keep", "Marble", "Glue", "Deploy"]
GONE_STEPS = 150 * 60        # an opponent away this long (not just answering a question) has left
SMOOTH = 0.35                # how far a puppet glides toward where the host says it is, each step


def in_room():
    return net_room() is not None


def runs_battle():
    """This game runs the battle: alone against the computer, or the room's host."""
    return not in_room() or net_host() == net_me().number


def opponent():
    """The other player in the room (None if they're gone or away)."""
    ps = net_players()
    return ps[0] if ps else None


def play(slot, x, y):
    """
    Your card in hand slot `slot`, played at (x, y) on your screen. The host's game
    plays it; the other player's sends it to the host (mirrored into the host's
    desk), which plays it if it may. True if it went.
    """
    m = global_vars
    if runs_battle():
        return play_card(0, slot, x, y)
    card = hand(0)[slot]
    if stopped() or m.energy[0] < CARDS[card]["cost"] or not can_drop(0, card, x, y):
        return False
    net_tell(net_host(), {"play": [slot, round(VIEW_W - x), round(y)], "n": m.match_no})
    sound_play("drop", volume=0.5)
    return True


def snapshot():
    """The battle in a few hundred characters: what the other player's game draws."""
    m = global_vars
    things = []
    for o in instances("Unit") + instances("Building") + instances("Marble") + instances("Glue") + instances("Deploy"):
        k = KINDS.index(type(o).__name__)
        if is_a(o, "Deploy"):
            extra = [o.t, DECK.index(o.card)]
        elif is_a(o, "Glue"):
            extra = [o.life, 0]
        elif is_a(o, "Marble"):
            extra = [0, 0]
        else:
            extra = [round(100 * max(0, o.hp) / o.max_hp), (1 if o.flash else 0) + (2 if getattr(o, "awake", False) else 0)]
        things.append([o.uid, k, o.side, round(o.x), round(o.y)] + extra)
    shots = [[round(s.x), round(s.y), s.side] for s in instances("Shot")]
    g = {"n": m.match_no, "t": m.clock, "c": m.crowns, "e": round(m.energy[1], 2), "h": m.decks[1][:HAND + 1],
         "o": m.overtime, "x": m.over, "w": m.winner, "a": m.again, "u": things, "s": shots, "z": m.halt}
    # A room's word is at most NET_STATE_LIMIT characters: in a very big battle, the shots go first.
    if len(json.dumps(g)) > 1900:
        g["s"] = []
    while len(json.dumps(g)) > 1900 and g["u"]:
        g["u"].pop()
    return g


def mirror_side(side):
    """The host's side as this (the other) game shows it: you're always side 0, blue, on the left."""
    return 1 - side if side in (0, 1) else side


def show(g, puppets):
    """
    The other player's game: the battle as the host last said, mirrored. Puppets are
    made, moved (gliding toward where the host says) and let go as things come and go.
    """
    m = global_vars
    m.match_no, m.clock, m.overtime, m.over, m.halt = g["n"], g["t"], g["o"], g["x"], g["z"]
    m.crowns = [g["c"][1], g["c"][0]]
    m.winner = mirror_side(g["w"]) if g["w"] is not None else None
    m.energy[0] = g["e"]
    m.decks[0] = list(g["h"]) + [c for c in DECK if c not in g["h"]]
    m.again = [g["a"][1], g["a"][0]]
    m.shots = [(VIEW_W - x, y, 1 - side) for x, y, side in g["s"]]
    seen = set()
    for uid, k, side, x, y, a, b in g["u"]:
        seen.add(uid)
        o = puppets.get(uid)
        tx = VIEW_W - x
        if o is None or not instance_exists(o):
            o = instance_create(tx, y, KINDS[k])
            o.puppet = True
            o.side = 1 - side
            if KINDS[k] in ("Tower", "Keep"):
                setup_tower(o, "keep" if KINDS[k] == "Keep" else "tower")
            puppets[uid] = o
        o.x += (tx - o.x) * SMOOTH
        o.y += (y - o.y) * SMOOTH
        if KINDS[k] == "Deploy":
            o.t, o.card = a, DECK[b]
        elif KINDS[k] == "Glue":
            o.life = a
        elif KINDS[k] != "Marble":
            o.hp = o.max_hp * a / 100
            o.flash = 6 if b & 1 else 0
            if KINDS[k] == "Keep":
                o.awake = bool(b & 2)
    for uid in list(puppets):
        if uid not in seen:
            if instance_exists(puppets[uid]):
                puppets[uid].destroy()
            del puppets[uid]
