---
title: 6. Explosions
level: Game Elements 3: Advanced Techniques
time: 15 min
starter: space-5
description: Effects and screen shake when a rock goes, rocks that break into smaller rocks, and sparks when the ship's hit.
---
# Explosions

A rock that just vanishes feels flat. An **explosion**, a shake of the screen and the pieces flying apart make the same moment feel exciting. Game makers call that **juice**.

---

## Boom

Give **Rock** a **Destroy** event. It runs whenever a rock is destroyed, whatever destroyed it:

```python
effect("explosion", self.x, self.y)
```

`effect` draws a ready-made burst of particles. There's also `"sparkle"`, `"smoke"`, `"hit"` and more: look in **Docs** under **Effects**.

```quiz
When does a Rock's Destroy event run?
- [ ] Only when a bullet hits the rock
- [x] Whenever the rock is destroyed, whatever destroyed it
- [ ] Every step, until the rock is gone
```

highlight: add-event

```check
Rock has event destroy
Rock.destroy uses effect
game runs 2 seconds without errors
```

---

## Shake

Add to the Destroy event:

```python
camera_shake(4, 10)
```

The whole screen shakes by up to 4 pixels, calming down over 10 steps.

```check
Rock.destroy uses camera_shake
game runs 2 seconds without errors
```

---

## Break it up

Big rocks should break into two smaller ones. Add to the Destroy event:

```python
if self.image_xscale > 1.5:
    for i in range(2):
        r = instance_create(self.x, self.y, "Rock")
        r.image_xscale = self.image_xscale / 2
        r.image_yscale = self.image_yscale / 2
```

The loop runs twice, and each time makes a rock half the size. Each new rock picks its own direction in its Create event, so they fly apart. A half-size rock is too small to break again, so it's gone for good.

```quiz
The rocks start at an `image_xscale` of 3. Why don't the half-size pieces break up again?
- [ ] The loop only runs twice
- [x] Their `image_xscale` is 1.5, and 1.5 > 1.5 is False
- [ ] A rock made by `instance_create` has no Destroy event
```

```check
Rock.destroy uses for
game runs 2 seconds without errors
```

---

## Sparks

When a rock hits the ship, add sparks. In **Ship**'s **Collision with Rock** event, inside the `if`:

```python
    particles(self.x, self.y, count=20, color="orange")
```

`particles` makes a burst of your own: how many, what colour, and more if you look in the Docs.

```check
Ship.collision with Rock uses particles
game runs 2 seconds without errors
```

---

## Your turn: a pause for effect

`hit_pause(3)` freezes the whole game for 3 steps: a tiny jolt that makes a hit feel heavy. Add it to **Rock**'s **Destroy** event.

```check
Rock.destroy uses hit_pause
game runs 2 seconds without errors
```

---

## Juicy

Explosions, shakes, pieces and sparks: the game plays the same, but it feels completely different.

Next: **7. Pause Menu**.
