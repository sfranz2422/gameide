# Stack Shack: picture prompts for Gemini

A sandwich maker, the old-iPad kind, with no score: pick a bread, cut it, pile on
whatever you like (each layer drops on and squishes), squiggle on sauces, put the lid
on, add a side and a drink, then **eat it**, one crunchy bite at a time. Secret
recipes go into a recipe book (that's where the Python check questions go), and
finding them unlocks sillier ingredients. The screen is wide (16:9), not a phone's.

The build draws its own sunburst, ribbons, round plates, sauce squiggles, bites and
crumbs, so none of those need pictures. Every picture has a stand-in drawn by the
build, so the game plays without any of these. Do them in order and stop whenever
you like.

**Saving them:** leave them in `~/Downloads` under whatever name Gemini gives them,
then tell me which are new. I copy them into `showcase/sandwich/raw/` straight away,
so they can't be lost.

## How to keep them all in one style

1. **One Gemini chat for everything.** Make picture 1 first, then attach it to every
   later prompt and add: *"In exactly the same art style, outlines, palette and
   lighting as the attached picture."*
2. **No words, numbers or logos** anywhere, not on bottles, bags or cups. The game
   writes its own.
3. **Anything marked MAGENTA** goes on flat magenta (#FF00FF), nothing behind it,
   no shadow. The build cuts the magenta away.
4. **Leave clear space between drawings on a sheet**, and keep the rows the prompt
   asks for.
5. **Layers are seen from the side, a little from above**, the way a sandwich looks
   on a plate in front of you, and **every layer is the same width** as the bread
   slice, so they stack neatly. Thin things stay thin: a slice of cheese is a thin
   layer, not a block.

## The style (start every prompt with this)

> Bright, glossy cartoon food illustration for a cheerful kids' cooking game: clean
> smooth outlines, soft shading with shiny highlights, rich appetising colours, every
> food looking fresh and delicious. Not pixel art, not a photo. No text, no letters,
> no numbers, no logos, no border.

## The kitchen

**1. The counter.** (no magenta)
> A wide (16:9) cosy kitchen seen straight on: the top two thirds a cream striped
> wallpaper wall with a long empty wooden shelf across it, warm light from the left;
> the bottom third a polished wooden counter top running the whole width, seen from
> slightly above, completely empty.

## Breads

**2. Loaves.** MAGENTA.
> A sheet of six whole breads, each on its own wooden cutting board, all the same
> size, in one row: a soft white sandwich loaf, a brown wholemeal loaf with oats on
> top, a long crusty baguette, a round sourdough loaf with a cross cut on top, a
> plump golden brioche, a dark rye loaf with seeds. Flat magenta background.

**3. Bread slices.** MAGENTA.
> A sheet of bread slices for stacking a sandwich, seen from the side and a little
> from above, every slice the same width, two rows of six. Row 1, the bottom slices,
> lying flat: white bread, brown wholemeal, a baguette split lengthways (the bottom
> half), sourdough, brioche, dark rye. Row 2, the matching top slices of each, in the
> same order, lying flat with the crust side up (the baguette's top half rounded and
> crusty). Flat magenta background.

## Fillings (layers, all the same width as a bread slice)

**4. Meats.** MAGENTA.
> A sheet of sandwich fillings drawn as flat layers seen from the side and a little
> from above, every layer the same width, two rows of five. Row 1: folded slices of
> roast chicken, folded slices of rare roast beef, folded pink ham, folded slices of
> turkey, overlapping slices of salami. Row 2: three crispy bacon strips side by side,
> a breaded fish fillet, a grilled burger patty, a fried egg with a runny yolk, grilled
> tofu slices. Flat magenta background.

**5. Vegetables.** MAGENTA.
> A sheet of sandwich toppings drawn as flat layers seen from the side and a little
> from above, every layer the same width, two rows of five. Row 1: a ruffled leaf of
> green lettuce, overlapping red tomato slices, overlapping cucumber slices, red
> onion rings, crinkle-cut pickle slices. Row 2: green pepper rings, sliced black
> olives scattered in a line, sliced green jalapenos, avocado slices, sliced
> mushrooms. Flat magenta background.

**6. Cheese and silly things.** MAGENTA.
> A sheet of sandwich layers drawn flat, seen from the side and a little from above,
> every layer the same width, two rows of five. Row 1: a square slice of orange
> cheddar draping over the sides, a slice of holey Swiss cheese, round mozzarella
> slices, a thick spread of peanut butter, a spread of purple grape jelly. Row 2:
> banana slices in a line, a layer of crispy potato chips, a fluffy pancake, a row of
> pink and white marshmallows, a tangle of colourful gummy worms. Flat magenta
> background.

## Sauces, sides and drinks

**7. Sauce bottles.** MAGENTA.
> A sheet of six plastic squeeze bottles standing upright, all the same size, in one
> row, plain with no labels, each its sauce's colour: red ketchup, yellow mustard,
> white mayonnaise, orange-red hot sauce, brown barbecue sauce, green pesto. Flat
> magenta background.

**8. Sides and drinks.** MAGENTA.
> A sheet of side dishes and drinks, two rows of four. Row 1, each in its own small
> bowl or basket, all the same size: golden french fries in a red basket, a bowl of
> tomato soup, a pickle spear on a small dish, a heap of potato chips in a paper
> basket. Row 2, all the same height: a tall glass of lemonade with mint and a lime
> slice, a glass mug of iced tea with a lemon, a glass of cold milk, a frosty glass
> of orange juice. Flat magenta background.

## The recipe book

**9. The book.** (no magenta)
> A wide (16:9) open recipe book seen straight from above, lying on the same wooden
> counter, two blank cream pages with a faint grid, a red ribbon bookmark, a few
> crumbs and a little flour on the wood around it. The pages completely empty.
