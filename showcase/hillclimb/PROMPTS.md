# Ridgeline Rally: picture prompts for Gemini

The sixth showcase game: a side-view hill-climb driving game. A cartoon jeep
with a driver in a cap drives up long bumpy roads (countryside, desert, the
moon), flips off ramps, collects coins and fuel cans, and must never land on
its head. Between runs, a garage sells upgrades and a monster truck.

Every picture already exists, drawn by `build.py` with Pillow. A Gemini
picture saved to `~/Downloads/hillclimb/` **under the name below** replaces
the drawn one the next time the game is built (`python3
showcase/hillclimb/build.py`); any picture not there stays as drawn. They
stay out of the repository. The build stretches each picture to the size
given here, so ask for that shape.

**The road is never a picture.** The game draws it every frame from the
stage's data (`game/_1stages.py`), so hills there and in the picture always
agree. Gemini draws the sky, the hills far behind the road, the cars and the
little things.

## How to keep them all in one style

1. **One Gemini chat for everything.** Make `body_Jeep` first, then attach it
   to every later prompt with: *"Match the art style, outlines, palette and
   lighting of the attached picture exactly."*
2. **No words, no numbers, no logos** anywhere: the game writes its own.
3. **Cars, wheels and things go on flat magenta (#FF00FF)**, nothing else
   behind them, no shadow on the ground: the build cuts the magenta away.
4. **Side view, exactly**, facing right, no perspective, no tilt.

## The style (start every prompt with this)

> Bright, friendly 2D cartoon game art for a mobile driving game, like a
> children's picture book: clean bold dark outlines, flat colours with one
> soft shade, rounded chunky shapes, cheerful saturated palette. Strict side
> view. No text, no letters, no numbers, no logos, no border.

## The cars (on flat magenta)

The game checks the driver's head against the road at a fixed point, so the
head must be where the drawn one is: look at the built game's car (or
`out/project.json`'s `body_Jeep`) and keep the same layout.

- **`body_Jeep`** — 86 × 55. *"A small red open-top cartoon jeep seen exactly
  from the side, facing right, WITHOUT its wheels: two empty round wheel
  arches at the bottom, the rear one under the back seat and the front one
  under the bonnet. A grey roll bar behind the driver. The driver sits a
  little behind the middle: a smiling kid in a yellow cap with its peak
  forward and a blue shirt, one big eye, hands on a small steering wheel,
  the head poking up well above the body. On flat magenta."*
- **`body_Truck`** — 102 × 61. *"The same style: a green open-top monster
  pickup truck, longer and taller, big empty wheel arches, an exhaust stack
  at the back, the same kind of driver in a blue cap and orange shirt.
  Without its wheels. On flat magenta."*
- **`wheel_Jeep`** — 28 × 28. *"One chunky black off-road tyre seen straight
  on, with a white five-spoke hub. Perfectly round, centred. On flat
  magenta."*
- **`wheel_Truck`** — 38 × 38. *"One huge black monster-truck tyre with deep
  tread blocks and a yellow five-spoke hub, seen straight on, perfectly
  round, centred. On flat magenta."*

## The stages (no magenta: these fill the picture)

The sky stays still; the two hill layers slide past slower than the road
(the far one slowest) and repeat side by side, so **their left and right
edges must join up** — ask for a "seamless horizontally tiling" picture.
The game draws the hill layers from about a sixth of the way down the
screen, so keep the top part of each **empty and transparent** (or flat
magenta, which the build cuts away), and fill everything below the hills
right down to the bottom.

- **`sky_0`** — 640 × 360. *"A bright summer sky, light blue fading paler to
  the horizon, a soft round sun top right, a few puffy cartoon clouds. Nothing
  on the ground."*
- **`far_0`** — 1024 × 360. *"Seamless horizontally tiling: soft blue-grey
  distant mountains along the upper third, filled solid down to the bottom
  edge. Everything above the mountains flat magenta."*
- **`near_0`** — 1024 × 360. *"Seamless horizontally tiling: rolling green
  hills with round cartoon trees, about 40% down, filled solid green to the
  bottom. Above them flat magenta."*
- **`sky_1`** — 640 × 360. *"A hot desert sky, orange at the top fading to
  pale yellow, a big soft sun low on the right."*
- **`far_1`** — 1024 × 360. *"Seamless horizontally tiling: red sandstone
  mesas and buttes in the distance, a flat sandy plain below them to the
  bottom edge. Above them flat magenta."*
- **`near_1`** — 1024 × 360. *"Seamless horizontally tiling: low golden sand
  dunes with a few green saguaro cacti, filled solid sand to the bottom.
  Above them flat magenta."*
- **`sky_2`** — 640 × 360. *"Outer space seen from the moon: deep black-blue,
  many small stars, the Earth small and bright in the top right."*
- **`far_2`** — 1024 × 360. *"Seamless horizontally tiling: dark grey lunar
  mountains with jagged peaks, solid to the bottom. Above them flat
  magenta."*
- **`near_2`** — 1024 × 360. *"Seamless horizontally tiling: pale grey moon
  ground in gentle humps, dotted with round craters, solid to the bottom.
  Above it flat magenta."*

## Things on the road (on flat magenta)

- **`fuel`** — 22 × 26. *"A small red jerry can of fuel with a black spout
  and handle, slightly tilted, cheerful. On flat magenta."*
- **`finish`** — 150 × 130. *"A finish-line arch: two white poles with a
  black-and-white chequered banner across the top. On flat magenta."*

## The garage

- **`garage`** — 640 × 360. *"The inside of a cosy wooden garage, seen from
  the front: plank walls, a concrete floor in the bottom third, stacked tyres
  by the wall, a tool board. On the left a big open garage door (its rolled-up
  door at the top) — the opening itself flat magenta, from about x 24 to 282
  and y 40 to 236, because the game shows the stage's sky through it. The
  right half of the wall plain: a menu is drawn over it."*
