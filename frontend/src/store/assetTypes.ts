/**
 * What an asset file really is, from its first bytes — the same rules the
 * server applies (backend/gamestore.py sniff_asset), so a file the page
 * accepts is never refused when it's saved. A file's name and the type the
 * browser guessed are never trusted: a renamed .txt is not a sound.
 */
export type AssetKind = "picture" | "sound" | "font";

const starts = (b: Uint8Array, ...bytes: number[]) => bytes.every((x, i) => b[i] === x);
const ascii = (b: Uint8Array, at: number, text: string) => [...text].every((c, i) => b[at + i] === c.charCodeAt(0));

/** The file's media type, or null if it isn't a picture, sound or font GameIDE can use. */
export function sniffType(b: Uint8Array): string | null {
  if (starts(b, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(b, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a")) return "image/gif";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE")) return "audio/wav";
  if (ascii(b, 0, "OggS")) return "audio/ogg";
  if (ascii(b, 0, "ID3") || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0)) return "audio/mpeg";
  if (starts(b, 0x00, 0x01, 0x00, 0x00) || ascii(b, 0, "true")) return "font/ttf";
  if (ascii(b, 0, "OTTO")) return "font/otf";
  if (ascii(b, 0, "wOFF")) return "font/woff";
  if (ascii(b, 0, "wOF2")) return "font/woff2";
  return null;
}

export function kindOf(type: string): AssetKind {
  return type.startsWith("audio/") ? "sound" : type.startsWith("font/") ? "font" : "picture";
}

/** Size limits, as the server has them. */
export const MAX_BYTES: Record<AssetKind, number> = { picture: 2_000_000, sound: 8_000_000, font: 2_000_000 };

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "font/woff": "woff",
  "font/woff2": "woff2",
};
export const extensionOf = (type: string) => EXTENSIONS[type] ?? "bin";
export const typeOfExtension = (ext: string) => Object.entries(EXTENSIONS).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";

/**
 * Reads a file the student chose, as a Blob with its real type — or throws
 * a sentence they can act on (wrong kind of file, too big).
 */
export async function readAsset(file: Blob, want: AssetKind): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes.subarray(0, 16));
  const words = { picture: "a picture (PNG, JPEG, GIF or WebP)", sound: "a sound (MP3, OGG or WAV)", font: "a font (TTF, OTF, WOFF or WOFF2)" };
  if (!type || kindOf(type) !== want) throw new Error(`That file isn't ${words[want]}.`);
  if (bytes.length > MAX_BYTES[want]) throw new Error(`That ${want} is too big (${(bytes.length / 1e6).toFixed(1)} MB; the limit is ${MAX_BYTES[want] / 1e6} MB).`);
  return new Blob([bytes], { type });
}
