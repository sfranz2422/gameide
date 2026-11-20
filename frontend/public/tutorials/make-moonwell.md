---
title: Moonwell
level: Now You Can Make
after: Starter Projects
time: 55 min
starter: empty
description: Your own metroidvania, from an empty one: rooms to walk between, a power-up that reaches a ledge you couldn't before, and a prize up there. You choose the explorer, the power-up, the prize, the look and the keys.
---
# Moonwell

You've made platformers, levels drawn as text, and games with more than one room. Now make a **metroidvania** of **your own** from an empty one.

In a metroidvania the world is rooms you walk between, and some places can't be reached yet. Find a new power and you can go back and reach them. In this one there's a prize on a ledge in the first room, too high to jump to. Somewhere in the next room is a power-up that lets you jump again in mid-air. **Everything else is up to you.**

- **Who explores?** A fox, an astronaut, a little wizard, a jumping bean…
- **What's the power-up?** A glowing orb, a feather, rocket boots, a magic bean…
- **What's the prize?** A gem, a golden acorn, a lost moon…
- **Which keys?** The arrows, W A S D, or something else.
- **What does it look like?** Draw your own pictures, pick from the art library, or import your own.

Each step tells you **what** your game needs next and shows **one way** to do it. The code is an example: change the names, keys and numbers to fit your game. The checks don't care what you call things, only that your game does what the step asks.

The rooms are 640 × 480: maps of squares of 32, 20 across and 15 down. Walls should be **32 × 32**, one square each. Make your explorer smaller, like 24 × 24 or 16 × 16.

---

## Two rooms, two maps

Press the **+** beside **Rooms** to make **Room2**. Both rooms will be built from maps, so keep the maps together in one place: make a **script**, and name it (*maps* is a good name).

```python
MAPS = {
    "Room1": [
        "####################",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..........g.......#",
        "#........####......#",
        "#..................#",
        "#..................#",
        "#...................",
        "#....###............",
        "#P...............R..",
        "####################",
    ],
    "Room2": [
        "####################",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#..................#",
        "#............o.....#",
        "#...........###....#",
        "#..................#",
        "#.......###........#",
        "...................#",
        "....###............#",
        "..L................#",
        "####################",
    ],
}
RIGHT = {"Room1": "Room2"}
LEFT = {"Room2": "Room1"}
```

`MAPS` is a **dictionary**: look up a room's name, and get its map. Room1 has a gap in its right wall, and Room2 one in its left. `RIGHT` says which room is through the right-hand gap, and `LEFT` the left.

`P` is where your explorer starts. `L` and `R` are where it arrives, coming in from the left or the right. `g` is the prize, and `o` the power-up.

**Make it yours:** change Room2's map: more ledges, a pit, a long climb. Leave Room1's prize ledge where it is for now: it's just out of reach of one jump.

highlight: folder-scripts

```check
room Room2 exists
uses MAPS
```

---

## Walls in both rooms

Make the walls: a picture (draw one 32 × 32, pick one from the **Library**, or import one), an object with it named for your game (*Wall*, *Rock*, *Cloud*…), and tick **Solid**.

Make an object with **no sprite** that builds the rooms, name it (*Level*, *World*…), and drag one into **Room1** and one into **Room2**. Its **Create** event builds whichever room it's in, from that room's map. Change `"Wall"` to your wall's name:

```python
if not hasattr(global_vars, "arrive"):
    global_vars.arrive = "start"
    global_vars.double_jump = False
rows = MAPS[room_name()]
for row in range(len(rows)):
    for col in range(len(rows[row])):
        ch = rows[row][col]
        if ch == "#":
            instance_create(col * 32, row * 32, "Wall")
```

`room_name()` is the name of the room the game is in. The first lines run only once, the very first time: `global_vars` keeps its values from room to room, and `hasattr` checks whether it has `arrive` yet.

```quiz
Why is `global_vars.double_jump = False` inside the `if not hasattr(...)`?
- [x] So it's only set the first time. Otherwise coming back into a room would take the power away
- [ ] Because `hasattr` makes double jumps
- [ ] So that Room2 starts with the double jump
```

highlight: open-library

```check
some object has a sprite
room Room1 has at least 1 thing
room Room2 has at least 1 thing
some object's create uses room_name
```

---

## Your explorer

Make your explorer: its picture (draw it, the library, or import it), and an object with it, named for your game.

Your room-building object makes it at the `P` when the game starts. Coming in from the left, it's made at the `L`, and from the right at the `R`. Add to its loop, under the wall line, and change `"Player"` to your explorer's name:

```python
        elif ch == "P" and global_vars.arrive == "start":
            instance_create(col * 32 + 4, row * 32 + 8, "Player")
        elif ch == "L" and global_vars.arrive == "left":
            instance_create(col * 32 + 4, row * 32 + 8, "Player")
        elif ch == "R" and global_vars.arrive == "right":
            instance_create(col * 32 + 4, row * 32 + 8, "Player")
```

`+ 4` and `+ 8` put a 24-pixel picture in its square. If your picture's origin is its middle, use `+ 16` for both.

Give your explorer a **Create** event:

```python
self.vy = 0
self.air_jumps = 0
```

And a **Step** event: running and falling as in **10. Platformer Tools**, and a jump on each press. Change `"left"`, `"right"` and `"up"` to your keys:

```python
move = keyboard_check("right") - keyboard_check("left")
move_and_collide(move * 3, 0)
self.vy += 0.5
if move_and_collide(0, self.vy):
    self.vy = 0
on_ground = not place_free(self.x, self.y + 1)
if on_ground and keyboard_check_pressed("up"):
    self.vy = -9
```

highlight: add-event

```check
at least 2 objects have sprites
holding a key moves something
some object's step uses move_and_collide
```

---

## Through the gaps

Walk off the right of a room and you go to the room in `RIGHT`, arriving on its left. Add to the bottom of your explorer's **Step** event, and fill in the blank:

```python
if self.x > ___ and room_name() in RIGHT:    # past the right edge, like room_width - 16
    global_vars.arrive = "left"
    room_goto(RIGHT[room_name()])
```

`room_name() in RIGHT` asks whether the dictionary has this room in it. Room2 has no gap on its right, so it isn't in `RIGHT`.

Now write the other way yourself, under it: walking off the **left** (when `self.x` is less than -8) of a room that's in `LEFT` goes to the room in `LEFT`, arriving on its **right**.

Play it: walk right into Room2, then back again.

highlight: code-editor

```check
some object's step uses room_goto
some object's step uses LEFT
game runs 2 seconds without errors
```

---

## The power-up

Make your power-up: its picture and its object. Your room-building object makes it at the `o`, unless you have its power already. Add to its loop:

```python
        elif ch == "o" and not global_vars.double_jump:
            instance_create(col * 32 + 16, row * 32 + 16, ___)    # your power-up's object, in quotes
```

Give your explorer a **Collision** event with the power-up. It gives you the power:

```python
global_vars.double_jump = True
```

Then, under it, write a line yourself that destroys the power-up you touched (`other`).

```quiz
You take the power-up, walk back to Room1, then return to Room2. Why isn't it there again?
- [x] It's only made while `global_vars.double_jump` is False, and taking it made that True
- [ ] Destroyed instances never come back, in any room
- [ ] Room2 remembers everything in it
```

highlight: add-event

```check
at least 3 objects have sprites
some object's collision uses double_jump
some object's collision uses destroy
```

---

## The double jump

Now give the power something to do. In your explorer's **Step** event, change the jump, the two lines under `on_ground = …`, to this, and fill in the blanks:

```python
if keyboard_check_pressed(___):    # your jump key
    if on_ground:
        self.vy = ___    # your jump, like -9
    elif global_vars.double_jump and self.air_jumps == 0:
        self.vy = ___    # the second jump: the same, a little less, or more
        self.air_jumps = 1
if on_ground:
    self.air_jumps = 0
```

Pressing your jump key in mid-air jumps again, but only once (`air_jumps`) and only with the power. Landing gives the jump back.

From the step in Room1, the prize's ledge is four squares up. A jump of -9 goes two and a half, so you need both jumps. Try your numbers: one jump mustn't reach the ledge, and two must.

highlight: code-editor

```check
some object's step uses air_jumps
game runs 2 seconds without errors
```

---

## The prize

Make your prize: its picture and its object. In your room-building object's loop, add an `elif` for the `g` yourself, like the power-up's.

A **Collision** event on your explorer, with the prize:

```python
global_vars.won = True
other.destroy()
```

Make an object with **no sprite** to show your power and the end, name it (*Hud*, *Sign*…), and drag one into **Room1** and one into **Room2**. Give it a **Draw GUI** event, and fill in the blanks:

```python
draw_set_color(___)    # a colour, like "white"
if global_vars.double_jump:
    draw_text(10, 10, ___)    # words that say you have the power
```

Then write the end yourself: if `global_vars` has `won` (use `hasattr`, as the room-building object does), draw your own words for finding the prize.

```quiz
Why check `hasattr(global_vars, "won")`, and not just `global_vars.won`?
- [x] `won` doesn't exist until the prize is taken, and reading it before then is an error
- [ ] `hasattr` is faster
- [ ] `global_vars.won` is always True
```

highlight: add-objects

```check
at least 4 objects have sprites
room Room2 has at least 2 things
some object's collision uses won
some object's draw gui uses hasattr
```

---

## You made your own metroidvania

That's a metroidvania: the world, a power, and a place you can only reach once you have it. Make it even more yours:

- A **third room**, through a gap in Room2, with a new power: a dash, or swimming.
- A **door** that only opens once you have the prize.
- A **map** in the corner of the Draw GUI, with the room you're in lit up.
- **Backgrounds**: a cave, a forest, the sky. Paint one, or pick one from the library.
- **Sounds** for a jump, the power-up and the prize.
