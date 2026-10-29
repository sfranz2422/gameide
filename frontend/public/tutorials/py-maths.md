---
title: 3. Numbers and Maths
level: Python Basics
time: 10 min
starter: python-start
description: Add, take away, times and divide, and the sums games need: how many whole times something fits, and what's left over.
---
# Numbers and Maths

Computers are very fast calculators. Every game does maths all the time: moving things, counting points, timing levels.

Open **Main** and its **Create** event, and type each step's code under what's there.

highlight: resource-Main

---

## The four sums

Type:

```python
print(6 * 7)
print(10 - 4)
print(100 / 8)
```

`*` is times and `/` is divide. Play it. `100 / 8` gives **12.5**: dividing can give a number with a decimal point.

highlight: code-editor

```check
prints 42
prints 12.5
```

---

## Brackets first

Python does `*` and `/` before `+` and `-`, like in maths class. Add:

```python
print(2 + 3 * 4)
print((2 + 3) * 4)
```

The first is **14**: times first. The brackets in the second make Python add first, so it's **20**.

````quiz
What does this print?
```py
print(10 - 2 * 3)
```
answer: 4
answer: four
````

```check
prints 14
prints 20
```

---

## Whole times, and what's left

Say you have 17 sweets to share between 5 friends. Add:

```python
sweets = 17
print(sweets // 5)
print(sweets % 5)
```

`//` divides and keeps only the whole number: each friend gets **3**. `%` gives what's left over: **2** sweets.

```check
Main.create uses //
Main.create uses %
prints 3
```

---

## Powers

`**` is "to the power of". Add:

```python
print(2 ** 10)
```

That's 2 times itself 10 times: **1024**.

```check
prints 1024
```

---

## Seconds into minutes

Games count time in seconds. Turn 135 seconds into minutes and seconds:

```python
time = 135
print(time // 60, "minutes", time % 60, "seconds")
```

Play it: **2 minutes 15 seconds**. Now change `135` to another number and work out the answer before you press Play.

````quiz
Work it out before you try it: what does this print?
```py
time = 200
print(time // 60, "minutes", time % 60, "seconds")
```
- [x] 3 minutes 20 seconds
- [ ] 3.33 minutes 20 seconds
- [ ] 3 minutes 2 seconds
````

```check
Main.create uses time
prints minutes
prints seconds
```

---

## You can do maths

You can now:

- use `+`, `-`, `*` and `/`
- use brackets to choose what happens first
- split things up with `//` and `%`
- work out powers with `**`

Next: **4. Working with Text**.
