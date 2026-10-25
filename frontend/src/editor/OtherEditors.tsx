/**
 * The smaller editors: a sprite's origin and preview, a room's settings and
 * instance list, a script, the game's settings, and the starter sprite
 * picker. Sprite import and slicing (Phase 4) and the drag-and-drop room
 * editor (Phase 5) replace parts of these.
 */
import { useEffect, useMemo, useState } from "react";
import { find, newId, type RoomInstance, type SpriteResource } from "../store/project";
import { STARTER_SPRITES } from "../store/starterArt";
import { CodeEditor } from "./code/CodeEditor";
import { projectNames } from "./ObjectEditor";
import { Icon } from "./ui/icons";
import { useProjectApi } from "./useProject";

/** Object URLs for a sprite's frames, revoked when no longer shown. */
function useFrameUrls(sprite: SpriteResource | undefined, assets: Map<string, Blob>): string[] {
  // Keyed on the frame ids, not the sprite: every edit to the project makes
  // a new sprite object, and remaking URLs on each keystroke would flicker.
  const frames = sprite?.frames.join(",") ?? "";
  const urls = useMemo(
    () => (frames ? frames.split(",").map((id) => (assets.get(id) ? URL.createObjectURL(assets.get(id)!) : "")) : []),
    [frames, assets],
  );
  useEffect(() => () => urls.forEach((u) => u && URL.revokeObjectURL(u)), [urls]);
  return urls;
}

export function SpriteThumb({ spriteId, size = 32 }: { spriteId: string | null; size?: number }) {
  const { project, assets } = useProjectApi();
  const sprite = find(project, "sprites", spriteId);
  const [url] = useFrameUrls(sprite, assets);
  if (!url) return <span className="thumb empty" style={{ width: size, height: size }} />;
  return <img className="thumb" src={url} alt="" style={{ width: size, height: size }} />;
}

export function SpriteEditor({ spriteId }: { spriteId: string }) {
  const { project, assets, mutate } = useProjectApi();
  const sprite = find(project, "sprites", spriteId);
  const urls = useFrameUrls(sprite, assets);
  const [speed, setSpeed] = useState(8);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!sprite || sprite.frames.length < 2 || speed <= 0) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % sprite.frames.length), 1000 / speed);
    return () => clearInterval(t);
  }, [sprite, speed]);
  if (!sprite) return <div className="empty-pane">This sprite was deleted.</div>;
  const set = (recipe: (s: SpriteResource) => void) => mutate((p) => recipe(find(p, "sprites", spriteId)!));
  const zoom = Math.max(1, Math.floor(192 / Math.max(sprite.width, sprite.height)));
  const presets: [string, number, number][] = [
    ["Top-left", 0, 0],
    ["Center", Math.floor(sprite.width / 2), Math.floor(sprite.height / 2)],
    ["Bottom-center", Math.floor(sprite.width / 2), sprite.height],
  ];
  const usedBy = project.objects.filter((o) => o.sprite === sprite.id).map((o) => o.name);

  return (
    <div className="sprite-editor" data-tutorial="sprite-editor">
      <div className="sprite-preview">
        <div
          className="checker"
          style={{ width: sprite.width * zoom, height: sprite.height * zoom }}
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = Math.round((e.clientX - r.left) / zoom), y = Math.round((e.clientY - r.top) / zoom);
            set((s) => ((s.originX = x), (s.originY = y)));
          }}
          title="Click to set the origin"
        >
          {urls[frame % Math.max(1, urls.length)] && <img src={urls[frame % urls.length]} alt={sprite.name} style={{ width: "100%", height: "100%" }} />}
          <span className="origin-mark" style={{ left: sprite.originX * zoom, top: sprite.originY * zoom }} />
        </div>
        <div className="frames">
          {urls.map((u, i) => (
            <img key={i} src={u} alt={`frame ${i}`} className={i === frame % urls.length ? "on" : ""} onClick={() => setFrame(i)} />
          ))}
        </div>
      </div>
      <div className="sprite-props">
        <p className="muted">
          {sprite.width} × {sprite.height} px, {sprite.frames.length} frame{sprite.frames.length === 1 ? "" : "s"}
          {usedBy.length ? ` · used by ${usedBy.join(", ")}` : ""}
        </p>
        <fieldset>
          <legend>Origin</legend>
          <p className="muted small">The point that sits at the instance's x, y. Click the picture to set it.</p>
          <label>
            x <input type="number" value={sprite.originX} onChange={(e) => set((s) => void (s.originX = Number(e.target.value) || 0))} />
          </label>
          <label>
            y <input type="number" value={sprite.originY} onChange={(e) => set((s) => void (s.originY = Number(e.target.value) || 0))} />
          </label>
          <div className="row">
            {presets.map(([label, x, y]) => (
              <button key={label} className="btn small" onClick={() => set((s) => ((s.originX = x), (s.originY = y)))}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        {sprite.frames.length > 1 && (
          <fieldset>
            <legend>Preview speed</legend>
            <input type="range" min={0} max={30} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /> {speed} frames/second
          </fieldset>
        )}
        <p className="muted small">Importing your own pictures and slicing sprite sheets arrive in a later phase.</p>
      </div>
    </div>
  );
}

export function SpritePicker({ onPick, onClose }: { onPick: (key: string) => void; onClose: () => void }) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    const out: Record<string, string> = {};
    for (const s of STARTER_SPRITES) {
      const c = document.createElement("canvas");
      c.width = s.width;
      c.height = s.height;
      s.paint(c.getContext("2d") as unknown as OffscreenCanvasRenderingContext2D, 0);
      out[s.key] = c.toDataURL();
    }
    setThumbs(out);
  }, []);
  return (
    <div className="modal-back" onPointerDown={onClose}>
      <div className="modal" role="dialog" aria-label="Add a sprite" onPointerDown={(e) => e.stopPropagation()}>
        <h3>Add a sprite</h3>
        <p className="muted">Pick a starter picture. Importing your own art comes in a later phase.</p>
        <div className="sprite-grid">
          {STARTER_SPRITES.map((s) => (
            <button key={s.key} className="sprite-card" onClick={() => onPick(s.key)} data-testid={`starter-${s.key}`}>
              {thumbs[s.key] && <img src={thumbs[s.key]} alt="" />}
              <span>{s.name}</span>
            </button>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoomEditor({ roomId }: { roomId: string }) {
  const { project, mutate } = useProjectApi();
  const room = find(project, "rooms", roomId);
  const [adding, setAdding] = useState(project.objects[0]?.id ?? "");
  if (!room) return <div className="empty-pane">This room was deleted.</div>;
  const set = (recipe: (r: NonNullable<typeof room>) => void) => mutate((p) => recipe(find(p, "rooms", roomId)!));
  const setInst = (id: string, recipe: (i: RoomInstance) => void) => set((r) => recipe(r.instances.find((i) => i.id === id)!));
  const counts = new Map<string, number>();
  for (const i of room.instances) counts.set(i.object, (counts.get(i.object) ?? 0) + 1);

  return (
    <div className="room-editor" data-tutorial="room-editor">
      <div className="props">
        <label>
          Width <input type="number" min={16} value={room.width} onChange={(e) => set((r) => void (r.width = Math.max(16, Number(e.target.value) || 16)))} />
        </label>
        <label>
          Height <input type="number" min={16} value={room.height} onChange={(e) => set((r) => void (r.height = Math.max(16, Number(e.target.value) || 16)))} />
        </label>
        <label>
          Background <input type="color" value={room.background} onChange={(e) => set((r) => void (r.background = e.target.value))} />
        </label>
      </div>
      <p className="muted small pad">
        The drag-and-drop room editor comes in a later phase. For now, list the instances the room starts with here — or make them in code with{" "}
        <code>instance_create</code>.
      </p>
      <div className="inst-add pad">
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Object to add" data-testid="room-add-object">
          {project.objects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <button
          className="btn"
          disabled={!adding}
          data-testid="room-add"
          onClick={() => {
            const inst = { id: newId(), object: adding, x: Math.round(room.width / 2), y: Math.round(room.height / 2) };
            set((r) => void r.instances.push(inst));
          }}
        >
          {Icon.plus()} Add instance
        </button>
        <span className="muted small">
          {room.instances.length} instance{room.instances.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="inst-table-wrap pad">
        <table className="inst-table">
          <thead>
            <tr>
              <th>Object</th>
              <th>x</th>
              <th>y</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {room.instances.slice(0, 300).map((i) => (
              <tr key={i.id}>
                <td>
                  <select value={i.object} onChange={(e) => setInst(i.id, (x) => void (x.object = e.target.value))} aria-label="Object">
                    {project.objects.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="number" value={i.x} onChange={(e) => setInst(i.id, (x) => void (x.x = Number(e.target.value) || 0))} aria-label="x" />
                </td>
                <td>
                  <input type="number" value={i.y} onChange={(e) => setInst(i.id, (x) => void (x.y = Number(e.target.value) || 0))} aria-label="y" />
                </td>
                <td>
                  <button className="icon-btn" aria-label="Remove instance" onClick={() => set((r) => void (r.instances = r.instances.filter((x) => x.id !== i.id)))}>
                    {Icon.trash()}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {room.instances.length > 300 && <p className="muted small">Showing the first 300 of {room.instances.length}.</p>}
      </div>
    </div>
  );
}

export function ScriptEditor({ scriptId, focus }: { scriptId: string; focus: { line: number; nonce: number } | null }) {
  const { project, mutate } = useProjectApi();
  const script = find(project, "scripts", scriptId);
  if (!script) return <div className="empty-pane">This script was deleted.</div>;
  return (
    <div className="script-editor">
      <div className="signature">Functions and values here can be used by every object. Scripts run in order, before any object.</div>
      <CodeEditor
        docKey={script.id}
        value={script.code}
        onChange={(code) => mutate((p) => void (find(p, "scripts", scriptId)!.code = code))}
        names={() => projectNames(project)}
        errorLine={focus}
        testId="script-code"
      />
    </div>
  );
}

export function SettingsEditor() {
  const { project, mutate } = useProjectApi();
  return (
    <div className="settings-editor pad">
      <label className="field">
        Game name
        <input value={project.name} onChange={(e) => mutate((p) => void (p.name = e.target.value))} />
      </label>
      <label className="field">
        Steps per second
        <input
          type="number"
          min={1}
          max={240}
          value={project.settings.stepsPerSecond}
          onChange={(e) => mutate((p) => void (p.settings.stepsPerSecond = Math.min(240, Math.max(1, Number(e.target.value) || 60))))}
        />
        <span className="muted small">How many times a second Step runs. 60 is usual; speeds are in pixels per step.</span>
      </label>
    </div>
  );
}
