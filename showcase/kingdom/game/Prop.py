# object: Prop
# Something standing still on the map: a wall, a tree, a rock. It has no events, so the
# engine draws its sprite by itself and no Python runs for it each step: a kingdom has
# a couple of hundred walls (Cloverbrook learnt it: a step and a draw each cost every frame).
# The Realm sets its sprite, place and depth as it makes it, and changes them when a wall
# goes up a level or moves.
