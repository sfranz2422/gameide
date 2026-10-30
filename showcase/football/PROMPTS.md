# Under the Lights: picture prompts for Gemini

The fourth showcase game: an arcade American football game, seen from the
side and a little above, the field scrolling left and right under the
stadium lights. 7 on 7, four downs to make ten yards, pick a play from the
coach's chalkboard, then run it: hand off or throw to an open receiver, and
on defence chase and dive at the ball carrier. One half against the
computer, or two players on one keyboard or two gamepads.

The field itself (grass stripes, yard lines, numbers, end zones) is drawn
by the game, so the lines are exact; Gemini draws everything with a face.
Save the pictures to `~/Downloads/football/` under the names below. They
stay out of the repository.

## How to keep them all in one style

1. **One Gemini chat for everything.** Make `p-home-run` first, then attach
   it to every later prompt with: *"Match the pixel art style, palette,
   pixel size and lighting of the attached picture exactly."*
2. **Make the away team from the home team.** Attach the home sheet and
   say: *"The same players, same poses, same sizes, same order — only the
   uniform colours change to: …"*
3. **No words and no numbers anywhere.** Jerseys are plain, scoreboards and
   banners are blank; the game writes its own text. Ask again if letters or
   digits sneak in.
4. **Players, the referee, the ball and the mascot go on flat magenta
   (#FF00FF)**, nothing else behind them: the game cuts the magenta away.
   Ask again if there's grass, a shadow or a gradient behind them.
5. If a run cycle's frames don't quite match, keep it. The build snaps each
   frame to the pixel grid and lines up their feet.

## The style (start every prompt with this)

> Pixel art in the style of an early-1990s 16-bit arcade sports game.
> Crisp hard-edged square pixels with no anti-aliasing and no blur, a
> limited bright palette, bold dark outlines, chunky cartoon proportions
> (big helmets, short legs), night-game lighting from stadium floodlights.
> No text, no letters, no numbers, no logos, no border.

## Players: ask for 16:9, on flat magenta (#FF00FF)

Add to every player sheet: *"Full body, small pixel-art game sprite, seen
from the side and slightly above, the same size in every frame, side by side
in one row with clear space between them, on a flat solid magenta (#FF00FF)
background with no shadows and no ground."*

The home team, the **Comets**: navy blue jerseys, gold helmets with a navy
stripe, gold pants, white socks, black cleats.

| File | Prompt (after the style and the line above) |
|---|---|
| `p-home-run` | An American football player in a navy blue jersey with no number, a gold helmet with a navy stripe down the middle and a face mask, gold pants, white socks, black cleats. A running cycle seen from the side, facing right, leaning forward: 6 frames. |
| `p-home-ball` | *(attach `p-home-run`)* The same player running while carrying a brown football tucked under his right arm, seen from the side, facing right: 6 frames. |
| `p-home-poses` | *(attach `p-home-run`)* The same player in 8 poses, all facing right: crouched in a three-point stance; standing upright, ready; arm cocked back to throw a football; arm forward just after throwing; both arms up reaching to catch; diving forward flat out to tackle; lying face down on the ground; jumping with both fists up, celebrating. |

The away team, the **Badgers**: attach each home sheet in turn.

| File | Prompt (after the style and the line above) |
|---|---|
| `p-away-run` | *(attach `p-home-run`)* The same player, same 6 frames, same sizes and order — only the uniform colours change to: a red jersey, a white helmet with a red stripe, white pants, red socks, white cleats. |
| `p-away-ball` | *(attach `p-home-ball`)* The same 6 frames, same sizes and order, in the red-and-white uniform of `p-away-run`. |
| `p-away-poses` | *(attach `p-home-poses`)* The same 8 poses, same sizes and order, in the red-and-white uniform of `p-away-run`. |

## Everyone else: 16:9, on flat magenta (#FF00FF), with the player line

| File | Prompt (after the style and the line above) |
|---|---|
| `p-referee` | A football referee in a black-and-white vertically striped shirt, black cap, white pants, a whistle. 5 poses: standing facing us; both arms straight up (touchdown); one arm pointing sideways (first down); arms crossing and uncrossing low in front of him (incomplete pass); blowing the whistle with one hand up. |
| `p-mascot` | A school mascot in a big foam costume: a smiling round comet with a gold flaming tail and big sneakers. 3 poses: waving; jumping with arms up; doing a cartwheel, upside down. |
| `ball` | *(ask for 1:1)* A brown American football with white laces, small pixel-art sprite. 4 frames in one row of it spinning in a spiral seen from the side, then 1 frame of it standing on its point on a little orange kicking tee. |

## Backgrounds: no magenta, no people in front

| File | Aspect | Prompt (after the style) |
|---|---|---|
| `stands` | 21:9 | The home-side bleachers of a small-town high school football stadium at night, seen straight on from the field: rows of cheering fans in navy and gold, a band in one corner, tall floodlight towers glowing above, a dark blue night sky. The bottom edge is a low wall along the sideline. It must tile side to side: the left and right edges match. |
| `title` | 16:9 | A high school football stadium at night seen from behind one end zone, the floodlights blazing, a navy-and-gold crowd in the stands, a single football spinning high in the air in the middle, a blank scoreboard far away. Leave the top third as dark empty sky for the title. |
| `chalkboard` | 16:9 | A coach's green chalkboard on a locker-room wall, seen straight on, with a wooden frame and a chalk tray with chalk and an eraser, smudged with old erased chalk marks, otherwise empty. |
| `coach` | 1:1 | A portrait from the chest up of a gruff, kind high school football coach: a navy cap, a gold windbreaker, a whistle round his neck, a clipboard. Two portraits side by side, the same size: calm and thinking; shouting with his mouth wide open. Flat solid magenta (#FF00FF) background. |
| `scoreboard` | 21:9 | An old high school football scoreboard seen straight on, dark with a navy frame and two light-bulb lamps on top, with three big empty black panels (left, middle, right) and a row of small empty panels under them. No digits, no words. |
| `win` | 16:9 | Navy-and-gold football players lifting a teammate onto their shoulders on the field at night, confetti falling, the floodlights behind them. |
| `lose` | 16:9 | A navy-and-gold football player sitting alone on the bench at night, helmet in his hands, the empty stadium lights still on behind him, rain falling. |

## When they're in

Tell me, and the build cuts and shrinks them to the game's real size (a
player is about 32 pixels tall in a 384 × 216 screen) and its small palette,
as it did for Mystery Meat. Until then the game draws stand-ins.
