# Tabletop Siege, snowball fort war: picture prompts for Gemini

The teacher's new setting (2026-11-10): a snowball war between two snow forts on a
snowy field, blue scarves against red scarves, across a frozen creek with a log
bridge in each lane. The game plays exactly as before; only the pictures and the
cards' names change:

| Card | Was | Now |
|---|---|---|
| 3 cheap fighters | Toy Soldiers | **Snow Kids** |
| Tough, slows down | Wind-up Knight | **Snowman** (slows as it melts) |
| Flies, towers only | Paper Plane | **Snowy Owl** |
| Shoots, hits flyers | Band Archer | **Slingshot Penguin** |
| Huge, buildings only | Eraser Golem | **Yeti** |
| Draws attackers | Block Wall | **Snow Wall** |
| Rolls down a lane | Marble | **Big Snowball** |
| Slows their troops | Glue Puddle | **Ice Patch** |

(The old desk pictures stay in `raw/` and `art/` until these replace them.)

**Saving them:** leave them in `~/Downloads` under whatever name Gemini gives them,
then tell me. I copy them into `showcase/siege/raw/` straight away.

## How to keep them all in one style

1. **One Gemini chat for everything.** Make picture 1 first, then attach it to every
   later prompt and add: *"In exactly the same art style, outlines, palette and
   lighting as the attached picture."*
2. **No words, numbers or logos** anywhere.
3. **Anything marked MAGENTA** goes on flat magenta (#FF00FF), nothing behind it,
   no shadow on the ground, and clear space between drawings. **Keep exactly the
   rows and the number of drawings asked for**, and nothing else on the sheet
   (last time Gemini added extra things, and a stray head).
4. **Every troop facing right**, all of them, in every drawing.

## The style (start every prompt with this)

> Bright, chunky 16-bit pixel art for a top-down strategy game seen from slightly
> above (three-quarter view): visible square pixels, clean dark outlines, crisp
> winter colours (white snow, pale blue shadows, warm wood), cosy and cheerful.
> No text, no letters, no numbers, no logos, no border.

## The troops

**1. Blue team.** MAGENTA.
> A sheet of five kinds of winter troops on the blue team, five rows, three drawings
> in each row, ALL FACING RIGHT, with blue scarves or hats: Row 1, a kid in a puffy
> winter coat and a blue bobble hat: walking (two steps, legs clearly apart then
> together), then throwing a snowball. Row 2, a big tough snowman with stick arms, a
> carrot nose and a blue scarf: walking (two steps), then swinging a stick. Row 3, a
> white snowy owl with a blue band on its leg: flying wings up, wings down, and
> diving. Row 4, a penguin with a blue hat and a slingshot: walking (two steps), then
> shooting. Row 5, a huge friendly white-furred yeti with a blue scarf: walking (two
> steps), then stomping. Flat magenta background.

**2. Red team.** MAGENTA.
> The same sheet with every blue thing red instead (red hats, red scarves, a red
> band). Same rows, same poses, same size, ALL FACING RIGHT.

## The forts

**3. Towers and keeps.** MAGENTA.
> A sheet, three rows: Row 1, a round snow-brick fort tower with a little blue flag on
> top: whole, cracked, and crumbled into a heap of snow. Row 2, the same in red.
> Row 3, a big ice-and-snow castle with a blue flag, then the same with a red flag,
> then a big heap of broken ice blocks. Flat magenta background.

## The field

**4. Snowy ground.** Not magenta. Square, edge to edge.
> A seamless top-down texture of a snowy field: soft white snow with pale blue
> shadows, a few footprints and sparkles, evenly lit, nothing on it. It must repeat.

**5. Winter things.** MAGENTA.
> A sheet seen from above, three rows with clear space between: Row 1, a straight log
> bridge lying flat (logs side by side), a second log bridge, a wooden sled.
> Row 2, a pair of mittens, a knitted scarf, a mug of hot cocoa, a pine cone, a carrot.
> Row 3, a wall of packed snow bricks, a patch of slippery ice, a heap of snow, a big
> rolled snowball with a blue ribbon, the same with a red ribbon. Flat magenta
> background. Nothing else on the sheet.

**6. Little effects.** MAGENTA. One row only.
> Six small effects in ONE row and nothing else: a puff of powdery snow, a burst of
> ice sparks, a flying snowball, a flying icicle, a swirl of snowflakes, a sparkle
> burst. Flat magenta background.

**7. Small pine trees.** MAGENTA.
> Four small snowy pine trees of different sizes in one row, seen from slightly
> above, for the edges of the field. Flat magenta background.

## The cards and the front

**8. Card pictures.** MAGENTA.
> Eight square portraits in two rows of four, each a close-up of one of these in the
> same style: three blue-hatted snow kids with snowballs; the blue-scarfed snowman;
> the snowy owl; the slingshot penguin; the yeti; a snow-brick wall; a big rolling
> snowball; a patch of slippery ice. Flat magenta background.

**9. Title picture.** Not magenta. 16:9, edge to edge.
> A snowy field seen from above at an angle, a cheerful snowball war across it: blue
> kids, a snowman and a penguin on the left behind their snow fort, red ones on the
> right behind theirs, snowy owls overhead, a frozen creek between them with a log
> bridge, pine trees, soft snow falling, warm late-afternoon light. Leave the top
> third simple for a title.
