---
title: 4. Delay Timer
level: Game Elements 3: Advanced Techniques
time: 15 min
starter: space-3
description: Wait before something can happen again — a rate of fire, and a moment of safety after a hit — with alarms.
---
# Delay Timer

Lots of things in games need a **delay**: a gun that can only fire so fast, a moment of safety after you're hit, a door that closes after a while. An **alarm** is a delay timer: set it, and its event runs that many steps later.

---

## Hold to fire

Pressing Space for every shot is tiring. Let the player hold it, with a short delay between shots. In **Ship**'s **Create** event, add:

```python
self.can_fire = True
```

Then change the firing at the end of the **Step** event to:

```python
if keyboard_check("space") and self.can_fire:
    b = instance_create(self.x, self.y, "Bullet")
    b.direction = self.image_angle
    b.image_angle = self.image_angle
    b.speed = 8
    self.can_fire = False
    self.alarm[0] = 10
```

And give **Ship** an **Alarm 0** event, which lets it fire again 10 steps later:

```python
self.can_fire = True
```

```quiz
Why does the Step event set `self.can_fire = False` right after making a bullet?
- [x] So no more bullets come until Alarm 0 sets it back to True
- [ ] So the bullet knows which way to fly
- [ ] It starts the alarm counting down
```

highlight: code-editor

```check
Ship has event alarm 0
Ship.step uses can_fire
game runs 2 seconds without errors
```

---

## Safe for a moment

When a rock hits the ship, it should get a moment to escape before it can be hit again. In **Ship**'s **Create** event, add:

```python
self.safe = False
```

Give **Ship** a **Collision with Rock** event:

```python
if not self.safe:
    self.safe = True
    self.alarm[1] = 120
    other.destroy()
```

and an **Alarm 1** event, to end the safe time two seconds later:

```python
self.safe = False
```

So you can see when it's safe, add this to the end of the **Step** event:

```python
if self.safe:
    self.image_alpha = 0.4
else:
    self.image_alpha = 1
```

```quiz
What does `if not self.safe:` stop from happening?
- [x] A rock hitting the ship again while it's still in its safe time
- [ ] The ship firing while it's see-through
- [ ] Alarm 1 going off
```

```check
Ship has event collision with Rock
Ship has event alarm 1
Ship.step uses image_alpha
game runs 2 seconds without errors
```

---

## Your turn: three seconds

Make the safe time last **three** seconds instead of two. How many steps is that?

```check
game runs 2 seconds without errors
```

---

## Timing

Two alarms, two delays: one for firing, one for safety. An alarm's number is in steps, and there are 60 steps in a second.

Next: **5. Health Bars**.
