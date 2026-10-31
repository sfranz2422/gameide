# Moonshot: picture prompts for Gemini

The sixth showcase game: baseball at dusk, seen from behind home plate as on
television. A Home Run Derby, and three-inning games against the computer or
a friend. Batting is timing the swing and aiming it high or low; pitching is
picking a fastball, curveball, changeup or slider and where to put it.

Every picture in the game is already drawn by `build.py`, so these are
upgrades, not needs. **The field itself is always painted by the build**
(grass, dirt, bases, lines, the fence, the map seen from above): the game
measures its rules on it, so it has to be exact. Gemini draws the people and
the crowd. Save the pictures to `~/Downloads/baseball/` under the names below,
then run `python3 showcase/baseball/build.py`; it says how many it used. They
stay out of the repository.

## How to keep them all in one style

1. **One Gemini chat for everything.** Make `batter-away` first, then attach
   it to every later prompt with: *"Match the pixel art style, palette, pixel
   size and lighting of the attached picture exactly."*
2. **Make the home team from the away team.** Attach the away sheet and say:
   *"The same player, same poses, same sizes, same order — only the uniform
   colours change to: …"*
3. **No words and no numbers anywhere.** Jerseys are plain; the game writes
   its own text. Ask again if letters or digits sneak in.
4. **People go on flat magenta (#FF00FF)**, nothing else behind them: the
   build cuts the magenta away and finds each figure by its outline. Ask again
   if there's grass, a shadow or a gradient behind them. Leave clear space
   between figures, and keep the bat touching the hands (a bat floating free
   is cut out as a figure of its own).
5. The build lines each figure up by its feet and shrinks it to the game's
   size, so the figures can be any size as long as they match each other.

## The style (start every prompt with this)

> Pixel art in the style of an early-1990s 16-bit arcade baseball game.
> Crisp hard-edged square pixels with no anti-aliasing and no blur, a limited
> bright palette, bold dark outlines, chunky cartoon proportions, warm dusk
> light from the stadium floodlights. No text, no letters, no numbers, no
> logos, no border.

## The teams

The visitors, the **Bluebirds**: sky-blue jerseys, navy helmets and caps,
white pants, navy socks, black shoes. The home team, the **Rattlers**: coral
red jerseys, dark maroon helmets and caps, white pants, maroon socks, black
shoes.

## Players: ask for 16:9, on flat magenta (#FF00FF)

Add to every player sheet: *"Full body, pixel-art game sprite, the same size
in every pose, side by side in one row with clear space between them, on a
flat solid magenta (#FF00FF) background with no shadows and no ground."*

| File | Prompt (after the style and the line above) |
|---|---|
| `batter-away` | A right-handed baseball batter in a sky-blue jersey with no number, a navy batting helmet, white pants, navy socks, black shoes, holding a wooden bat. **Seen from behind the catcher: the batter stands side-on, facing right**, toward home plate. 5 poses, in this order: in his stance with the bat held up behind his head; striding forward with his hands back; swinging, the bat coming round level behind him; the moment of contact, the bat straight out to the right, level; the follow-through, the bat wrapped round over his left shoulder. |
| `batter-home` | *(attach `batter-away`)* The same batter, same 5 poses, same sizes and order — only the uniform changes to: a coral red jersey, a dark maroon helmet, white pants, maroon socks. |
| `pitcher-home` | *(attach `batter-away`)* A right-handed baseball pitcher in a coral red jersey, a dark maroon cap, white pants, maroon socks, black shoes, a brown glove on his left hand. **Facing us**, as seen from home plate. 4 poses, in this order: standing set with the ball and glove together at his chest; the leg kick, his left knee up high; striding toward us with his throwing arm reached back high above his head; the follow-through, leaning toward us, his throwing arm come down across his body. |
| `pitcher-away` | *(attach `pitcher-home`)* The same pitcher, same 4 poses, same sizes and order, in the Bluebirds' uniform: a sky-blue jersey, a navy cap, white pants, navy socks. |
| `fielder-home` | *(attach `pitcher-home`)* An infielder of the same team, facing us, in the ready crouch: knees bent, feet wide, glove open low in front. 1 pose. |
| `fielder-away` | *(attach `fielder-home`)* The same fielder, same pose and size, in the Bluebirds' uniform. |

## The crowd: no magenta

| File | Aspect | Prompt (after the style) |
|---|---|---|
| `crowd` | 21:9 | The packed bleachers of a minor-league ballpark at dusk, seen straight on from the field: rows of cheering fans, some in sky blue and some in coral red, waving pennants (no writing on them), with tall floodlight towers glowing above and a deep blue evening sky with the first stars and a big full moon at the top. Fill the whole picture with crowd and sky: no field, no wall, no people in front. |

The build shrinks `crowd` into the band above the outfield wall from behind
the plate, and round the outfield on the map, so it shows small: keep it
bold and busy rather than detailed.
