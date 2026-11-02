# Zoomtown Cup: picture prompts for Gemini

The eighth showcase game: a cartoon kart racer seen from just behind the kart.

Every picture already has a stand-in drawn by `build.py`, so the game plays
without any of these. A Gemini picture saved to `~/Downloads/kart/` **under the
name below** replaces its stand-in the next time the game is built (`python3
showcase/kart/build.py`). They stay out of the repository. The build stretches
each picture to the size given here, so ask for that shape.

Gemini tends to answer with one sheet of many pictures, under its own file names.
`cut_sheets.py` cuts those three sheets (the nine karts, the hedges and trees, the
sky) into the names below; look at the sheet first, because which drawing is which
view is listed by hand at the top of it.

**The track is never a picture.** The build paints it from the numbers the karts
drive on (`game/_1tracks.py`), so the road you see is the road you're on.

## How to keep them all in one style

1. **One Gemini chat for everything.** Make `kart_view_0` first, then attach it
   to every later prompt with: *"The same kart and driver, in exactly the same
   art style, outlines, palette and lighting as the attached picture."*
2. **No words, no numbers, no logos** anywhere: the game writes its own.
3. **Karts, bushes and trees go on flat magenta (#FF00FF)**, nothing else behind
   them, no shadow on the ground (the game draws the shadow): the build cuts the
   magenta away.
4. **The kart must be bright pure red, and the helmet too, and nothing else
   red.** Every other racer is that picture with its red changed to their colour
   (`repaint` in build.py), so an orange-ish red won't repaint, and red trim
   would change with it. Skin, tyres and the blue overalls stay as they are.
5. **Make the kart the same size and in the same place in all nine:** its wheels
   on one line, about a tenth of the way up from the bottom.

## The style (start every prompt with this)

> Bright, friendly cartoon game art for a kart racing game: clean bold dark
> outlines, flat colours with one soft shade, chunky rounded shapes, cheerful
> saturated palette. No text, no letters, no numbers, no logos, no border.

## The kart: nine views (96 × 72, on flat magenta)

A small open go-kart with four fat black tyres, a low bright red body, a little
rear wing, and a driver in blue overalls and a bright red full-face helmet with a
dark visor. Seen from slightly above, the same height in every picture, the
camera about a quarter of the way up from level. Ask for it as a *"4:3 picture"*.

The other seven views are these mirrored, so only these nine are needed:

- **`kart_view_0`** — *"…seen exactly from behind."*
- **`kart_view_1`** — *"…seen from behind, turned a little so its nose points a
  little to the left of the picture."*
- **`kart_view_2`** — *"…seen from behind and to the right, its nose pointing
  halfway to the left."*
- **`kart_view_3`** — *"…mostly side on, its nose pointing left and a little away
  from us."*
- **`kart_view_4`** — *"…exactly from the side, its nose pointing left."*
- **`kart_view_5`** — *"…mostly side on, its nose pointing left and a little
  towards us."*
- **`kart_view_6`** — *"…seen from the front and to the left, its nose pointing
  halfway between left and straight at us."*
- **`kart_view_7`** — *"…seen from the front, turned a little so its nose points a
  little to the left of us."*
- **`kart_view_8`** — *"…seen exactly from the front, facing us."*

## Beside the road (on flat magenta)

Fill the picture's width: bushes join up into a hedge.

- **`bush_0`, `bush_1`, `bush_2`** — 192 × 124. *"A long low round-topped green
  hedge, filling the whole width of the picture, flat along the bottom edge."*
  Three versions, a little different.
- **`tree_0`, `tree_1`, `tree_2`** — 128 × 172. *"One round leafy cartoon tree with
  a short brown trunk, the trunk's foot in the middle of the bottom edge."* Three
  versions, a little different.

## The sky

- **`sky_0`** — 1024 × 118, no magenta. *"Seamless horizontally tiling, so its left
  and right edges join up: a bright blue summer sky with puffy cartoon clouds,
  and soft green and blue hills along the bottom edge. A wide thin strip."*
