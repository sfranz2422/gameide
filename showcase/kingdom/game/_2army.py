# script: army
# Phase 2's training: troops queued in the barracks, trained one after another on the real
# clock (each barracks built works at the queue too, so two train twice as fast), waiting
# in the army camps until a battle. Nothing here draws.
#
# In the kingdom dict:
#   army      {kind: how many are ready}
#   training  [kind, …]   the queue, the front one being trained
#   train_t   when the front one started


def load_army(r):
    """A kingdom from before phase 2 gets an empty army."""
    r.setdefault("army", {})
    r.setdefault("training", [])
    r.setdefault("train_t", now())
    r.setdefault("campaign", {})          # a village's number (as text): the most stars won there
    r.setdefault("campaign_loot", {})     # a village's number: [gold, food] still there to take
    return load_forge(load_magic(load_raids(r)))


def barracks_level(r):
    """The best barracks: it decides which troops can be trained."""
    return max([0] + [b["level"] for b in r["buildings"] if b["kind"] == "barracks"])


def barracks_working(r):
    return sum(1 for b in r["buildings"] if b["kind"] == "barracks" and b["level"] > 0)


def army_room(r):
    """Room in the army camps (a camp being built for the first time has none yet)."""
    return sum(stat("army_camp", "room", b["level"]) for b in r["buildings"] if b["kind"] == "army_camp" and b["level"] > 0)


def space_of(counts):
    return sum(TROOPS[k]["space"] * n for k, n in counts.items())


def army_used(r):
    """Room taken by the troops ready and the ones in the queue."""
    queued = {}
    for k in r["training"]:
        queued[k] = queued.get(k, 0) + 1
    return space_of(r["army"]) + space_of(queued)


def can_train(r, kind):
    """None if one more of a kind can be queued now, or why not, in words."""
    t = TROOPS[kind]
    if barracks_level(r) < t["barracks"]:
        return f"Upgrade a barracks to level {t['barracks']} first."
    if len(r["training"]) >= TRAIN_QUEUE_MOST:
        return "The queue is full."
    if army_used(r) + t["space"] > army_room(r):
        return "No room in the army camps: build or upgrade one."
    if r["food"] < t["cost"]:
        return f"That needs {t['cost']:,} food."
    return None


def train(r, kind):
    """'queued' (paid for), or why not in words."""
    why = can_train(r, kind)
    if why:
        return why
    r["food"] -= TROOPS[kind]["cost"]
    if not r["training"]:
        r["train_t"] = now()
    r["training"].append(kind)
    return "queued"


def untrain(r, kind):
    """Takes the last of a kind off the queue, its food back. True if there was one."""
    for i in range(len(r["training"]) - 1, -1, -1):
        if r["training"][i] == kind:
            del r["training"][i]
            r["food"] += TROOPS[kind]["cost"]     # all of it back, even over what storage holds: it was paid
            if i == 0:
                r["train_t"] = now()      # the next one starts afresh
            return True
    return False


def train_seconds(r, kind):
    """How long one of a kind takes, with every barracks working at it."""
    return TROOPS[kind]["time"] / max(1, barracks_working(r))


def train_tick(r):
    """The queue on the real clock (while the game was closed too): everything whose time
    is up goes into the army. How many were trained."""
    n = 0
    while r["training"]:
        k = r["training"][0]
        need = train_seconds(r, k)
        if now() < r["train_t"] + need:
            break
        r["training"].pop(0)
        r["army"][k] = r["army"].get(k, 0) + 1
        r["train_t"] += need
        n += 1
    if not r["training"]:
        r["train_t"] = now()
    return n


def train_left(r):
    """Seconds until the front of the queue is trained (0 with nothing queued)."""
    if not r["training"]:
        return 0
    return max(0, r["train_t"] + train_seconds(r, r["training"][0]) - now())


def army_size(r):
    return sum(r["army"].values())
