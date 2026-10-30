---
title: Alley Brawl
level: Now You Can Make
after: el3-strike
time: 50 min
starter: empty
description: A whole beat 'em up from an empty one: walk a long street, punch the thugs that close in from both sides, and clear it before your health runs out.
---
# Alley Brawl

You've made a strike that hits what's in front of you, a health bar, and a camera that follows. Now make a beat 'em up of your own, from an empty one.

In **Alley Brawl** you walk along a street three screens long. You can move up and down the pavement as well as along it. Thugs close in from both sides and stand beside you to throw punches. Punch them three times to knock them out. Clear the street before your health runs out.

---

## The street

Open **Room1** and change its **Width** to **1920**: three screens long.

Make an object called **Street**, with no sprite, and drag one into the room. Give it a **Draw** event. It paints the pavement across the whole room:

```python
draw_set_color("#3f3f46")
draw_rect(0, 240, room_width, 470)
draw_set_color("#71717a")
draw_rect(0, 236, room_width, 240)
```

A **Draw** event draws in the room, so the pavement scrolls with the camera. (A Hud's **Draw GUI** draws on the window, and doesn't.)

highlight: room-editor

```check
room Room1 is at least 1920 wide
object Street exists
Street has event draw
```

---

## The brawler

Add the **player** sprite and an object called **Player** with it, and drag one onto the pavement near the left end.

Give **Player** a **Create** event:

```python
self.facing = 1
global_vars.health = 100
```

And a **Step** event. Along the street is quicker than up and down it:

```python
dx = keyboard_check("right") - keyboard_check("left")
dy = keyboard_check("down") - keyboard_check("up")
self.x = clamp(self.x + dx * 3, 0, room_width - 24)
self.y = clamp(self.y + dy * 2, 240, 440)
if dx != 0:
    self.facing = dx
self.depth = -self.y
```

`clamp` keeps the brawler on the pavement, between 240 and 440 down the screen. `facing` remembers which way it last walked: 1 for right, -1 for left.

highlight: add-event

```check
room Room1 has 1 Player
Player.step uses clamp
after 1 second holding right, Player.x increased
after 1 second holding up, Player.y decreased
```

---

## Follow the brawler

Open **Room1**'s settings, tick **Camera**, leave it 640 by 480, and choose **Player** to **follow**.

The last line of Player's Step event, `self.depth = -self.y`, matters once there are thugs. Lower **depth** is drawn in front. Someone lower down the screen is nearer to you, so they should be drawn in front of someone further up it.

```quiz
The player is at y = 400 and a thug at y = 300, so the player's depth is -400 and the thug's -300. Which is drawn in front?
- [x] The player: -400 is lower, and the player is nearer the bottom of the screen
- [ ] The thug
- [ ] Whichever was made first
```

highlight: room-camera

```check
room Room1 camera follows Player
```

---

## Thugs

Add the **enemy** sprite and an object called **Thug** with it. Give **Thug** a **Create** event:

```python
self.hp = 3
self.cooldown = 0
```

And a **Step** event. When the player is within 400 pixels, the thug heads for a spot right beside them, on whichever side it's already on:

```python
self.depth = -self.y
player = instance_nearest(self.x, self.y, "Player")
if player and abs(player.x - self.x) < 400:
    if self.x > player.x:
        gx = player.x + 12 + 30
    else:
        gx = player.x + 12 - 30
    gy = player.y + 12
    self.x = approach(self.x, gx, 1.5)
    self.y = approach(self.y, gy, 1)
```

`approach(self.x, gx, 1.5)` moves `self.x` towards `gx` by 1.5 at most, and stops exactly on it.

Drag at least six thugs onto the pavement, spread along the street, a few on each screen.

highlight: add-objects

```check
object Thug exists
room Room1 has at least 6 Thug
Thug.step uses approach
after 3 seconds holding right, Thug.x changed
```

---

## Punch

Add the **slash** sprite and an object called **Punch** with it. Give **Punch** a **Create** event, so it lasts a moment:

```python
self.alarm[0] = 6
```

An **Alarm 0** event:

```python
self.destroy()
```

And a **Collision with Thug** event. The thug loses a point of `hp` and is knocked back the way the punch faces:

```python
other.hp -= 1
other.x += self.image_xscale * 24
other.flash("white", 6)
self.destroy()
if other.hp <= 0:
    effect("hit", other.x, other.y)
    other.destroy()
```

The punch destroys itself as soon as it lands. It would touch the thug on all 6 of its steps otherwise, and one punch would take 6 points.

Now throw it. At the bottom of **Player**'s **Step** event, Z makes a punch in front of the brawler, facing its way:

```python
if keyboard_check_pressed("z"):
    p = instance_create(self.x + 12 + self.facing * 22, self.y + 12, "Punch")
    p.image_xscale = self.facing
```

highlight: add-event

```check
object Punch exists
Punch has event collision with Thug
Player.step uses instance_create
```

---

## They hit back

A thug standing right beside you throws a punch, then waits a second before the next. Add these lines to the bottom of **Thug**'s **Step** event, inside the `if`, pushed in like the lines above them:

```python
    if self.cooldown > 0:
        self.cooldown -= 1
    elif point_distance(self.x, self.y, gx, gy) < 6:
        global_vars.health -= 10
        player.flash("red", 10)
        self.cooldown = 60
```

Make an object called **Hud**, with no sprite, and drag one into the room. Its **Draw GUI** event draws the health bar from **5. Health Bars**:

```python
draw_set_color("dkgray")
draw_rect(10, 10, 210, 22)
draw_set_color("lime")
draw_rect(10, 10, 10 + global_vars.health * 2, 22)
```

```quiz
How long does it take one thug, beside you the whole time, to take all 100 of your health?
- [x] About 10 seconds: 10 health a hit, one hit every 60 steps
- [ ] 1 second
- [ ] 100 seconds
```

highlight: add-objects

```check
Thug.step uses cooldown
room Room1 has 1 Hud
Hud.draw gui uses draw_rect
```

---

## Knocked out, or cleared

When your health is gone, the brawler stops and Enter plays again. At the **top** of **Player**'s **Step** event:

```python
if global_vars.health <= 0:
    if keyboard_check_pressed("enter"):
        room_restart()
    return
```

And at the bottom of **Hud**'s **Draw GUI** event, tell the player how it went. `instance_number("Thug")` is how many thugs are left:

```python
draw_set_color("white")
if global_vars.health <= 0:
    draw_text(220, 220, "Knocked out! Enter to play again")
elif instance_number("Thug") == 0:
    draw_text(250, 220, "Street cleared!")
```

highlight: code-editor

```check
Player.step uses room_restart
Hud.draw gui uses instance_number
game runs 2 seconds without errors
```

---

## You made Alley Brawl

Ideas to make it yours:

- A boss at the end of the street with 10 `hp` and a health bar of its own.
- A kick on X that's slower but knocks thugs twice as far.
- Food on the pavement that gives health back.
