/**
 * Where a page's Pyodide comes from: jsdelivr first, our own copy if that fails.
 *
 * WHY THE CDN. Pyodide is about 6.5 MB over the wire, and every byte our own
 * server sends counts against the Render workspace's monthly bandwidth, which
 * GameIDE shares with PyIDE. Browsers kept our copy for a day, so a class
 * fetched it again every school day and after every deploy; by 11 Nov 2026 the
 * workspace was past 70% of its 5 GB with most of the month to go. PyIDE has
 * always loaded Pyodide from jsdelivr on the same school network.
 *
 * WHY STILL OUR COPY. The build keeps copying Pyodide into dist/pyodide/
 * (vite.config.ts). An exported game carries those files and may be played
 * offline, and a school filter that blocks jsdelivr must not stop a game
 * starting — the reason we served it ourselves in the first place. Either way
 * the CDN load fails and the next one is ours, so the cost is a failed request.
 *
 * SAME VERSION. The CDN address is built from the installed package's version
 * (`__PYODIDE_VERSION__`, defined in vite.config.ts from node_modules), so the
 * browser still runs exactly the Pyodide the Vitest suites run. A hand-typed
 * version here would drift on the next `npm update` — and loadPyodide refuses a
 * pyodide.asm.mjs whose version differs from its own, which would quietly turn
 * every load into the fallback and put the bandwidth back.
 *
 * `?localpyodide` on the page skips the CDN, so the fallback can be tested.
 */
declare const __PYODIDE_VERSION__: string;

export const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${__PYODIDE_VERSION__}/full/`;

/** The places to try, in order, as the page sends them to a worker. */
export function pyodideURLs(): string[] {
  // From the page's base, not its address: the play page at /play/<id>
  // has <base href="/">, and an exported game may sit in any folder.
  const ours = new URL("pyodide/", document.baseURI).href;
  return location.search.includes("localpyodide") ? [ours] : [PYODIDE_CDN, ours];
}

/** Try each place in turn; the last one's error is the one reported. */
export async function loadFirst<T>(urls: string[], load: (indexURL: string) => Promise<T>): Promise<T> {
  let last: unknown = new Error("No place to load Pyodide from.");
  for (const url of urls) {
    try {
      return await load(url);
    } catch (err) {
      last = err;
      console.warn(`Pyodide didn't load from ${url}; trying the next place.`, err);
    }
  }
  throw last;
}
