/**
 * The smaller editors: a sprite's origin and preview, a room's settings and
 * instance list, a script, the game's settings, and the starter sprite
 * picker. Sprite import and slicing (Phase 4) and the drag-and-drop room
 * editor (Phase 5) replace parts of these.
 */
import { useEffect, useState } from "react";
import { find, newId, type RoomInstance } from "../store/project";
import { STARTER_SPRITES } from "../store/starterArt";
import { CodeEditor } from "./code/CodeEditor";
import { projectNames } from "./ObjectEditor";
import { Icon } from "./ui/icons";
import { useProjectApi } from "./useProject";

export function SpritePicker({ onPick, onImport, onClose }: { onPick: (key: string) => void; onImport: () => void; onClose: () => void }) {
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
        <button className="import-own" onClick={onImport} data-testid="import-picture">
          <b>Import your own picture…</b>
          <span className="muted small">PNG, JPG or GIF — one picture, a sprite sheet, or an animated GIF. You can also drop a picture anywhere in the editor, or paste one.</span>
        </button>
        <p className="muted small">Or start with one of these:</p>
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
