---
title: 2. Variables
level: Python Basics
time: 10 min
starter: python-start
description: Give a value a name, change it, and print it — how a program remembers a score, a name or a number of lives.
---
# Variables

A **variable** is a name for a value, like a labelled box you can put something in. Games are full of them: the score, the number of lives, the player's name.

Open **Main** and its **Create** event, and type each step's code under what's already there.

highlight: resource-Main

---

## Make a variable

Type:

```python
score = 0
print(score)
```

`score = 0` makes a variable called `score` and puts `0` in it. The `=` means "store this", not "is equal to".

Then `print(score)` prints what's **in** the box, not the word *score*. Press **Play**.

highlight: code-editor

```check
Main.create uses score
prints 0
```

---

## Change it

A variable can change. That's why it's called a variable. Add:

```python
score = score + 10
print(score)
```

Read the first line right to left: take what's in `score`, add 10, and store the answer back in `score`. Play it: first **0**, then **10**.

````quiz
What does this print?
```py
score = 5
score = score + 2
print(score)
```
answer: 7
answer: seven
````

```check
prints 10
```

---

## A shortcut

Adding to a variable happens so often that Python has a short way to write it. Add:

```python
score += 5
print(score)
```

`score += 5` means the same as `score = score + 5`. Play it, and you'll see **15**. There's also `-=` for taking away.

```check
Main.create uses +=
prints 15
```

---

## Text in a variable

A variable can hold text too. Add, with your own name between the quotes:

```python
name = "Sam"
print("Hello, " + name)
```

`+` between two strings joins them into one.

```check
Main.create uses name
prints Hello,
```

---

## Two things in one print

Put a comma between things you print, and Python puts a space between them. Add:

```python
lives = 3
print("Lives:", lives)
```

```check
Main.create uses lives
prints Lives: 3
```

---

## Names have rules

Change your last line to `print("Lives:", Lives)`, with a capital **L**, and play it.

Python stops: **name 'Lives' is not defined**. Capitals count, so `Lives` and `lives` are different names. Change it back to a small **l**.

Variable names can use letters, numbers and `_`, can't start with a number, and can't have spaces: `high_score` works, `high score` doesn't.

```quiz
Which of these can be a variable name?
- [x] high_score
- [ ] high score
- [ ] 2nd_score
```

```check
game runs 1 second without errors
```

---

## You can remember things

You can now:

- make a variable with `=`, and print what's in it
- change it with `=`, `+=` and `-=`
- keep text or numbers in one
- choose names Python accepts

Next: **3. Numbers and Maths**.
