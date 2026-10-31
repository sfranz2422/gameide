# script: garage
# What's kept between visits (GameIDE's save_set and save_get): your coins,
# the vehicles and stages you own, each vehicle's upgrades, your best
# distance on each stage, and a ghost of that best run.
#
# The garage's menu is a list of rows; up and down pick a row, left and
# right change it, and Space (or G) buys or starts.

ROWS = ["stage", "vehicle", "engine", "suspension", "tires", "fuel tank", "go"]


def wallet():
    return save_get("coins", 0)


def pay(price):
    """Takes `price` coins if you have them. True if you did."""
    if wallet() < price:
        return False
    save_set("coins", wallet() - price)
    return True


def add_coins(n):
    save_set("coins", wallet() + n)


def owned_vehicles():
    return save_get("vehicles", ["Jeep"])


def owned_stages():
    return save_get("stages", ["Countryside"])


def levels_of(kind):
    """{"engine": 2, ...} for this vehicle."""
    return save_get("levels", {}).get(kind, {})


def upgrade_price(kind, name):
    """What the next level of this upgrade costs, or None at the top level."""
    n = levels_of(kind).get(name, 0)
    prices = UPGRADES[name]["prices"]
    return prices[n] if n < len(prices) else None


def buy_upgrade(kind, name):
    price = upgrade_price(kind, name)
    if price is None or not pay(price):
        return False
    all_levels = save_get("levels", {})
    mine = dict(all_levels.get(kind, {}))
    mine[name] = mine.get(name, 0) + 1
    all_levels[kind] = mine
    save_set("levels", all_levels)
    return True


def buy_vehicle(kind):
    if kind in owned_vehicles() or not pay(VEHICLES[kind]["price"]):
        return False
    save_set("vehicles", owned_vehicles() + [kind])
    return True


def buy_stage(name):
    if name in owned_stages() or not pay(stage_by_name(name)["price"]):
        return False
    save_set("stages", owned_stages() + [name])
    return True


def best(stage_name):
    return save_get("best", {}).get(stage_name, 0)


def keep_best(stage_name, metres_now):
    """A new best distance is kept, with the run's ghost. True if it was a best."""
    if metres_now <= best(stage_name):
        return False
    b = save_get("best", {})
    b[stage_name] = metres_now
    save_set("best", b)
    ghosts = save_get("ghosts", {})
    ghosts[stage_name] = {"car": RUN["car"].kind, "path": RUN["path"]}
    save_set("ghosts", ghosts)
    return True


def load_ghost(stage_name):
    return save_get("ghosts", {}).get(stage_name)
