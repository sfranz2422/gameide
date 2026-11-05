# object: Lift
# sprite: lift
# parent: Usable
# The way down to the deep tunnels, once it has been unlocked with the foreman's key.

# === create
super().on_create()
self.solid = True

def use_lift():
    if not flag("lift_open"):
        if not count_item("mine_key"):
            say("The lift's gate is locked. It's a heavy old lock, with the foreman's mark on it.")
            return
        take_item("mine_key")
        set_flag("lift_open")
        reach_stage("ember_mine", 3)
        sound_play("coin")
    go_to("MineDeep", 12 * 32 + 16, 14 * 32 + 24)

self.use = use_lift
