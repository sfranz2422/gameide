---
title: 4. Working with Text
level: Python Basics
time: 12 min
starter: python-start
description: Strings: join them, measure them, shout them, and put numbers inside them with f-strings.
---
# Working with Text

Text in Python is called a **string**: a string of letters, in quotes. Names, messages and scores on the screen are all strings.

Open **Main** and its **Create** event, and type each step's code under what's there.

highlight: resource-Main

---

## Strings can do things

Type:

```python
word = "python"
print(word.upper())
print(len(word))
```

`.upper()` gives the string in CAPITALS: **PYTHON**. `len` counts its letters: **6**.

highlight: code-editor

```check
Main.create uses upper
Main.create uses len
prints PYTHON
prints 6
```

---

## Times a string

`*` works on strings too. Add:

```python
print("ha" * 3)
print("-" * 20)
```

**hahaha**, and a line of 20 dashes: handy for tidy output.

```check
prints hahaha
prints --------------------
```

---

## Text and numbers don't mix

Add this line and play it:

```python
print("Score: " + 12)
```

Python stops: it can't add a number to a string. Turn the number into a string first with `str`. Change the line to:

```python
print("Score: " + str(12))
```

```quiz
Why does `print("Score: " + 12)` stop with an error?
- [x] `+` can't join a string and a number
- [ ] 12 is too big to print
- [ ] There must be a space after the colon
```

```check
Main.create uses str
game runs 1 second without errors
prints Score: 12
```

---

## f-strings

There's an easier way. Put an `f` before the quotes, and anything in `{ }` inside them is worked out and put in. Add:

```python
name = "Ana"
points = 12
print(f"{name} has {points} points")
```

Play it: **Ana has 12 points**. You can even do sums inside: `{points * 2}`.

````quiz
What does this print?
```py
points = 12
print(f"{points * 2} points")
```
- [x] 24 points
- [ ] {points * 2} points
- [ ] 12 * 2 points
````

```check
prints Ana has 12 points
```

---

## Your turn

Make variables for your favourite food and how many of it you could eat, and print a sentence about them with an f-string, such as **I could eat 4 pizzas**.

```check
prints I could eat
```

---

## You can work with text

You can now:

- change strings with `.upper()`, and measure them with `len`
- repeat them with `*`
- turn numbers into strings with `str`
- build sentences with f-strings

Next: **5. Making Decisions**.
