/**
 * The free art library's window (library.ts): choose a pack, then either
 * take a whole sheet as a tileset, or click cells of a sheet — in the order
 * they should play — and add them as one sprite's frames.
 */
import { useEffect, useRef, useState } from "react";
import { LIBRARY, type LibraryPack, type LibrarySheet } from "./library";

export interface LibrarySprite {
  name: string;
  frames: Blob[];
  width: number;
  height: number;
}

export interface LibraryTileset {
  name: string;
  image: Blob;
  tileWidth: number;
  tileHeight: number;
}

const loaded = new Map<string, Promise<ImageBitmap>>();
function picture(file: string): Promise<ImageBitmap> {
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

export function LibraryBrowser({
  onClose,
  onSprite,
  onTileset,
}: {
  onClose: () => void;
  onSprite: (s: LibrarySprite) => void;
  onTileset: (t: LibraryTileset) => void;
}) {
  const [pack, setPack] = useState<LibraryPack | null>(null);
  return (
    <div className="modal-back" onPointerDown={onClose}>
      <div className="modal library" role="dialog" aria-label="Free art library" onPointerDown={(e) => e.stopPropagation()}>
        <h3>{pack ? pack.name : "Free art library"}</h3>
        {!pack ? (
          <>
            <p className="muted small">
              Packs by Kenney, free for anything: they're public domain (CC0), so your games can use them, share them, even sell them. A credit is kind, not required.
            </p>
            <div className="library-packs">
              {LIBRARY.map((p) => (
                <button key={p.id} className="library-pack" onClick={() => setPack(p)} data-testid={`library-${p.id}`}>
                  <img src={p.preview} alt="" />
                  <b>{p.name}</b>
                  <span className="muted small">{p.about}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="muted small">
              By {pack.author} · {pack.licence} ·{" "}
              <a href={pack.url} target="_blank" rel="noreferrer">
                kenney.nl
              </a>
            </p>
            {pack.sheets.map((s) => (
              <SheetPicker key={s.file} pack={pack} sheet={s} onSprite={onSprite} onTileset={onTileset} />
            ))}
          </>
        )}
        <div className="modal-foot">
          {pack && (
            <button className="btn" onClick={() => setPack(null)}>
              ← All packs
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SheetPicker({
  pack,
  sheet,
  onSprite,
  onTileset,
}: {
  pack: LibraryPack;
  sheet: LibrarySheet;
  onSprite: (s: LibrarySprite) => void;
  onTileset: (t: LibraryTileset) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void picture(sheet.file).then(setImg);
  }, [sheet.file]);
  const zoom = img ? Math.max(1, Math.min(4, Math.floor(560 / img.width))) : 1;
  const columns = img ? Math.floor(img.width / sheet.tileWidth) : 0;
  const rows = img ? Math.floor(img.height / sheet.tileHeight) : 0;

  useEffect(() => {
    const c = canvas.current;
    if (!c || !img) return;
    c.width = img.width * zoom;
    c.height = img.height * zoom;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.font = "bold 11px system-ui";
    const w = sheet.tileWidth * zoom, h = sheet.tileHeight * zoom;
    for (let n = 0; n < columns * rows; n++) {
      const x = (n % columns) * w, y = Math.floor(n / columns) * h;
      const at = chosen.indexOf(n);
      ctx.strokeStyle = at >= 0 ? "#2fbf8a" : "rgba(255,255,255,0.15)";
      ctx.lineWidth = at >= 0 ? 3 : 1;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      if (at >= 0) {
        ctx.fillStyle = "#2fbf8a";
        ctx.fillRect(x + 2, y + 2, 14, 13);
        ctx.fillStyle = "#06261a";
        ctx.fillText(String(at + 1), x + 4, y + 13);
      }
    }
  });

  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!img) return;
    const b = e.currentTarget.getBoundingClientRect();
    const c = Math.floor((e.clientX - b.left) / (sheet.tileWidth * zoom)), r = Math.floor((e.clientY - b.top) / (sheet.tileHeight * zoom));
    if (c < 0 || r < 0 || c >= columns || r >= rows) return;
    const n = r * columns + c;
    if (e.shiftKey && chosen.length) {
      // A run, from the last chosen to this one, in order.
      const from = chosen[chosen.length - 1]!;
      const step = n >= from ? 1 : -1;
      const more: number[] = [];
      for (let i = from + step; i !== n + step; i += step) if (!chosen.includes(i)) more.push(i);
      setChosen([...chosen, ...more]);
    } else setChosen(chosen.includes(n) ? chosen.filter((x) => x !== n) : [...chosen, n]);
  };

  const base = `${pack.id}-${sheet.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section className="library-sheet" data-testid={`sheet-${sheet.name}`}>
      <div className="row">
        <b>{sheet.name}</b>
        <span className="muted small">
          {sheet.tileWidth} × {sheet.tileHeight} px · click cells for a sprite's frames, in order (shift-click for a run)
        </span>
      </div>
      <div className="library-canvas checker-bg">
        {/* data-ready once the sheet is drawn: until then it's the browser's blank 300 × 150 and takes no clicks. */}
        <canvas ref={canvas} onClick={click} data-testid={`sheet-canvas-${sheet.name}`} data-ready={img ? "1" : undefined} />
      </div>
      <div className="row">
        <button
          className="btn go small"
          disabled={!chosen.length || busy}
          onClick={async () => {
            setBusy(true);
            try {
              onSprite({ name: `${base}-${chosen[0]}`, frames: await cutCells(sheet, chosen), width: sheet.tileWidth, height: sheet.tileHeight });
              setChosen([]);
            } finally {
              setBusy(false);
            }
          }}
          data-testid={`sheet-sprite-${sheet.name}`}
        >
          Add as a sprite{chosen.length ? ` (${chosen.length} frame${chosen.length === 1 ? "" : "s"})` : ""}
        </button>
        <button
          className={`btn small${sheet.use === "tiles" ? " go" : ""}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const image = await (await fetch(sheet.file)).blob();
              onTileset({ name: base, image, tileWidth: sheet.tileWidth, tileHeight: sheet.tileHeight });
            } finally {
              setBusy(false);
            }
          }}
          data-testid={`sheet-tileset-${sheet.name}`}
        >
          Add the sheet as a tileset
        </button>
        {chosen.length > 0 && (
          <button className="btn small" onClick={() => setChosen([])}>
            Clear
          </button>
        )}
      </div>
    </section>
  );
}
