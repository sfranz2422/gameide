# Mystery Meat from Outer Space: picture prompts for Gemini

The third showcase game: a point-and-click adventure in the spirit of
LucasArts' Zak McKracken. The school paper's reporter finds out the new
lunch lady's "Sleepy Joes" come from a spaceship. The pictures stay out of
the repository: save them to `~/Downloads/mystery/` under the names below.

## How to keep them all in one style

1. **One Gemini chat for everything.** Make `r01-newsroom` first, then
   attach it to every later prompt with: *"Match the pixel art style,
   palette, pixel size and lighting of the attached picture exactly."*
2. **Make each character's sheets one after another**, attaching the first
   sheet to the second: *"Same character, same colours, same size."*
3. **No words anywhere.** Signs, posters and labels stay blank or use
   symbols; the game writes its own text. Ask again if letters sneak in.
4. **Characters and items go on flat magenta (#FF00FF)**, nothing else
   behind them: the game cuts the magenta away. Ask again if there's a
   shadow, a floor or a gradient behind them.
5. If a walk cycle comes out with frames that don't match, keep it anyway.
   The build snaps every frame to a pixel grid and lines up their feet, and
   small pixel sprites forgive a lot. Make it work as it comes.

## The style (start every prompt with this)

> Pixel art in the style of a 1990 LucasArts point-and-click adventure
> game (Zak McKracken, Maniac Mansion, Day of the Tentacle). 256-colour VGA
> palette, crisp hard-edged square pixels with no anti-aliasing and no
> blur, light dithering in shadows, bright saturated cartoon colours, comic
> exaggerated shapes. No text, no letters, no numbers, no logos, no border.

## Rooms: ask for 21:9 (ultra-wide; 16:9 if 21:9 isn't offered)

Add to every room: *"Seen from the side like a stage, flat open floor
across the bottom third of the picture for characters to walk on, no
people in the picture."*

| File | Prompt (after the style) |
|---|---|
| `r01-newsroom` | A cramped school newspaper office: desks piled with paper, an old computer, a bulletin board covered in pinned photos and string, a camera on a shelf, a door on the right. |
| `r02-hallway` | A long school hallway: rows of lockers, a trophy case, a water fountain, three doors (a cafeteria door with a fork-and-spoon sign, an office door, a door to stairs going down), and a stairway going up at the end with a chain across it. |
| `r03-cafeteria` | A school cafeteria: long tables with benches, a serving counter with steaming trays of brown sloppy food, a tray return with stacked milk cartons, a swinging kitchen door marked with a chef's hat symbol. |
| `r04-kitchen` | A school kitchen behind the cafeteria: a giant bubbling pot glowing faintly green, a wooden crate stamped with strange alien symbols, a big steel walk-in freezer door, a strange glowing panel hidden behind the pots and pans. |
| `r05-office` | A principal's office: a big desk with a lamp, a clock radio and a ring of keys, a microphone for the school intercom, a framed photo of a cat, a comfy armchair behind the desk, a window with blinds. |
| `r06-basement` | A school basement: a huge rumbling boiler with glowing grates, pipes everywhere, a janitor's workbench with an old ham radio, a mop bucket, shelves of rolls of tinfoil, a dim bulb hanging from the ceiling. |
| `r07-roof` | The school rooftop at night: a small domed observatory with a big telescope, a strange tall antenna disguised as a weather vane, glowing faintly, a full moon and stars, the town's lights below. |
| `r08-mothership` | The bridge of a flying saucer: round walls, blinking control panels, a big window onto space with the Earth in it, a huge machine shaped like a soft-serve dispenser pouring brown sloppy food into a glowing tube. |

## Other pictures

| File | Aspect | Prompt (after the style) |
|---|---|---|
| `title` | 16:9 | A school building at dusk with a flying saucer hovering above the cafeteria roof, a beam of green light shining down onto it, a lunch tray floating up into the beam. Leave the top third as empty sky for the title. |
| `telescope` | 1:1 | The view through a telescope: a black circle edged with darkness, inside it the Moon, and peeking out from behind the Moon a flying saucer with a hatch shaped like a lunch-lady hairnet. |
| `newspaper` | 3:4 | The front page of a school newspaper, seen flat from above, with a big empty white box for the photo, empty grey lines where the words would be, and an empty band across the top for the headline. No actual letters anywhere. |

## Characters: ask for 16:9, on flat magenta (#FF00FF)

Every character sheet: *"Full body, small pixel-art game sprite, the same
size in every pose, side by side in one row with space between them, on a
flat solid magenta (#FF00FF) background with no shadows."*

| File | Prompt (after the style and the line above) |
|---|---|
| `c-robin-walk` | Robin, a student reporter: messy dark hair, a yellow raincoat, a press badge on a lanyard, a notepad in a pocket, red sneakers. A walk cycle seen from the side, facing right: 6 frames. |
| `c-robin-poses` | *(attach `c-robin-walk`)* The same Robin in 5 poses: standing facing us; standing seen from behind; standing facing right; talking facing us with the mouth open; reaching out a hand to pick something up, facing right. |
| `c-glorbin` | Ms. Glorbin, the new lunch lady: a hairnet, a stained apron, rubber gloves, a smile a little too wide, faintly green skin. 4 poses: standing facing us; talking with a ladle raised; then the disguise off — a round green alien with three eyes and little tentacles, still in the apron and hairnet — standing; and the alien talking, waving its tentacles. |
| `c-hoover` | Principal Hoover: a tired man in a rumpled suit and tie, with droopy eyelids. 3 poses: asleep sitting slumped in an armchair, snoring; sitting up in the armchair, blinking awake; standing facing us, talking. |
| `c-gus` | Gus the janitor: a big friendly man in grey overalls, a ring of keys on his belt, a hat made of tinfoil. 2 poses: standing facing us holding a mop; talking with one finger raised, very serious. |
| `c-dot` | Dot, the astronomy club kid: big round glasses, a star-pattern sweater, a backpack covered in planet stickers. 3 poses: asleep with her head on a cafeteria table (show the table edge), standing wide awake with her hair on end, and talking excitedly, pointing up. |

## Items: ask for 1:1, on flat magenta (#FF00FF)

`items`: *"A 4 by 3 grid of 12 small pixel-art inventory icons, each the
same size with space between them, on a flat solid magenta (#FF00FF)
background with no shadows: an instant camera; two batteries; an empty
milk carton; a milk carton stuffed with brown sloppy-joe meat; a bottle of
red hot sauce with a flame symbol; a block of ice with a glowing green card
frozen inside it; a glowing green alien keycard; a small brass key on a
star-shaped keyring; an instant photo; a reporter's notepad; a roll of
tinfoil; a plastic lunch tray."*
