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
];
