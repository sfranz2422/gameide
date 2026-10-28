# The Lantern of Greymire: picture prompts for Gemini

The second showcase game: an illustrated gamebook in the style of inkle's
Sorcery!, set in a haunted marsh. These are the prompts for its pictures.
Like Thornwood's art, the pictures stay out of the repository: save them
to `~/Downloads/greymire/` under the names below, and the build reads them
from there.

## How to get them all in one style

1. **Use one Gemini chat for everything**, and make `s01-title` first.
2. **Attach `s01-title` to every later prompt** with the line *"Match the
   style, palette, line work and paper texture of the attached picture
   exactly."* That reference, more than the words, is what keeps 20 pictures
   looking like one artist made them.
3. **Make the characters before their scenes**, and attach a character's
   portrait to any scene they're in (noted below).
4. **For a second expression**, attach the first portrait and ask for *"the
   same character, same clothes, same angle and framing, now …"*.
5. **No words in any picture.** Gemini garbles lettering; the game writes
   the place names and the story itself. If one sneaks in, ask again.
6. Ask for the **aspect ratio** given (16:9 or 1:1). Any size Gemini gives
   is fine; the build shrinks them.

## The style (start every prompt with this)

> Ink and watercolour illustration in the style of a 1980s fantasy
> gamebook. Loose, confident black ink line work with cross-hatching in the
> shadows; muted watercolour washes of grey-green, slate blue, moss and
> ochre; warm amber lantern light as the only bright colour. Visible
> cold-press paper texture. Eerie and quiet, never gory. No text, no
> lettering, no signature, no border.

## Scenes: 16:9 landscape

Every scene: *"Keep the main subject in the left 60% of the picture; the
right 40% is quieter, misty and low in detail."* The story's text is
printed over that side.

| File | Prompt (after the style) |
|---|---|
| `s01-title` | A lone hooded traveller holding up a glowing lantern on a narrow wooden boardwalk that winds into a misty marsh at dusk; dead trees, tall reeds; far off on the horizon, the faint spires of a city half sunk in the water. |
| `s02-landing` | A ferryman's hut on tall stilts at the edge of a black marsh, smoke curling from a tin chimney, nets drying, a flat-bottomed ferry boat tied to the jetty, one lamp in the window. |
| `s03-ferry` | *(attach Marrow)* An old ferryman poling a flat boat across still black water between drowned, leafless trees; the hooded traveller sits in the bow holding the lantern; mist lies low on the water. |
| `s04-reeds` | A maze of reeds taller than a person, a boardwalk splitting three ways; small pale blue-green will-o'-the-wisps hover among the reeds, beckoning down each path. |
| `s05-willow` | *(attach Pip)* An enormous half-drowned willow in a pool of still water; old toys hang from its branches on ribbons — a wooden horse, a little boat, a doll; a faint blue ghostly glow among the roots. |
| `s06-tollbridge` | A rickety plank causeway over the marsh, lanterns hanging from crooked posts, a barred wooden gate in the middle, carved wooden heron statues on either side of the gate. |
| `s07-chapel` | A small stone chapel sunk to its windows in the mire and tilted to one side, its belfry empty, ivy and water-weed climbing the walls, a heron perched on the roof. |
| `s08-nave` | Inside a flooded chapel: dark water covers the floor, pews floating, dozens of candles burning on the pews and ledges, coloured light from a broken stained-glass window falling on the water. |
| `s09-riddle-door` | A heavy stone door in a crypt, three faces carved into it side by side — a sun, a crescent moon and a fish — water lapping at its threshold, the lantern's light on the stone. |
| `s10-saltmere` | A drowned city rising from a grey lagoon: roofs, towers and arches half under water, one tall bell tower at its centre, gulls, a lantern-lit boat approaching. |
| `s11-street` | A flooded street in the drowned city: water up to the doorframes, a narrow walkway of planks along the walls, lanterns over the doors, a rowing boat tied to an iron ring. |
| `s12-belltower` | *(attach the Bell-Keeper)* The top of a stone bell tower in moonlight, a huge green-bronze bell hanging from oak beams, and beside it the silhouette of a tall woman in a long grey gown. |
| `s13-dawn` | Sunrise over the marsh: the mist lifting in golden light, the drowned city's bell tower in the distance, the hooded traveller seen from behind with the lantern lowered, at peace. |
| `s14-dark` | The lantern guttering out on a wet boardwalk, its last ember glowing, the mist rolling in thick and grey and swallowing everything. Melancholy, not frightening. |

## Characters: 1:1 square portraits

Every portrait: *"Head and shoulders, centred, against a plain pale
parchment-coloured background that fades softly at the edges."* Two of each
(the second made from the first, as above).

| Files | Prompt (after the style) | Second expression |
|---|---|---|
| `p-bearer-1`, `p-bearer-2` | The Lantern-bearer: a young traveller in a deep hood and a moss-green cloak, the face mostly in shadow (only the chin and mouth lit), holding a lantern up beside the face. Determined. | Afraid: the lantern held close, the mouth tight. |
| `p-marrow-1`, `p-marrow-2` | Old Marrow the ferryman: a very old man with a long white beard, a wide frayed straw hat, a patched oilskin coat, kind wrinkled eyes. Kindly. | Grave and worried, looking past the viewer. |
| `p-pip-1`, `p-pip-2` | Pip, a ghost child: a small translucent child in an old-fashioned nightshirt, softly glowing pale blue, hair drifting as if underwater. Curious, head tilted. Gentle, not scary. | Sad, eyes down. |
| `p-gallow-1`, `p-gallow-2` | Gallow the toll-keeper: a tall wiry figure in a long cloak of grey feathers, wearing a carved wooden heron mask with a long beak, holding a hooked staff hung with a little lantern. Menacing. | Laughing, the mask tipped back, one gloved hand raised. |
| `p-keeper-1`, `p-keeper-2` | Lady Ashveil, the drowned Bell-Keeper: a pale noblewoman with water-weed in her long dark hair, a high-collared grey gown, faintly glowing eyes. Sorrowful. | Wrathful: the eyes blazing, the hair lifting as if in a wind. |

## The map: 16:9 landscape

`map`, after the style:

> An old hand-drawn map of a marsh on stained parchment, seen from above.
> Bottom left, a hut on stilts by the water; in the middle, a maze of reeds
> and a huge willow; to the right, a small sunken chapel; top right, a
> drowned city with a bell tower. Dotted paths join them. A compass rose, a
> sea serpent drawn in the lagoon, watercolour washes. No words or labels
> anywhere.

## The paper: 1:1 square

`paper`: *"A sheet of aged, cream-coloured parchment paper filling the whole
picture, softly stained at the edges, no marks, no text. Flat, seen from
straight above, evenly lit."* The story's text panel is cut from it.
