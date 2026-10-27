---
title: 6. Loops
level: Python Basics
time: 15 min
starter: python-start
description: for and while — doing something again and again without typing it again and again.
---
# Loops

A **loop** runs the same code again and again. Instead of typing `print` a hundred times, you write it once and tell Python how many times.

Open **Main** and its **Create** event, and type each step's code under what's there.

highlight: resource-Main

---

## for and range

Type:

```python
for i in range(5):
    print(i)
```

Play it: **0 1 2 3 4**, each on its own line. `range(5)` counts five numbers starting at 0, and `i` holds each one in turn. The pushed-in line is what repeats.

highlight: code-editor

```check
Main.create uses for
Main.create uses range
prints 4
```

---

## Start and end

`range` can start somewhere else. It stops *before* the end number. Add:

```python
for n in range(1, 4):
    print("Level", n)
```

That prints **Level 1**, **Level 2**, **Level 3**.

```check
prints Level 3
```

---

## Adding up

A loop and a variable together can add things up. Add:

```python
total = 0
for n in range(1, 11):
    total += n
print("Total:", total)
```

`print` isn't pushed in, so it runs once, after the loop. Play it: 1 + 2 + … + 10 is **55**.

```check
prints Total: 55
```

---

## Counting down

A third number in `range` is the step: `-1` counts backwards. Add:

```python
for t in range(3, 0, -1):
    print(t)
print("Go!")
```

```check
prints Go!
```

---

## while

A `while` loop keeps going **while** its question is True. Add:

```python
lives = 3
while lives > 0:
    print("Lives left:", lives)
    lives -= 1
print("Game over")
```

Each time round, `lives -= 1` takes one away. When it reaches 0 the question is False, and the loop stops.

Be careful: if nothing ever made the question False, it would never stop.

```check
Main.create uses while
prints Lives left: 1
prints Game over
```

---

## Your turn

Use a loop to print the 7 times table, from **7 x 1 = 7** to **7 x 10 = 70**. An f-string helps: `f"7 x {n} = {7 * n}"`.

```check
prints 7 x 10 = 70
```

---

## Your code can repeat

You can now:

- repeat code with `for` and `range`
- count from any number, and backwards
- add things up with a loop
- keep going while something is True, with `while`

Next: **7. Lists**.
