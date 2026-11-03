---
title: Gem Guard
level: Now You Can Make
after: el3-button
time: 50 min
starter: empty
description: A whole tower defense from an empty game: enemies march down a road to steal your gem, and you click to build the towers that stop them.
---
# Gem Guard

You've made things that spawn, shots that fly, explosions, buttons you can click, and objects that inherit from a parent. Now make a tower defense of your own, from an empty game.

In **Gem Guard**, enemies march along a road towards your gem. Each one that reaches it costs you a life. You spend gold to build towers beside the road, and you earn more gold for every enemy they stop.

Everything in this game is an **object**, and that's the point of it. When you want a new kind of enemy, you'll make one in four lines, because it inherits all the rest.

---

## The road

The road is a list of corners. Enemies will walk from one to the next, and the same list will draw the road, so changing a corner changes both.

Make a **script** called **road**:

```python
ROAD = [(-20, 80), (480, 80), (480, 240), (160, 240), (160, 400), (596, 400)]
```

Make an object called **Road**, with no sprite, and drag one into **Room1**. Its **Create** event puts it behind everything else:

```python
self.depth = 100
```

Its **Draw** event draws a thick line from each corner to the next:

```python
draw_set_color("#b08850")
for i in range(len(ROAD) - 1):
    a, b = ROAD[i], ROAD[i + 1]
    draw_line(a[0], a[1], b[0], b[1], 40)
```

highlight: folder-scripts

```check
script road exists
object Road exists
room Room1 has 1 Road
Road.draw uses draw_line
```

---

## An enemy

Add the **enemy** sprite and an object called **Enemy** with it. Don't put any in the room: the game will make them.

Its **Create** event is what makes this enemy this enemy: how far along the road it is, how fast it walks, and how tough it is.

```python
self.leg = 1
self.walk = 1.5
self.hp = 20
```

Its **Step** event heads for the next corner. `self.leg` says which one, and on reaching it, it goes on to the one after. Past the last corner, it's gone:

```python
if self.leg < len(ROAD):
    tx, ty = ROAD[self.leg]
    self.move_towards(tx, ty, self.walk)
    if point_distance(self.x, self.y, tx, ty) <= self.walk:
        self.leg += 1
else:
    self.destroy()
```

highlight: add-objects

```check
object Enemy exists
Enemy has sprite
Enemy.create uses walk
Enemy.step uses move_towards
```

---

## Where enemies come from

Make an object called **Gate**, with no sprite, and drag one into the room. Its **Create** event sets an alarm:

```python
self.alarm[0] = 30
```

Its **Alarm 0** event makes an enemy at the road's first corner, and sets the alarm again:

```python
instance_create(ROAD[0][0], ROAD[0][1], "Enemy")
self.alarm[0] = 60
```

Play it. A line of enemies marches along your road, round every corner.

```quiz
You add one more corner to the end of `ROAD`. What changes?
- [x] The road is drawn with it, and the enemies walk to it, with no other change
- [ ] The road is drawn with it, but you have to teach the enemies about it
- [ ] Nothing, until you change the Gate
```

highlight: code-editor

```check
object Gate exists
room Room1 has 1 Gate
Gate.alarm 0 uses instance_create
game runs 3 seconds without errors
```

---

## A tower

Add the **ship** sprite and an object called **Tower** with it. Drag one into the room beside the road, near the middle. Its **Create** event sets its numbers:

```python
self.cool = 0
self.reload = 30
self.reach = 140
self.damage = 7
```

Its **Step** event finds the nearest enemy, and if that's in reach and the tower has cooled down, fires at it:

```python
self.cool -= 1
target = instance_nearest(self.x, self.y, "Enemy")
if target is not None and self.cool <= 0:
    if point_distance(self.x, self.y, target.x, target.y) < self.reach:
        shot = instance_create(self.x, self.y, "Shot")
        shot.direction = point_direction(self.x, self.y, target.x, target.y)
        shot.speed = 8
        shot.damage = self.damage
        self.cool = self.reload
```

Add the **bullet** sprite and an object called **Shot** with it. A shot that misses shouldn't fly for ever, so its **Create** event sets an alarm:

```python
self.alarm[0] = 40
```

and its **Alarm 0** event:

```python
self.destroy()
```

Play it. The tower fires at each enemy going past, but the shots do nothing yet.

highlight: add-objects

```check
object Tower exists
room Room1 has 1 Tower
Tower.step uses instance_nearest
object Shot exists
Shot has event alarm 0
```

---

## Stopping them

Give **Shot** a **Collision with Enemy** event. The enemy loses what this shot does, and the shot is used up:

```python
other.hp -= self.damage
self.destroy()
```

Now the enemy has to notice. Put this at the very top of **Enemy**'s **Step** event:

```python
if self.hp <= 0:
    effect("explosion", self.x, self.y)
    self.destroy()
```

Play it. Enemies blow up as the tower hits them.

highlight: add-event

```check
Shot has event collision with Enemy
Enemy.step uses effect
game runs 3 seconds without errors
```

---

## The gem, gold and lives

Add the **gem** sprite and an object called **Gem** with it. Drag one to the end of the road, at the bottom right. Give it a **Collision with Enemy** event, so an enemy that gets there is gone, and costs you a life:

```python
global_vars.lives -= 1
other.destroy()
```

Make an object called **Hud**, with no sprite, and drag one into the room. Its **Create** event sets what you start with:

```python
global_vars.gold = 100
global_vars.lives = 10
```

Its **Draw GUI** event shows them:

```python
draw_set_color("white")
draw_text(10, 10, f"Gold {global_vars.gold}   Lives {global_vars.lives}")
```

An enemy pays when it's stopped. In **Enemy**'s **Step** event, add a line under the `effect` one, indented the same:

```python
    global_vars.gold += self.pay
```

And in **Enemy**'s **Create** event, say how much:

```python
self.pay = 10
```

````quiz
What's on the screen after these lines run, if gold was 100?
```py
global_vars.gold += 10
global_vars.gold += 10
```
answer: 120
````

highlight: code-editor

```check
object Gem exists
room Room1 has 1 Gem
Gem has event collision with Enemy
room Room1 has 1 Hud
Hud.draw_gui uses gold
Enemy.step uses gold
```

---

## Building by clicking

One tower won't be enough. Add the **wall** sprite and an object called **Spot** with it. Drag six **Spot**s into the room beside the road, where you'd like to be able to build.

A spot is a button, like the one you made before. Open **Spot**, press **Add event**, and under **Mouse** choose **Left Pressed**. If you can pay, the spot becomes a tower. A spot's **x** and **y** are its top left corner and a tower's are its middle, and the wall sprite is 32 across, so the tower goes 16 across and 16 down:

```python
if global_vars.gold >= 50:
    global_vars.gold -= 50
    instance_create(self.x + 16, self.y + 16, "Tower")
    self.destroy()
```

Play it. Click a spot, and a tower appears there and starts firing. That's every tower you'll ever build: each is an instance of **Tower**, with all its events.

highlight: add-event

```check
object Spot exists
room Room1 has at least 6 Spot
Spot has event left pressed
Spot.left pressed uses instance_create
```

---

## New enemies, in four lines

Here's what objects are for. Make an object called **Runner**, with the **enemy** sprite, and choose **Enemy** as its **Parent**. It now walks, explodes, pays and steals gems, without one line of that code.

Give it a **Create** event that only says what's different:

```python
super().on_create()
self.walk = 3
self.hp = 10
self.pay = 5
```

`super().on_create()` runs its parent's **Create** first, then these lines change what's different.

Now one more: an object called **Brute**, with the **enemy** sprite and **Enemy** as its **Parent**. Its **Create** event:

```python
super().on_create()
self.walk = 0.8
self.hp = 60
self.pay = 25
self.image_xscale = self.image_yscale = 1.5
```

highlight: object-parent

Now the Gate decides who to send. In **Gate**'s **Create** event, add how many are coming:

```python
self.left = 30
```

And in its **Alarm 0** event, replace the `instance_create` line with:

```python
self.left -= 1
if self.left % 5 == 0:
    kind = "Brute"
elif self.left % 3 == 0:
    kind = "Runner"
else:
    kind = "Enemy"
instance_create(ROAD[0][0], ROAD[0][1], kind)
```

Your shots hit Runners and Brutes, and your gem is robbed by them, with no change at all: to the game, they **are** Enemies.

```check
object Runner exists
Runner.create uses super
object Brute exists
Brute.create uses super
Gate.alarm 0 uses Runner
Gate.alarm 0 uses Brute
```

---

## Upgrades

Clicking a tower should make it better. Give **Tower** a **Left Pressed** event under **Mouse**:

```python
if global_vars.gold >= 60:
    global_vars.gold -= 60
    self.damage *= 2
    self.flash("yellow")
```

Because the shot takes its damage from the tower that fires it, this is all it takes.

```quiz
A tower with `damage` 7 is upgraded twice. How much does each of its shots do now?
answer: 28
```

highlight: add-event

```check
Tower has event left pressed
Tower.left pressed uses damage
game runs 2 seconds without errors
```

---

## Winning and losing

The Gate should stop when everyone's been sent, or when you've lost, and it should send them faster as it goes. In its **Alarm 0** event, replace the last line, `self.alarm[0] = 60`, with:

```python
if self.left > 0 and global_vars.lives > 0:
    self.alarm[0] = 20 + self.left * 2
```

You've won when nobody's left to come and nobody's still walking. Give **Gate** a **Step** event:

```python
if self.left <= 0 and instance_number("Enemy") == 0:
    global_vars.won = True
```

In **Hud**'s **Create** event, start from not having won:

```python
global_vars.won = False
```

Give **Hud** a **Step** event, so R starts again:

```python
if keyboard_check_pressed("r"):
    room_restart()
```

And at the bottom of its **Draw GUI** event, say how it ended:

```python
if global_vars.lives <= 0:
    draw_text(220, 220, "The gem is gone! Press R")
elif global_vars.won:
    draw_text(220, 220, "You saved the gem! Press R")
```

Play it through. Can you hold on to all ten lives?

```check
Gate.step uses instance_number
Hud.step uses room_restart
Hud.draw_gui uses won
game runs 2 seconds without errors
```

---

## You made Gem Guard

Ideas to make it yours:

- A new enemy, in four lines: a child of **Enemy** that's very fast and very weak, or very slow and very tough.
- A second kind of tower: a child of **Tower** with its own numbers. A slow one with a long reach?
- Waves: stop the Gate for a few seconds after every ten enemies.
- Turn each tower towards what it's firing at, with `image_angle`.
- A map of your own: change the corners in `ROAD`, and the road and the enemies follow.
