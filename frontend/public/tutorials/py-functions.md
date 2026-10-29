---
title: 8. Functions
level: Python Basics
time: 15 min
starter: python-start
description: Make your own commands with def: give them inputs, and get answers back with return.
---
# Functions

You've used lots of functions already: `print`, `len`, `range`. A **function** is a named piece of code you can run whenever you like, just by using its name. Now you'll make your own.

Open **Main** and its **Create** event, and type each step's code under what's there.

highlight: resource-Main

---

## def

Type:

```python
def cheer():
    print("Hip hip hooray!")

cheer()
cheer()
```

`def` makes a function called `cheer`. The pushed-in line is what it does. Making it doesn't run it: `cheer()`, with brackets, does. Play it: two cheers.

```quiz
What would happen if you took out both `cheer()` lines and played it?
- [ ] It would cheer once
- [ ] It would cheer twice, the same as before
- [x] Nothing would be printed
```

highlight: code-editor

```check
Main.create uses def
prints Hip hip hooray!
```

---

## Give it something

A function can take an input, called a **parameter**, in its brackets. Add:

```python
def greet(name):
    print(f"Hi, {name}!")

greet("Ana")
greet("Leo")
```

Each time, `name` is whatever you passed in.

```check
prints Hi, Ana!
prints Hi, Leo!
```

---

## Get an answer back

`return` hands an answer back to whoever used the function. Add:

```python
def double(n):
    return n * 2

print(double(21))
```

`double(21)` becomes the answer, **42**, and `print` shows it.

```check
Main.create uses return
prints 42
```

---

## More than one input

Separate parameters with commas. Add:

```python
def area(width, height):
    return width * height

print("Area:", area(3, 4))
```

````quiz
What does this print?
```py
print(area(2, 5) + 1)
```
answer: 11
answer: eleven
````

```check
prints Area: 12
```

---

## Your turn

Write a function `bigger(a, b)` that returns whichever number is bigger. You'll need an `if` inside it. Then print `bigger(8, 3)` and `bigger(2, 9)`:

```python
print(bigger(8, 3), bigger(2, 9))
```

```check
Main.create uses bigger
prints 8 9
```

---

## You can make functions

You can now:

- make your own functions with `def`
- give them inputs (parameters)
- get answers back with `return`

That's the core of Python. Next: **9. Python in a Game**, where it all comes together on the screen.
