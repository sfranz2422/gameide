---
title: 7. Lists
level: Python Basics
time: 15 min
starter: python-start
description: Lots of values in one variable — an inventory, a high-score table — and how to loop through them.
---
# Lists

A **list** keeps lots of values in one variable, in order: everything in a backpack, all the high scores, every enemy on a level.

Open **Main** and its **Create** event, and type each step's code under what's there.

highlight: resource-Main

---

## Make a list

Type:

```python
backpack = ["sword", "shield", "potion"]
print(backpack)
print(backpack[0])
```

A list goes in square brackets, with commas between its values. `backpack[0]` is the **first** one. Python counts from 0, so `backpack[1]` is the shield.

highlight: code-editor

```check
Main.create uses backpack
prints sword
```

---

## Add to it

Add:

```python
backpack.append("map")
print(len(backpack))
print(backpack[-1])
```

`.append` puts something on the end. `len` counts the list: **4**. And `[-1]` is the **last** one: **map**.

```check
Main.create uses append
prints map
```

---

## Loop through it

`for` can go through a list, one value at a time. Add:

```python
for item in backpack:
    print("I have a", item)
```

```check
prints I have a potion
prints I have a map
```

---

## Is it in there?

`in` asks whether a list holds something. Add:

```python
if "potion" in backpack:
    print("Drink the potion!")
```

```check
prints Drink the potion!
```

---

## Lists of numbers

Python can find the biggest, the smallest and the total of a list of numbers. Add:

```python
scores = [30, 70, 20]
print(max(scores), min(scores), sum(scores))
```

Play it: **70 20 120**.

```check
Main.create uses max
prints 70 20 120
```

---

## Pick one at random

Games love random things. Python's `random` module can pick from a list. Add:

```python
import random
print(random.choice(backpack))
```

Play it a few times: it picks a different thing each time.

```check
Main.create uses random
Main.create uses choice
game runs 1 second without errors
```

---

## You can use lists

You can now:

- keep lots of values in one list, and get one by its number
- add to a list, and count it
- loop through a list, and ask what's in it
- find the biggest, smallest and total
- pick something at random

Next: **8. Functions**.
