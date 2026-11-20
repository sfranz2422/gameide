---
title: Ledge Runner
level: Now You Can Make
after: el3-camera
time: 50 min
starter: empty
description: Your own platformer, from an empty one: you design the level, and choose who runs, what they collect, what's in the way, the goal, the look and the keys.
---
# Ledge Runner

You've drawn a level as text, made a player run and jump on it, and a camera that follows. Now make a whole platformer of **your own**, from an empty one.

It's a game where you run and jump across a level two screens wide, collect things, stomp or dodge what's in the way, and reach the goal at the far end. Fall down a gap and you start again. **Everything else is up to you.**

- **Who runs?** A fox, a knight, a robot, a jelly bean…
- **What's the ground made of?** Bricks, grass, clouds, cheese…
- **What do you collect?** Coins, stars, apples, socks…
- **What's in the way?** Snails, slimes, little robots…
- **What's the goal?** A flag, a door, a rocket…
- **Which keys?** The arrows, W A S D, Space to jump, or something else.
- **What does the level look like?** You draw it, as text.
- **What does it all look like?** Draw your own pictures, pick from the art library, or import your own.

Each step tells you **what** your game needs next and shows **one way** to do it. The code is an example: change the names, keys and numbers to fit your game. The checks don't care what you call things, only that your game does what the step asks.

---

## Your level

Make the ground, then the level made of it.

1. **The ground's picture.** Choose one way:
   - **Draw it:** make a new sprite, 32 × 32, and paint it in the sprite editor.
   - **The art library:** open **Library** and pick a picture.
   - **Your own file:** import a picture you made.
2. **Its object.** Make an object with that sprite, named for your game (*Wall*, *Brick*, *Cloud*…), and tick **Solid**: your runner will stop at anything solid.
3. **A wide room.** Open **Room1** and change its **Width** to **1280**, two screens wide.
4. **The level.** Make an object with **no sprite**, named *Level* or *Map*, and drag one into the room. Give it a **Create** event:

```python
rows = [
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "..................c.....................",
    ".................###....................",
    ".............c..........................",
    "............###.........................",
    ".........c......................c.......",
    "........###....................###......",
    "....c..........c.........e..............",
    "...###........###..##########...........",
    "P.....c..e..................c.....e...F.",
    "##########..########.....###############",
]
for row in range(len(rows)):
    for col in range(len(rows[row])):
        if rows[row][col] == "#":
            instance_create(col * 32, row * 32, "Wall")
```

Change `"Wall"` to your ground object's name.

**The map is yours.** This one is an example: draw your own level in it. Each row is 40 characters, one for each 32-pixel column of the room, and there are 15 rows. `#` is ground. The other letters come later: `P` is where your runner starts, `c` something to collect, `e` something in the way, and `F` the goal. Put them where you'd like them now, or choose your own letters as you go.

highlight: open-library

```check
some object has a sprite
room Room1 is at least 1280 wide
some object's create uses instance_create
```

---

## Your runner

1. **Its picture.** Draw it, pick it from the library, or import it, like your ground's.
2. **Its object.** Make an object with that sprite, named for your game (*Player*, *Fox*, *Knight*…).
3. **Made at the P.** In your level's **Create** event, add another choice inside the loop, under the line that makes the ground:

```python
        elif rows[row][col] == "P":
            instance_create(col * 32 + 4, row * 32 + 8, "Player")
```

The example runner is 24 pixels square, so `+ 4` puts it in the middle of its column and `+ 8` stands it on the floor. If yours is a different size, change them so it fits.

4. **How fast it's falling.** Give your runner a **Create** event:

```python
self.vy = 0
```

5. **Running and falling.** And a **Step** event. Here it runs with the arrow keys: change `"right"` and `"left"` to your keys, and `3` to how fast you'd like it to run.

```python
move = keyboard_check("right") - keyboard_check("left")
move_and_collide(move * 3, 0)
self.vy += 0.5
if move_and_collide(0, self.vy):
    self.vy = 0
```

`move_and_collide` moves until something solid is in the way, and gives back what it bumped into. Bumping into something while falling means you've landed, so `vy` goes back to 0.

highlight: add-event

```check
at least 2 objects have sprites
some object's step uses move_and_collide
holding a key moves something
```

---

## Jumping, and falling off

Add to the bottom of your runner's **Step** event, and fill in the blanks (`___`):

```python
on_ground = not place_free(self.x, self.y + 1)
if on_ground and keyboard_check(___):        # your jump key
    self.vy = ___                            # how strong a jump: minus goes up, like -9
if self.vy < 0 and not keyboard_check(___):  # the same jump key
    self.vy = max(self.vy, -3)
```

`place_free(self.x, self.y + 1)` asks: if the runner were one pixel lower, would it be clear? If not, it's standing on something. Letting go of the jump key early cuts the jump short, so a tap is a hop and holding is a leap.

Now write the last part yourself: if your runner falls below the bottom of the room (`room_height`), start the room again with `room_restart()`.

```quiz
Why is the jump only allowed when `on_ground` is true?
- [x] Otherwise you could jump again in mid-air, and fly up the screen
- [ ] So the runner falls faster
- [ ] `place_free` only works on the ground
```

highlight: code-editor

```check
some object's step uses place_free
some object's step uses room_height
some object's step uses room_restart
```

---

## Follow your runner

Play it and run right: you go off the screen.

Open **Room1**'s settings and tick **Camera**. Leave it 640 by 480, the window's size. Now the window shows only part of the room: `view_width` (640) is less than `room_width`.

Then make it follow your runner, your way. Add a line to your runner's **Create** event, and fill in the blank:

```python
camera_follow(self, ___)    # 1 sticks to the runner, 0.1 glides after it
```

highlight: room-camera

```check
after 1 second, view_width < room_width
some object's create uses camera_follow
```

---

## Things to collect

1. **Their picture and object**, named for your game (*Coin*, *Star*, *Apple*…).
2. **Made from the map.** In your level's loop, add a choice for their letter, and fill in where it goes:

```python
        elif rows[row][col] == "c":
            instance_create(___, ___, "Coin")    # the middle of the square: col * 32 + 16, and the same for row
```

3. **Counting them.** In your runner's **Create** event, write a line that starts `global_vars.score` at 0.
4. **Picking them up.** Add a **Collision** event to your runner, with the thing to collect. Fill in the blanks:

```python
global_vars.score += ___     # how much each one is worth
___.destroy()                # the one you touched: the other one in the collision
```

highlight: add-event

```check
after 1 second, global_vars.score >= 0
some object's collision uses score
some object's collision uses other
```

---

## What's in the way

1. **Their picture and object**, named for your game (*Crawler*, *Snail*, *Slime*…).
2. **Made from the map.** Write this choice in your level's loop yourself, like the one for the things you collect. Put them a little lower than the middle of the square, like `row * 32 + 20`, so they walk on the floor.
3. **Walking.** Give them a **Create** event:

```python
self.hspeed = ___      # how fast it walks: 1 is slow, 2 is quick
```

4. **Turning round.** And a **Step** event. It turns round at a wall, and at the edge of a drop, so it never walks off. Fill in the blank:

```python
ahead = self.x + sign(self.hspeed) * 14
if not place_free(ahead, self.y) or place_free(ahead, self.y + 16):
    self.hspeed = ___      # the other way: minus what it was
```

5. **Stomp, or be got.** Add a **Collision** event to your runner, with the thing in the way. Land on top and you stomp it; run into it and something bad happens. Fill in the blanks:

```python
if self.vy > 0 and self.y + 24 < other.y:
    other.destroy()
    self.vy = ___      # a bounce up off it, like -6
else:
    ___                # when it gets you: start again, with room_restart()
```

`self.y + 24` is the runner's feet, if it's 24 tall. Feet above the middle of the thing, while falling, is a stomp.

```quiz
`place_free(ahead, self.y + 16)` is True. What has your walker found?
- [x] The edge of a drop: there's no floor in front of it
- [ ] A wall in front of it
- [ ] The runner
```

highlight: add-event

```check
things move at 1 or more speeds
some object's step uses sign
some object's collision uses vy
some object's collision uses room_restart
```

---

## The goal

1. **Its picture and object**, named for your game (*Flag*, *Door*, *Rocket*…).
2. **Made from the map.** Write its choice in your level's loop yourself.
3. **Winning.** Add a **Collision** event to your runner, with the goal, that sets `global_vars.won` to `True`. And in your runner's **Create** event, start it as `False`. Write both yourself.
4. **Stop, and play again.** Once you've won, the runner stops and a key of your choice plays again. Fill in the key, and put these lines at the **top** of your runner's **Step** event:

```python
if global_vars.won:
    if keyboard_check_pressed(___):    # the key to play again
        room_restart()
    return
```

`return` ends the Step event there, so nothing below it runs: your runner stops.

highlight: add-event

```check
after 1 second, global_vars.won == False
some object's collision uses won
some object's step uses return
```

---

## On the screen

Make an object with **no sprite** to show how you're doing, name it (*Hud*, *Scoreboard*…), and drag one into the room. Give it a **Draw GUI** event. It draws in the window's own corner, wherever the camera has gone.

You choose the colour and the words. Fill in the blanks:

```python
draw_set_color(___)                        # a colour, like "white" or "yellow"
draw_text(10, 10, f"___ {global_vars.score}")
```

Then write the rest yourself: when `global_vars.won` is true, say that they made it, and which key plays again.

```quiz
Why does your score use a **Draw GUI** event, not a **Draw** event?
- [x] Draw GUI draws on the window, so the score stays in the corner when the camera moves
- [ ] Draw events can't draw text
- [ ] Draw GUI runs faster
```

highlight: add-objects

```check
some object's draw gui uses score
some object's draw gui uses won
game runs 2 seconds without errors
```

---

## You made your own platformer

Play it, then make it even more yours:

- A **second level**: another room, another map, and the goal takes you there with `room_goto`.
- **Springs**: a new letter for a block that throws you up with `self.vy = -14`.
- **Lives**, so a fall costs one instead of starting again.
- A **background**: a sky, a cave, a city. Paint one, or pick one from the library.
- **Sounds** for a jump, a stomp and a pick-up.
- A **timer**, so you can race your best time.
