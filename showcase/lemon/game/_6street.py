# script: street
# What happens on the street during the day, shared by the Customers and the Stand.


def say(cust, said):
    """A customer says what they think: a thought bubble over them, counted in the day's ledger."""
    heard(global_vars.s, global_vars.t, said)
    b = instance_create(cust.x, cust.y - 150, "Bubble")
    b.said = said
    if said in ("perfect", "love"):
        cust.happy = 60
    sound_play("yum" if said in ("perfect", "love") else "hmm", volume=0.35)


def serve_steps(s):
    """How long one cup takes to pour: half as long with a helper, a third less with a register."""
    n = SERVE_STEPS // 2 if has(s, "helper") else SERVE_STEPS
    if has(s, "helper"):
        n = n * TRAIN_FASTER ** (staff_level(s, "helper") - 1)      # a trained helper is quicker still
    return round(n * REGISTER_SAVES) if has(s, "register") else n


def queue_spot(i):
    return STAND_X - 80 - i * QUEUE_GAP


def clock_words(clock):
    """The street's clock: the stand opens at 9 and the day ends at 6."""
    minutes = 9 * 60 + int(min(clock, DAY_STEPS) / DAY_STEPS * 9 * 60)
    h, m = divmod(minutes, 60)
    return f"{(h - 1) % 12 + 1}:{m // 15 * 15:02d} {'am' if h < 12 else 'pm'}"
