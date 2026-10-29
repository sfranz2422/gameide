---
title: 1. Hello, Python
level: Python Basics
time: 10 min
starter: python-start
description: Your first lines of Python: print messages to the Console, and leave notes in your code.
---
# Hello, Python

**Python** is a programming language: a way of writing instructions a computer can follow. Games, websites and robots are written in it.

In these lessons you write small programs and see what they do. No game yet — just you, Python and the **Console**, where your program's messages appear. You'll see it under each step.

Each step says what to do, then **✔ Check my work** checks it. When it passes, **Next** opens the next step.

Type the code yourself. That's how you learn it.

---

## Where your code goes

On the left, under **Objects**, open **Main**. It has one event, **Create**, which runs once when the game starts. That's where you'll type.

There's already a line in it starting with `#`. That's a **comment**: a note for people, which Python skips.

highlight: resource-Main

```check
object Main exists
Main has event create
```

---

## Say hello

Under the comment, type:

```python
print("Hello, world!")
```

`print` shows a message in the Console. The words go inside the brackets, between quotes.

Press **Play**. Look in the **Console** box under this step: there's your message.

highlight: code-editor

```check
Main.create uses print
prints Hello, world!
```

---

## The quotes matter

Text in quotes is called a **string**. Python prints exactly what's between the quotes.

Add a second line under the first, with your own name in it:

```python
print("My name is Sam")
```

Play it. Python runs your lines **in order**, top to bottom, so the hello comes first.

````quiz
What does this print?
```py
print("Bye")
print("Hi")
```
- [x] Bye, then Hi on the line under it
- [ ] Hi, then Bye on the line under it
- [ ] Only Hi, because it comes last
````

```check
prints My name is
```

---

## Mistakes are normal

Take the closing quote off your last line, so it says `print("My name is Sam)`, and press **Play**.

Python can't read it, so it tells you which line is wrong. Every programmer sees messages like this all day. Read the message, then put the quote back and play it again.

```check
game runs 1 second without errors
```

---

## Numbers too

`print` can show numbers. Numbers don't need quotes. Add:

```python
print(7)
print(3 + 4)
```

Play it. Both lines print **7**: Python worked out `3 + 4` before printing it.

````quiz
This time the sum is inside quotes. What does it print?
```py
print("3 + 4")
```
- [x] 3 + 4
- [ ] 7
- [ ] An error, because 3 + 4 isn't words
````

```check
prints 7
Main.create uses +
```

---

## Notes for yourself

Add a comment of your own above the line that prints your name:

```python
# This line tells everyone who I am
```

Play it. Nothing new prints: comments are for people reading the code, not for Python.

```check
game runs 1 second without errors
```

---

## You wrote a program

You can now:

- show messages with `print("...")`
- print numbers, and sums Python works out for you
- read Python's error messages
- leave notes with `#`

Next: **2. Variables**, where your program starts remembering things.
