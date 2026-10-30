---
title: Moonwell
level: Now You Can Make
after: Starter Projects
time: 55 min
starter: empty
description: A whole metroidvania from an empty one: rooms to walk between, a power-up that lets you reach a ledge you couldn't before, and the gem up there.
---
# Moonwell

You've made platformers, levels drawn as text, and games with more than one room. Now make a **metroidvania** of your own, from an empty one.

In a metroidvania the world is rooms you walk between, and some places can't be reached yet. Find a new power and you can go back and reach them. In **Moonwell** there's a gem on a ledge in the first room, too high to jump to. Somewhere in the next room is an orb that lets you jump again in mid-air.

---

## Two rooms, two maps

Press the **+** beside **Rooms** to make **Room2**. Both rooms will be built from maps, so keep the maps together in one place: make a **script** called **maps**.

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

highlight: folder-scripts

```check
room Room2 exists
script maps exists
```

---

## Walls in both rooms

Add the **wall** sprite and an object called **Wall** with it, and tick **Solid**.

Make an object called **Level**, with no sprite. Drag one into **Room1**, and one into **Room2**. Its **Create** event builds whichever room it's in, from that room's map:

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

highlight: add-objects

```check
object Wall exists
room Room1 has 1 Level
room Room2 has 1 Level
Level.create uses room_name
```

---

## The explorer

Add the **player** sprite and an object called **Player** with it. The Level makes the player, at the `P` when the game starts. Coming in from the left, it's made at the `L`, and from the right at the `R`. Add to **Level**'s loop, under the Wall line:

```python
        elif ch == "P" and global_vars.arrive == "start":
            instance_create(col * 32 + 4, row * 32 + 8, "Player")
        elif ch == "L" and global_vars.arrive == "left":
            instance_create(col * 32 + 4, row * 32 + 8, "Player")
        elif ch == "R" and global_vars.arrive == "right":
            instance_create(col * 32 + 4, row * 32 + 8, "Player")
```

Give **Player** a **Create** event:

```python
self.vy = 0
self.air_jumps = 0
```

And a **Step** event: running and falling as in **10. Platformer Tools**, and a jump on each press of up:

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
object Player exists
Level.create uses arrive
after 1 second holding right, Player.x increased
after 0.3 seconds holding up, Player.y decreased
```

---

## Through the gaps

Walk off the right of a room and you go to the room in `RIGHT`, arriving on its left. Walk off the left, and you go to the room in `LEFT`, arriving on its right. Add to the bottom of **Player**'s **Step** event:

```python
if self.x > room_width - 16 and room_name() in RIGHT:
    global_vars.arrive = "left"
    room_goto(RIGHT[room_name()])
if self.x < -8 and room_name() in LEFT:
    global_vars.arrive = "right"
    room_goto(LEFT[room_name()])
```

`room_name() in RIGHT` asks whether the dictionary has this room in it. Room2 has no gap on its right, so it isn't in `RIGHT`.

Play it, and walk right into Room2, then back. After a few seconds of holding right, `room_name()` is `"Room2"`.

highlight: code-editor

```check
Player.step uses room_goto
after 4 seconds holding right, room_name() == "Room2"
```

---

## The orb

Add the **orb** sprite and an object called **Orb** with it. In **Level**'s loop:

```python
        elif ch == "o" and not global_vars.double_jump:
            instance_create(col * 32 + 16, row * 32 + 16, "Orb")
```

Give **Player** a **Collision with Orb** event:

```python
global_vars.double_jump = True
other.destroy()
```

```quiz
You take the orb, walk back to Room1, then return to Room2. Why isn't the orb there again?
- [x] Level only makes it while `global_vars.double_jump` is False, and taking it made that True
- [ ] Destroyed instances never come back, in any room
- [ ] Room2 remembers everything in it
```

highlight: add-event

```check
object Orb exists
Player has event collision with Orb
Level.create uses double_jump
```

---

## The double jump

Now give the power something to do. In **Player**'s **Step** event, change the jump, the two lines under `on_ground = …`, to:

```python
if keyboard_check_pressed("up"):
    if on_ground:
        self.vy = -9
    elif global_vars.double_jump and self.air_jumps == 0:
        self.vy = -9
        self.air_jumps = 1
if on_ground:
    self.air_jumps = 0
```

Pressing up in mid-air jumps again, but only once (`air_jumps`) and only with the orb's power. Landing gives the jump back.

highlight: code-editor

```check
Player.step uses air_jumps
game runs 2 seconds without errors
```

---

## The gem

Add the **gem** sprite and an object called **Gem** with it. In **Level**'s loop:

```python
        elif ch == "g":
            instance_create(col * 32 + 16, row * 32 + 16, "Gem")
```

A **Collision with Gem** event on **Player**:

```python
global_vars.won = True
other.destroy()
```

Make an object called **Hud**, with no sprite, and drag one into **Room1** and one into **Room2**. Its **Draw GUI** event shows your power, and the end:

```python
draw_set_color("white")
if global_vars.double_jump:
    draw_text(10, 10, "Double jump!")
if hasattr(global_vars, "won"):
    draw_text(200, 220, "You found the Moonwell gem!")
```

From the step in Room1, the gem's ledge is four squares up. One jump goes two and a half, so you need the double jump.

```quiz
Why does the Hud check `hasattr(global_vars, "won")`, and not just `global_vars.won`?
- [x] `won` doesn't exist until the gem is taken, and reading it before then is an error
- [ ] `hasattr` is faster
- [ ] `global_vars.won` is always True
```

highlight: add-objects

```check
object Gem exists
Player has event collision with Gem
room Room1 has 1 Hud
room Room2 has 1 Hud
```

---

## You made Moonwell

That's a metroidvania: the world, a power, and a place you can only reach once you have it. Ideas to make it yours:

- A third room, through a gap in Room2, with a new power: a dash, or swimming.
- A door that only opens once you have the gem.
- A map in the corner of the Hud, with the room you're in lit up.
