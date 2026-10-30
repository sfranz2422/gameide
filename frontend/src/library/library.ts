/**
 * The free art library: Kenney's packs (kenney.nl), which are CC0 — public
 * domain, free to use in any game, published or sold, with no credit
 * owed (it's kind to give one). So a student never has to hunt for art, or
 * wonder whether they may use it.
 *
 * The pictures are in public/library/kenney/<pack>/ (each pack's own
 * License.txt beside them), the "packed" sheets: tiles edge to edge, no
 * spacing. A sheet can become a tileset whole, or its cells a sprite's
 * frames (LibraryBrowser.tsx). library.test.ts checks every file listed is
 * there and its size is a whole number of cells.
 */

export interface LibrarySheet {
  name: string;
  /** Under public/: the picture's address. */
  file: string;
  tileWidth: number;
  tileHeight: number;
  /** What it's mostly for: offered as a tileset first, or as sprites first. */
  use: "tiles" | "sprites";
}

export interface LibraryPack {
  id: string;
  name: string;
  author: string;
  licence: string;
  url: string;
  preview: string;
  about: string;
  sheets: LibrarySheet[];
}

const k = (pack: string, file: string) => `library/kenney/${pack}/${file}`;

export const LIBRARY: LibraryPack[] = [
  {
    id: "pixel-platformer",
    name: "Pixel Platformer",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/pixel-platformer",
    preview: k("pixel-platformer", "preview.png"),
    about: "Grass, dirt, bricks, coins, keys and flags, and little characters that walk and jump.",
    sheets: [
      { name: "Tiles", file: k("pixel-platformer", "tiles.png"), tileWidth: 18, tileHeight: 18, use: "tiles" },
      { name: "Characters", file: k("pixel-platformer", "characters.png"), tileWidth: 24, tileHeight: 24, use: "sprites" },
      { name: "Backgrounds", file: k("pixel-platformer", "backgrounds.png"), tileWidth: 24, tileHeight: 24, use: "tiles" },
    ],
  },
  {
    id: "tiny-dungeon",
    name: "Tiny Dungeon",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/tiny-dungeon",
    preview: k("tiny-dungeon", "preview.png"),
    about: "Stone walls and floors seen from above, heroes, monsters, weapons and potions.",
    sheets: [{ name: "Tiles and characters", file: k("tiny-dungeon", "tiles.png"), tileWidth: 16, tileHeight: 16, use: "tiles" }],
  },
  {
    id: "tiny-town",
    name: "Tiny Town",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/tiny-town",
    preview: k("tiny-town", "preview.png"),
    about: "A village from above: grass, paths, houses, fences, trees and wells.",
    sheets: [{ name: "Tiles", file: k("tiny-town", "tiles.png"), tileWidth: 16, tileHeight: 16, use: "tiles" }],
  },
  {
    id: "pixel-shmup",
    name: "Pixel Shmup",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/pixel-shmup",
    preview: k("pixel-shmup", "preview.png"),
    about: "Space ships to fly and shoot down, and tiles for the ground far below.",
    sheets: [
      { name: "Ships", file: k("pixel-shmup", "ships.png"), tileWidth: 32, tileHeight: 32, use: "sprites" },
      { name: "Tiles", file: k("pixel-shmup", "tiles.png"), tileWidth: 16, tileHeight: 16, use: "tiles" },
    ],
  },
  {
    // Kenney's Sports Pack: its separate pictures packed into grids by
    // scripts/make_sports_library.py; its tilesheets are 64-pixel grids already.
    id: "sports",
    name: "Sports",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/sports-pack",
    preview: k("sports", "preview.png"),
    about: "Players seen from above in five team colours (ten looks and an arm each), every kind of ball, flags, a golf club, rackets and bats, and pitches, courts and goals.",
    sheets: [
      { name: "Players", file: k("sports", "players.png"), tileWidth: 24, tileHeight: 32, use: "sprites" },
      { name: "Balls and equipment", file: k("sports", "equipment.png"), tileWidth: 32, tileHeight: 32, use: "sprites" },
      { name: "Grass pitch", file: k("sports", "pitch.png"), tileWidth: 64, tileHeight: 64, use: "tiles" },
      { name: "Court", file: k("sports", "court.png"), tileWidth: 64, tileHeight: 64, use: "tiles" },
      { name: "Tarmac", file: k("sports", "tarmac.png"), tileWidth: 64, tileHeight: 64, use: "tiles" },
      { name: "Goals and nets", file: k("sports", "goals.png"), tileWidth: 64, tileHeight: 64, use: "tiles" },
    ],
  },  // The rest of Kenney's packs here are made by scripts/make_kenney_library.py from his CC0 downloads.
  {
    id: "racing",
    name: "Racing",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/racing-pack",
    preview: k("racing", "preview.png"),
    about: "Cars and bikes from above, drivers, cones and barriers, and roads, grass, sand and dirt to drive on.",
    sheets: [
      { name: "Cars", file: k("racing", "cars.png"), tileWidth: 36, tileHeight: 66, use: "sprites" },
      { name: "Bikes and drivers", file: k("racing", "bikes-and-drivers.png"), tileWidth: 26, tileHeight: 50, use: "sprites" },
      { name: "Road things", file: k("racing", "road-things.png"), tileWidth: 70, tileHeight: 70, use: "sprites" },
      { name: "Asphalt roads", file: k("racing", "asphalt-roads.png"), tileWidth: 64, tileHeight: 64, use: "tiles" },
      { name: "Grass, sand and dirt", file: k("racing", "grass-sand-and-dirt.png"), tileWidth: 64, tileHeight: 64, use: "tiles" },
    ],
  },
  {
    id: "topdown-shooter",
    name: "Topdown Shooter",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/top-down-shooter",
    preview: k("topdown-shooter", "preview.png"),
    about: "People seen from above, each with a gun, two hands, a machine gun and reloading, and floors, walls and crates.",
    sheets: [
      { name: "Characters", file: k("topdown-shooter", "characters.png"), tileWidth: 58, tileHeight: 44, use: "sprites" },
      { name: "Weapons", file: k("topdown-shooter", "weapons.png"), tileWidth: 34, tileHeight: 10, use: "sprites" },
      { name: "Tiles", file: k("topdown-shooter", "tiles.png"), tileWidth: 64, tileHeight: 64, use: "tiles" },
    ],
  },
  {
    id: "tower-defense",
    name: "Tower Defense",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/tower-defense-top-down",
    preview: k("tower-defense", "preview.png"),
    about: "Paths, grass and sand from above, towers and their turrets, rockets, and the soldiers and tanks that walk the path.",
    sheets: [
      { name: "Tiles, towers and enemies", file: k("tower-defense", "tiles-towers-and-enemies.png"), tileWidth: 64, tileHeight: 64, use: "tiles" },
    ],
  },
  {
    id: "platformer-redux",
    name: "Platformer Pack Redux",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/platformer-pack-redux",
    preview: k("platformer-redux", "preview.png"),
    about: "Big cartoon platformer art: grass, dirt, sand, snow and stone ground, boxes and ladders, five heroes that walk and jump, enemies, coins, keys and hearts.",
    sheets: [
      { name: "Tiles", file: k("platformer-redux", "tiles.png"), tileWidth: 64, tileHeight: 64, use: "tiles" },
      { name: "Ground", file: k("platformer-redux", "ground.png"), tileWidth: 64, tileHeight: 64, use: "tiles" },
      { name: "Players", file: k("platformer-redux", "players.png"), tileWidth: 64, tileHeight: 128, use: "sprites" },
      { name: "Enemies", file: k("platformer-redux", "enemies.png"), tileWidth: 64, tileHeight: 64, use: "sprites" },
      { name: "Items and HUD", file: k("platformer-redux", "items-and-hud.png"), tileWidth: 64, tileHeight: 64, use: "sprites" },
      { name: "Backgrounds", file: k("platformer-redux", "backgrounds.png"), tileWidth: 256, tileHeight: 256, use: "sprites" },
    ],
  },
  {
    id: "space-redux",
    name: "Space Shooter Redux",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/space-shooter-redux",
    preview: k("space-redux", "preview.png"),
    about: "Player ships and enemy ships, lasers, meteors, power-ups and shields, number icons, and starry backgrounds.",
    sheets: [
      { name: "Ships", file: k("space-redux", "ships.png"), tileWidth: 112, tileHeight: 92, use: "sprites" },
      { name: "Lasers", file: k("space-redux", "lasers.png"), tileWidth: 48, tileHeight: 58, use: "sprites" },
      { name: "Meteors", file: k("space-redux", "meteors.png"), tileWidth: 120, tileHeight: 98, use: "sprites" },
      { name: "Power-ups and HUD", file: k("space-redux", "power-ups-and-hud.png"), tileWidth: 38, tileHeight: 34, use: "sprites" },
      { name: "Effects", file: k("space-redux", "effects.png"), tileWidth: 26, tileHeight: 42, use: "sprites" },
      { name: "Backgrounds", file: k("space-redux", "backgrounds.png"), tileWidth: 256, tileHeight: 256, use: "tiles" },
    ],
  },
  {
    id: "roguelike",
    name: "Roguelike/RPG",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/roguelike-rpg-pack",
    preview: k("roguelike", "preview.png"),
    about: "Over 1,700 tiny tiles from above: grass, water, roads, houses inside and out, furniture, trees and fences.",
    sheets: [
      { name: "Tiles", file: k("roguelike", "tiles.png"), tileWidth: 16, tileHeight: 16, use: "tiles" },
    ],
  },
  {
    id: "puzzle",
    name: "Puzzle Pack 2",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/puzzle-pack-2",
    preview: k("puzzle", "preview.png"),
    about: "Bricks and blocks in four colours, paddles, balls and coins: for breakout and puzzle games.",
    sheets: [
      { name: "Balls", file: k("puzzle", "balls.png"), tileWidth: 44, tileHeight: 44, use: "sprites" },
      { name: "Paddles", file: k("puzzle", "paddles.png"), tileWidth: 160, tileHeight: 36, use: "sprites" },
      { name: "Coins", file: k("puzzle", "coins.png"), tileWidth: 44, tileHeight: 44, use: "sprites" },
      { name: "Blocks: blue", file: k("puzzle", "blocks-blue.png"), tileWidth: 62, tileHeight: 44, use: "sprites" },
      { name: "Blocks: green", file: k("puzzle", "blocks-green.png"), tileWidth: 62, tileHeight: 44, use: "sprites" },
      { name: "Blocks: red", file: k("puzzle", "blocks-red.png"), tileWidth: 62, tileHeight: 44, use: "sprites" },
      { name: "Blocks: yellow", file: k("puzzle", "blocks-yellow.png"), tileWidth: 62, tileHeight: 44, use: "sprites" },
    ],
  },
  {
    id: "ui",
    name: "UI Pack",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/ui-pack",
    preview: k("ui", "preview.png"),
    about: "Buttons in five colours, check boxes, sliders, arrows, stars and icons: for title screens and menus.",
    sheets: [
      { name: "Wide buttons and sliders", file: k("ui", "wide-buttons-and-sliders.png"), tileWidth: 192, tileHeight: 96, use: "sprites" },
      { name: "Buttons, checks and icons", file: k("ui", "buttons-checks-and-icons.png"), tileWidth: 64, tileHeight: 64, use: "sprites" },
    ],
  },
  {
    id: "tiny-farm",
    name: "Tiny Farm",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/tiny-farm",
    preview: k("tiny-farm", "preview.png"),
    about: "A farm from above in 16-pixel tiles: fields, crops, fences, a barn, animals and tools.",
    sheets: [
      { name: "Tiles", file: k("tiny-farm", "tiles.png"), tileWidth: 16, tileHeight: 16, use: "tiles" },
    ],
  },
  {
    id: "one-bit",
    name: "1-Bit Pack",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/1-bit-pack",
    preview: k("one-bit", "preview.png"),
    about: "Over 1,000 little one-colour tiles: heroes, monsters, walls, doors, weapons, items and icons.",
    sheets: [
      { name: "Tiles", file: k("one-bit", "tiles.png"), tileWidth: 16, tileHeight: 16, use: "tiles" },
    ],
  },
  {
    id: "toon-characters",
    name: "Toon Characters",
    author: "Kenney",
    licence: "CC0 (public domain)",
    url: "https://kenney.nl/assets/toon-characters-1",
    preview: k("toon-characters", "preview.png"),
    about: "Six big cartoon characters (adventurers, people, a robot and a zombie), each in 45 poses: walking, running, jumping, climbing, attacking.",
    sheets: [
      { name: "Female adventurer", file: k("toon-characters", "female-adventurer.png"), tileWidth: 96, tileHeight: 128, use: "sprites" },
      { name: "Female person", file: k("toon-characters", "female-person.png"), tileWidth: 96, tileHeight: 128, use: "sprites" },
      { name: "Male adventurer", file: k("toon-characters", "male-adventurer.png"), tileWidth: 96, tileHeight: 128, use: "sprites" },
      { name: "Male person", file: k("toon-characters", "male-person.png"), tileWidth: 96, tileHeight: 128, use: "sprites" },
      { name: "Robot", file: k("toon-characters", "robot.png"), tileWidth: 96, tileHeight: 128, use: "sprites" },
      { name: "Zombie", file: k("toon-characters", "zombie.png"), tileWidth: 96, tileHeight: 128, use: "sprites" },
    ],
  },
];

// ---------------------------------------------------------------- cutting
// Here, not in LibraryBrowser.tsx: the tutorial starters (store/templates.ts)
// make a lesson's sprites from the library the same way a student does.

const loaded = new Map<string, Promise<ImageBitmap>>();
/** A sheet as a picture, fetched once a page. */
export function picture(file: string): Promise<ImageBitmap> {
  let p = loaded.get(file);
  if (!p) {
    p = fetch(file).then((r) => {
      if (!r.ok) throw new Error(`The library picture ${file} didn't load.`);
      return r.blob().then((b) => createImageBitmap(b));
    });
    loaded.set(file, p);
  }
  return p;
}

/** Cells of a sheet as separate pictures, in the order given. */
export async function cutCells(sheet: LibrarySheet, cells: number[]): Promise<Blob[]> {
  const img = await picture(sheet.file);
  const columns = Math.floor(img.width / sheet.tileWidth);
  return Promise.all(
    cells.map((n) => {
      const c = new OffscreenCanvas(sheet.tileWidth, sheet.tileHeight);
      c.getContext("2d")!.drawImage(img, (n % columns) * sheet.tileWidth, Math.floor(n / columns) * sheet.tileHeight, sheet.tileWidth, sheet.tileHeight, 0, 0, sheet.tileWidth, sheet.tileHeight);
      return c.convertToBlob({ type: "image/png" });
    }),
  );
}
