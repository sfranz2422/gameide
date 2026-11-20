---
title: Robot's Garden
level: Now You Can Make
after: art-town
time: 50 min
starter: empty
description: Your own collecting game, from an empty one: a garden you cut, autotile and paint yourself, and a gardener from a sprite sheet, quicker on the paths, collecting everything before the clock runs out. You choose the gardener, what it collects, the clock and the keys.
---
# Robot's Garden

You've cut sprite sheets and tilesets, autotiled paths, painted in layers and walked a town. Now make a whole game of **your own** with them, from an empty one.

A gardener has a time limit to collect everything in a big garden. Hedges and ponds are in the way, and the gardener walks faster on the paths. **Everything else is up to you.**

- **Who gardens?** The lesson's robot, a beetle, a gnome, a bunny on a mower…
- **What does it collect?** Seeds, acorns, eggs, lost socks…
- **How long is the clock?** Thirty seconds is frantic; two minutes is a stroll.
- **Which keys?** The arrows, W A S D, or something else.
- **What does the garden look like?** Where the paths go, and where the hedges and ponds are, is yours.

Each step tells you **what** your game needs next and shows **one way** to do it. The code is an example: change the names, keys and numbers to fit your game. The checks don't care what you call things, only that your game does what the step asks.

---

## The garden tileset

Download the garden's tiles: **[garden.png](tutorials/art/garden.png)**

Press the **+** beside **Tilesets**, name it **garden**, and choose the picture. Its tiles are **16 × 16**, with no gaps between them.

The first 16 tiles are the path, in the order autotiling reads. Under **Autotile sets** press **New autotile set**, name it **path**, and press **Take 16 in order**.

highlight: tileset-cut

```check
tileset garden is cut 16 × 16
tileset garden has an autotile set
```

---

## Grass and paths

Open **Room1**, and in its settings make it **960** wide and **720** tall: bigger than the screen, so there's a garden to explore.

Press **+ Tile layer**, name it (*Grass* is a good name), and choose **garden**. Pick the plain grass (the first tile of the bottom row), choose **Rectangle**, and cover the whole room with it.

Press **+ Tile layer** again, for the paths, and name it (*Paths*, *Trails*…): you'll need its name later. Pick the **path** autotile brush and paint paths your way: a loop, some crossings, a few dead ends. At least 50 squares of path.

```quiz
The room is 960 × 720, and its tiles are 16 pixels. How many tiles of grass cover it?
answer: 2700
```

highlight: add-tile-layer

```check
room Room1 is at least 960 wide
room Room1 has at least 2 tile layers
room Room1 has at least 2750 tiles
```

---

## Hedges and ponds

Press **+ Tile layer** once more, name it, and paint bushes and ponds: hedges along the paths, a pond or two in the grass. At least ten of them, wherever you like.

Then open the **garden** tileset and click the **bush** and the **pond** to mark them **solid**.

highlight: tileset-solid

```check
room Room1 has at least 3 tile layers
tileset garden has at least 2 solid tiles
```

---

## Your gardener

Your gardener walks, so it needs a sprite with frames. Choose one way:

- **The robot:** download **[robot-walk.png](tutorials/art/robot-walk.png)**. Read this before you open the importer, which covers the screen: press the **+** beside **Sprites**, **Import your own picture…**, and choose the file. Choose **Grid**, frames **96 × 128** with **spacing 2** both ways, name it, choose **Bottom center (feet)** for its origin, speed 10, and press **Make sprite**.
- **The art library:** open **Library** and pick a character with walking frames.
- **Draw it:** make a new sprite, 16 × 16 or 32 × 32, and draw two or more frames of it walking. Put its origin at its feet.

Make an object with your sprite, named for your game, and drag one into the room, on the grass.

The tiles are 16 pixels, and the robot is 128 tall: a quarter of that is 32. Give your gardener a **Create** event to set its size and start the count of what it's collected. Change `0.25` to the size that fits your sprite (1 for one already small):

```python
self.image_xscale = 0.25
self.image_yscale = 0.25
self.image_speed = 0
global_vars.seeds = 0
```

And a **Step** event: walking from above, stopped by solid tiles, facing the way it walks, its legs moving only while it does. Change the keys to yours, and `0.25` to your size:

```python
speed = 2
dx = (keyboard_check("right") - keyboard_check("left")) * speed
dy = (keyboard_check("down") - keyboard_check("up")) * speed
move_and_collide(dx, 0)
move_and_collide(0, dy)
if dx != 0:
    self.image_xscale = 0.25 * sign(dx)
if dx != 0 or dy != 0:
    self.image_speed = 1
else:
    self.image_speed = 0
    self.image_index = 0
```

`image_xscale` is the size across, so turning round is your size times -1: still the same size, flipped.

```quiz
Your gardener's `image_xscale` is 0.25 when it walks right. It walks left. What is its `image_xscale`?
answer: -0.25
```

highlight: import-picture

```check
some object has a sprite
room Room1 has at least 1 thing
some object's create uses image_yscale
holding a key moves something
```

---

## Quicker on the paths

`tile_at(x, y, "Paths")` is the tile on the layer called **Paths** at that point, or `None` if nothing is painted there. Your gardener's origin is its feet, so `tile_at(self.x, self.y, …)` is the tile it's standing on.

In your gardener's **Step** event, change the first line, `speed = 2`, to this, and fill in the blanks:

```python
speed = 2
if tile_at(self.x, self.y, ___) is not None:    # your path layer's name, in quotes
    speed = ___    # quicker than 2 on a path
```

**Make it yours:** slower on the grass instead, or slower still in a third kind of tile.

highlight: code-editor

```check
some object's step uses tile_at
game runs 2 seconds without errors
```

---

## Follow the gardener

The garden is bigger than the screen. Open **Room1**'s settings, tick **Camera**, leave it 640 by 480, and choose your gardener to **follow**.

The window is now narrower than the room: `view_width`, how much of the room you see across, is less than `room_width`.

highlight: room-camera

```check
after 1 second, view_width < room_width
```

---

## Things to collect

Make what your gardener collects: its picture (draw it, the library, or import it) and its object, named for your game. Drag at least ten round the garden: down dead ends, behind hedges, across ponds.

Give your gardener a **Collision** event with them, and write it yourself: add 1 to `global_vars.seeds`, and destroy the one it touched.

Make an object with **no sprite** to show the count, name it (*Hud*, *Clock*…), and drag one into the room. Its **Draw GUI** event shows the count in the window's corner, wherever the camera goes. `instance_number(…)` is how many are left. Fill in the blanks:

```python
draw_set_color(___)    # a colour, like "white"
draw_text(10, 10, f"___: {global_vars.seeds}   Left: {instance_number(___)}")    # your word for them, and their object
```

highlight: add-objects

```check
room Room1 has at least 12 things
at least 2 objects have sprites
some object's collision uses seeds
some object's draw gui uses instance_number
```

---

## Against the clock

Give your score object a **Create** event for the clock. You choose how long:

```python
global_vars.time = ___    # seconds to collect them all
self.alarm[0] = 60
```

An **Alarm 0** event takes a second off, until the time or the things to collect run out:

```python
if global_vars.time > 0 and instance_number(___) > 0:    # what you collect
    global_vars.time -= 1
    self.alarm[0] = 60
```

Add to the bottom of its **Draw GUI** event, and fill in the blanks:

```python
draw_text(10, 30, f"Time: {global_vars.time}")
if instance_number(___) == 0:    # what you collect
    draw_text(220, 220, ___)    # your words for finding them all
```

Then write the other ending yourself, under it: `elif` the time is 0, your own words for running out.

And at the **top** of your gardener's **Step** event, stop when it's over, and let a key of your choice play again:

```python
if global_vars.time == 0 or instance_number(___) == 0:    # what you collect
    self.image_speed = 0
    if keyboard_check_pressed(___):    # the key that plays again
        room_restart()
    return
```

```quiz
Why does the alarm check `instance_number(…) > 0` too?
- [x] So the clock stops once everything is collected, showing how long you took
- [ ] So the things to collect come back
- [ ] Because the alarm can't count seconds without it
```

highlight: code-editor

```check
some object has event alarm 0
some object's alarm 0 uses time
some object's step uses room_restart
after 2 seconds, global_vars.time > 0
```

---

## You made your own garden game

You cut, autotiled and painted the garden, and gave a gardener from a sprite sheet something to do in it. Make it even more yours:

- **Flowers** that grow where you've walked: `tile_set` on another layer.
- A **watering can** to find first, before anything can be picked up.
- Something that **chases** you round the garden: a mole, a crow, a lawnmower.
- A **second level**, a bigger garden, and the clock carried over.
- **Sounds** for a pick-up and the last few seconds.
