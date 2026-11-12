---
title: 8. Online Rooms
level: Game Elements 2: Adding to the Fun
time: 25 min
starter: dodge2-7
description: Play your published game with a friend on another computer: send where you are, draw where they are, and shout when you fire.
---
# Online Rooms

Lesson 5 put two players on one keyboard. Here you and a friend each play on your **own computer**, in the same online room, and each of you sees the other moving about the screen.

A room is something a published game has. Your game asks for one before it starts, as soon as its code uses a `net_` function. One player makes the room and gets a four-letter code, and the others type that code to join.

You'll need a **partner** for the end of the lesson. Each account is one player in a room, so two tabs on your own account would only show you once. Build the game on your own first. In the editor every `net_` function quietly does nothing, so you can play and test as usual.

---

## Send where you are

Each game in a room tells the others where its player is, every step. `net_send` does that: you give it a dict of names and values, and the others can read them.

Only **Player 1** goes online. Player 2 is your friend on the same keyboard, and both of them run Player's Step event, so it needs to check which one it is. Player 1 is the one on gamepad 0.

Add this to the end of **Player**'s **Step** event:

```python
if self.pad == 0:
    net_send({"x": self.x, "y": self.y})
```

Press **Play**. Nothing looks different, because the game isn't in a room yet.

highlight: code-editor

```check
Player.step uses net_send
game runs 2 seconds without errors
```

---

## See the others

`net_players()` is a list of everyone else in the room, each with what their game sent. So `p.x` is the `x` they sent.

Things arrive a few times a second, and a little late. If you drew them at `p.x` they'd jump about. Draw them at `p.draw_x` and `p.draw_y` instead: their position, smoothed so they glide between updates.

Make a new object called **Others**, with **no sprite**, and drag one into **Room1**. Give it a **Draw** event:

```python
draw_set_alpha(0.5)
for p in net_players():
    if p.draw_x is not None:
        draw_sprite("player", 0, p.draw_x, p.draw_y)
```

`draw_set_alpha(0.5)` draws them see-through, so you can tell them from yourself. Someone still on the title screen hasn't sent where they are yet, so their `draw_x` is `None`, and the `if` skips them.

highlight: folder-objects

```check
object Others exists
room Room1 has 1 Others
Others.draw uses net_players
game runs 2 seconds without errors
```

---

## Play together

Press **Publish** and choose **Anyone with the link**. If your game is already published from the last lesson, publish it again so the link has the new version.

Open your game's link. You both need to be signed in, so the room knows your names. Instead of Play, the game now shows a lobby:

- **Make a room** gives you a four-letter code, shown above the game.
- Your partner opens **your** link, types the code and presses **Join**.
- **Play alone** plays as before, with no room.

Both of you start the game. Move about with the arrows: your partner sees a see-through you, moving where you move.

Each of you still has your own enemies, coins and score. What's shared is only what your games send each other, and so far that's just where Player 1 is.

highlight: publish

```quiz
Why does Others draw each player at `p.draw_x`, not at `p.x`?
- [x] Their `x` arrives a few times a second and a little late, and `draw_x` glides between the updates
- [ ] `p.x` is where you are, not where they are
- [ ] `p.x` only works in the editor
```

---

## Keep them moving

Between updates, the smoothing can carry each player on the way they were going, if their game says how fast that is. Send it as `vx` and `vy`: how far they move each step, across and down.

Player's Step already works this out: it moves by `move_x * speed` and `move_y * speed`. Change the `net_send` line at the end of **Player**'s **Step** event to:

```python
if self.pad == 0:
    net_send({"x": self.x, "y": self.y, "vx": move_x * speed, "vy": move_y * speed})
```

Publish again and play with your partner. They move more smoothly on your screen, even if the network is slow.

```check
Player.step uses vx
game runs 2 seconds without errors
```

---

## Shots across the room

`net_send` is for something that's true all the time, like where you are. For something that happens once, like a shot, use `net_shout`: it sends a message to everyone else in the room, once.

In **Player**'s **Step** event, shout where each shot starts, right after the line that makes the bullet:

```python
    instance_create(self.x + 24, self.y + 12, "Bullet")
    net_shout({"x": self.x + 24, "y": self.y + 12})
    self.cooldown = 15
```

Every other game hears it with `net_messages()`, a list of the messages that arrived this step. Each message's `.data` is what was shouted. Give **Others** a **Step** event that fires a bullet from the same place:

```python
for m in net_messages():
    instance_create(m.data["x"], m.data["y"], "Bullet")
```

Publish and play together. Your partner's shots fly across your screen too, and they knock back your enemies and score for you. You're on the same team.

```quiz
Why does the shot use `net_shout`, but your position uses `net_send`?
- [x] A shot happens once, but where you are is true all the time and changes every step
- [ ] `net_send` can only send numbers called x and y
- [ ] `net_shout` is faster, so it's only used for bullets
```

```check
Player.step uses net_shout
Others.step uses net_messages
game runs 2 seconds without errors
```

---

## Your turn: names

Every player in `net_players()` has a `.name`: their first name, as the room knows them.

In **Others**' **Draw** event, write each player's name just above them with `draw_text`. A good place is 20 pixels above where you draw their sprite.

```check
Others.draw uses draw_text
game runs 2 seconds without errors
```

---

## Who's in charge

In your game, each computer keeps its own enemies and score. In some games everyone must agree: who's "it" in a game of tag, or who wins a vote. If every game decided for itself, they'd disagree.

So one game is in charge. `net_host()` is the number of that player (the room's maker, while they're there), and `net_me().number` is yours. When they're the same, your game is the one that decides, and it tells the others with `net_shout`.

A secret, like a hidden role or a hand of cards, goes to one player only with `net_tell(number, message)`. Nobody else's game gets it.

```quiz
type: match
Match each one to what it's for:
- net_send -> what's true about you all the time, like where you are
- net_shout -> something that happens once, sent to everyone
- net_tell -> a secret, sent to one player only
- net_host -> which game decides, so every game agrees
```

---

## Together

Your game is online. Every player sends what's true about them, draws everyone else from `net_players()`, and shouts what happens once.

Next: **Game Elements 3: Advanced Techniques**.
