---
title: 5. Making Decisions
level: Python Basics
time: 15 min
starter: python-start
description: if, elif and else — code that runs only sometimes, which is what makes a game react.
---
# Making Decisions

Programs make decisions all the time. If the player touches a coin, add a point. If the lives run out, the game is over.

Open **Main** and its **Create** event, and type each step's code under what's there.

highlight: resource-Main

---

## True or False

A **comparison** is a question with a yes-or-no answer. Type:

```python
print(5 > 3)
print(2 == 7)
```

Play it: **True**, then **False**. `==`, with two equals signs, asks "are these equal?". One `=` stores a value, remember.

The others are `<`, `>=` (more than or equal), `<=` and `!=` (not equal).

highlight: code-editor

```check
prints True
prints False
```

---

## if

Add:

```python
score = 12
if score >= 10:
    print("You win!")
```

The line under `if` is pushed in by four spaces. That's how Python knows it belongs to the `if`: it runs only when the question's answer is True.

```check
Main.create uses if
prints You win!
```

---

## else

`else` is what happens when the answer is False. Add:

```python
lives = 0
if lives > 0:
    print("Keep playing")
else:
    print("Game over")
```

```check
Main.create uses else
prints Game over
```

---

## elif

With more than two choices, `elif` (short for *else if*) asks the next question. Add:

```python
points = 85
if points >= 90:
    print("Gold medal")
elif points >= 80:
    print("Silver medal")
else:
    print("Bronze medal")
```

Python asks each question in order and runs the first one that's True. Play it: **Silver medal**. Then change `85` to `95` and to `50`, and play it each time.

```check
Main.create uses elif
game runs 1 second without errors
```

---

## and, or

`and` needs both to be True. `or` needs at least one. Add:

```python
has_key = True
at_door = True
if has_key and at_door:
    print("The door opens")
```

```check
Main.create uses and
prints The door opens
```

---

## Your turn

Make a variable `age` with your age in it. If it's 13 or more, print **You're a teenager**; otherwise, print **You're not a teenager yet**.

```check
Main.create uses age
prints a teenager
```

---

## Your code can decide

You can now:

- compare values with `==`, `!=`, `<`, `>`, `<=` and `>=`
- run code only sometimes with `if`, `elif` and `else`
- use spaces at the start of a line to show what belongs to what
- join questions with `and` and `or`

Next: **6. Loops**.
