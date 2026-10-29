---
title: 3. Spawning and Destroying
level: Game Elements 3: Advanced Techniques
time: 15 min
starter: space-2
description: Rocks that drift, more of them on a timer, bullets made where the ship points, and both destroyed when they meet.
---
# Spawning and Destroying

Most of what's on screen in a game wasn't put there by hand. It's **spawned**: made by the game's code while it runs, and **destroyed** when it's done.

---

## Rocks

Give **Rock** a **Create** event:

```python
import random
self.image_xscale = 3
self.image_yscale = 3
self.direction = random.randint(0, 359)
self.speed = random.uniform(1, 2.5)
```

`image_xscale` and `image_yscale` make the sprite three times as big. `random.uniform` is a random number with decimals. Each rock drifts off its own way.

Give it a **Step** event that wraps it round the edges, like the ship:

```python
self.x = self.x % room_width
self.y = self.y % room_height
```

Then drag two rocks into the room.

highlight: add-event

```check
Rock has event create
room Room1 has at least 2 Rock
after 1 second, Rock.x changed
```

---

## A spawner

Make an object called **Spawner**, with no sprite, and drag one into the room. Its job is to make a new rock every two seconds. Give it a **Create** event:

```python
self.alarm[0] = 120
```

and an **Alarm 0** event:

```python
import random
x = random.choice([0, room_width])
y = random.randint(0, room_height)
instance_create(x, y, "Rock")
self.alarm[0] = 120
```

`random.choice` picks from a list: the left edge or the right. An object with no sprite is invisible, but its code still runs.

```quiz
Why does the Alarm 0 event set `self.alarm[0] = 120` again at its end?
- [x] So it goes off again two seconds later, and rocks keep coming
- [ ] So the new rock waits two seconds before it moves
- [ ] So the first rock is made sooner
```

highlight: add-objects

```check
object Spawner exists
room Room1 has 1 Spawner
Spawner has event alarm 0
game runs 3 seconds without errors
```

---

## Fire the way you face

At the end of **Ship**'s **Step** event:

```python
if keyboard_check_pressed("space"):
    b = instance_create(self.x, self.y, "Bullet")
    b.direction = self.image_angle
    b.image_angle = self.image_angle
    b.speed = 8
```

`instance_create` gives back the new bullet, so you can set **its** variables: `b.direction` is the bullet's direction, not the ship's.

And give **Bullet** an **Outside Room** event, so ones that miss are destroyed:

```python
self.destroy()
```

```check
Ship.step uses instance_create
Bullet has event outside room
game runs 2 seconds without errors
```

---

## Hit

Give **Bullet** a **Collision with Rock** event:

```python
other.destroy()
self.destroy()
```

Both are gone: the rock it hit, and the bullet itself.

```quiz
In Bullet's Collision with Rock event, what is `other`?
- [x] The rock the bullet hit
- [ ] The bullet itself
- [ ] The ship that fired the bullet
```

```check
Bullet has event collision with Rock
Bullet.collision with Rock uses destroy
game runs 2 seconds without errors
```

---

## Your turn: count them

Give **Spawner** a **Draw GUI** event that shows how many rocks there are, under the ship's speeds: `instance_number("Rock")` counts them. Draw it at `(10, 30)`.

```check
Spawner.draw gui uses instance_number
game runs 2 seconds without errors
```

---

## Made and unmade

Rocks are spawned on a timer, bullets when you fire, and both destroyed when they're done.

Next: **4. Delay Timer**.
