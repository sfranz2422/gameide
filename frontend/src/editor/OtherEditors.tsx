/**
 * The smaller editors: a sprite's origin and preview, a room's settings and
 * instance list, a script, the game's settings, and the starter sprite
 * picker. Sprite import and slicing (Phase 4) and the drag-and-drop room
 * editor (Phase 5) replace parts of these.
 */
import { useEffect, useState } from "react";
import { find } from "../store/project";
import { STARTER_SPRITES } from "../store/starterArt";
import { CodeEditor } from "./code/CodeEditor";
import { projectNames } from "./ObjectEditor";
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
        onChange={(code) => mutate((p) => void (find(p, "scripts", scriptId)!.code = code), { history: "skip" })}
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
        <input value={project.name} onChange={(e) => mutate((p) => void (p.name = e.target.value), { label: "rename the game" })} />
      </label>
      <label className="field">
        Steps per second
        <input
          type="number"
          min={1}
          max={240}
          value={project.settings.stepsPerSecond}
          onChange={(e) => mutate((p) => void (p.settings.stepsPerSecond = Math.min(240, Math.max(1, Number(e.target.value) || 60))), { label: "change steps per second" })}
        />
        <span className="muted small">How many times a second Step runs. 60 is usual; speeds are in pixels per step.</span>
      </label>
      <label className="check field">
        <input
          type="checkbox"
          checked={project.settings.pixelScaling !== false}
          onChange={(e) => mutate((p) => void (p.settings.pixelScaling = e.target.checked))}
          data-testid="pixel-scaling"
        />
        Crisp pixel scaling
        <span className="muted small">
          Grow the game window only by whole steps (2×, 3×…), so every pixel stays square. Turn off to fill the space exactly.
        </span>
      </label>
    </div>
  );
}
