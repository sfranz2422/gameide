---
title: Robot's Garden
level: Now You Can Make
after: art-town
time: 50 min
starter: empty
description: A whole game from an empty one: a garden you cut, autotile and paint yourself, a robot from a sprite sheet, quicker on the paths, collecting every seed before the clock runs out.
---
# Robot's Garden

You've cut sprite sheets and tilesets, autotiled paths, painted in layers and walked a town. Now make a whole game with them, from an empty one.

In **Robot's Garden** a robot gardener has sixty seconds to collect every seed in a big garden. Hedges and ponds are in the way, and the robot walks faster on the paths.

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

Press **+ Tile layer**, name it **Grass**, and choose **garden**. Pick the plain grass (the first tile of the bottom row), choose **Rectangle**, and cover the whole room with it.

Press **+ Tile layer** again, name it **Paths**. Pick the **path** autotile brush and paint paths all round the garden: a loop, some crossings, a few dead ends. At least 50 squares of path.

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

Press **+ Tile layer** once more, name it **Things**, and paint bushes and ponds: hedges along the paths, a pond or two in the grass. At least ten of them.

Then open the **garden** tileset and click the **bush** and the **pond** to mark them **solid**.

highlight: tileset-solid

```check
room Room1 has at least 3 tile layers
tileset garden has at least 2 solid tiles
```

---

## The robot gardener

Download the robot: **[robot-walk.png](tutorials/art/robot-walk.png)**

Read this before you open the importer, which covers the screen: press the **+** beside **Sprites**, **Import your own picture…**, and choose the file. Choose **Grid**, frames **96 × 128** with **spacing 2** both ways, name it **robot**, choose **Bottom center (feet)** for its origin, speed 10, and press **Make sprite**.

Make an object called **Robot** with it, and drag one into the room, on the grass.

The robot is 128 pixels tall, and the tiles are 16. Give **Robot** a **Create** event to shrink it to a quarter of its size, and to start the seed count:

```python
self.image_xscale = 0.25
self.image_yscale = 0.25
self.image_speed = 0
global_vars.seeds = 0
```

And a **Step** event: walking from above, stopped by solid tiles, facing the way it walks, its legs moving only while it does.

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

`image_xscale` is the size across, so turning round is 0.25 times -1: still a quarter of the size, flipped.

```quiz
The robot walks left. What is its `image_xscale`?
answer: -0.25
```

highlight: import-picture

```check
sprite robot has 8 frames
object Robot exists
room Room1 has 1 Robot
Robot.create uses image_yscale
after 1 second holding up, Robot.y decreased
```

---

## Quicker on the paths

`tile_at(x, y, "Paths")` is the tile on the **Paths** layer at that point, or `None` if nothing is painted there. The robot's origin is its feet, so `tile_at(self.x, self.y, "Paths")` is the tile it's standing on.

In **Robot**'s **Step** event, change the first line, `speed = 2`, to:

```python
speed = 2
if tile_at(self.x, self.y, "Paths") is not None:
    speed = 3
```

highlight: code-editor

```check
Robot.step uses tile_at
game runs 2 seconds without errors
```

---

## Follow the robot

The garden is bigger than the screen. Open **Room1**'s settings, tick **Camera**, leave it 640 by 480, and choose **Robot** to **follow**.

highlight: room-camera

```check
room Room1 camera follows Robot
```

---

## Seeds

Add the **coin** sprite (it makes a good seed), and an object called **Seed** with it. Drag at least ten seeds round the garden: down dead ends, behind hedges, across ponds.

Add a **Collision with Seed** event to **Robot**:

```python
global_vars.seeds += 1
other.destroy()
```

Make an object called **Hud**, with no sprite, and drag one into the room. Its **Draw GUI** event shows the count in the window's corner, wherever the camera goes. `instance_number("Seed")` is how many are left:

```python
draw_set_color("white")
draw_text(10, 10, f"Seeds: {global_vars.seeds}   Left: {instance_number('Seed')}")
```

highlight: add-objects

```check
room Room1 has at least 10 Seed
Robot has event collision with Seed
Hud.draw gui uses draw_text
```

---

## Sixty seconds

Give **Hud** a **Create** event, for the clock:

```python
global_vars.time = 60
self.alarm[0] = 60
```

An **Alarm 0** event takes a second off, until the time or the seeds run out:

```python
if global_vars.time > 0 and instance_number("Seed") > 0:
    global_vars.time -= 1
    self.alarm[0] = 60
```

Add to the bottom of **Hud**'s **Draw GUI** event:

```python
draw_text(10, 30, f"Time: {global_vars.time}")
if instance_number("Seed") == 0:
    draw_text(220, 220, "Every seed! Enter to play again")
elif global_vars.time == 0:
    draw_text(240, 220, "Time's up! Enter to play again")
```

And at the **top** of **Robot**'s **Step** event, stop when it's over, and let Enter play again:

```python
if global_vars.time == 0 or instance_number("Seed") == 0:
    self.image_speed = 0
    if keyboard_check_pressed("enter"):
        room_restart()
    return
```

```quiz
Why does the alarm check `instance_number("Seed") > 0` too?
- [x] So the clock stops once every seed is collected, showing how long you took
- [ ] So the seeds come back
- [ ] Because the alarm can't count seconds without it
```

highlight: code-editor

```check
Hud has event alarm 0
Robot.step uses room_restart
after 2 seconds, global_vars.time < 60
```

---

## You made Robot's Garden

You cut, autotiled and painted the garden, and gave a robot from a sprite sheet something to do in it. Ideas to make it yours:

- Flowers that grow where you've walked: `tile_set` on another layer.
- A watering can to find first, before seeds can be picked up.
- A second level, a bigger garden, and the clock carried over.
