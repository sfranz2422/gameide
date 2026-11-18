# object: Prop
# Something standing still on the map: a tree, a rock, a sign. It has no events, so the
# engine draws its sprite by itself and no Python runs for it each step: the valley has
# a couple of hundred of them (a Thing each, with a step and a draw, cost every frame).
# The Farm sets its sprite, place and depth as it makes it, and `gx`, `gy` to find it
# again when it's cleared; a Prop on land not bought yet is tinted darker.
