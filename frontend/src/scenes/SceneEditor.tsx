/**
 * The Scene tab: a cutscene's steps as cards, in the order they play, with the
 * Python they make beside them, read-only. Every change saves the scene and its
 * Python (`onChange`). It keeps its own undo, as the sheet does: the project's
 * undo leaves code alone (history.ts).
 *
 * Cards move by a grip's drag, and by arrow buttons, because HTML drag and drop
 * doesn't work on a touch screen.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { API, type ApiFunction, type Param } from "../catalog/api";
import { CodeEditor } from "../editor/code/CodeEditor";
import { ExprBox } from "../eventsheets/ExprBox";
import type { SheetNames } from "../eventsheets/SheetEditor";
import { useProjectApi } from "../editor/useProject";
import { newId } from "../store/project";
import { startingRoom } from "./pick";
import { PositionPicker } from "./PositionPicker";
import { boxOf, EASES, isMainOption, linesOf, listOf, moveStep, newStep, quote, SCENE_GROUPS, sceneProblems, sceneToPython, stepLabel, unquote, type Scene, type SceneStep } from "./scene";

export interface SceneEditorProps {
  id: string;
  scene: Scene;
  code: string;
  onChange: (scene: Scene, code: string) => void;
  names: () => SheetNames;
  onConvert: () => void;
  errorLine: { line: number; nonce: number } | null;
  /** Can this event happen again (not Create)? Then Play once is worth a hint. */
  canRepeat: boolean;
  /** In a collision event, `other` is the one bumped into. */
  collision?: boolean;
  /** Whose event this is: the picker starts in a room it's in. */
  objectId?: string;
}

const UNDO_GROUP_MS = 1000;
const MAX_UNDO = 200;
/** The drag type of a card being moved: nothing else (a picture, text) is taken for one. */
const STEP_DRAG = "application/x-gameide-scene-step";

const fnOf = (name: string) => API.find((e): e is ApiFunction => e.kind === "function" && e.name === name);

export default function SceneEditor(props: SceneEditorProps) {
  const latest = useRef(props);
  latest.current = props;
  const past = useRef<{ scene: Scene; group: string | null; at: number }[]>([]);
  const future = useRef<Scene[]>([]);
  const [, redraw] = useState(0);

  const save = (scene: Scene) => latest.current.onChange(scene, sceneToPython(scene).code);
  const edit = (recipe: (s: Scene) => void, group: string | null = null) => {
    const before = latest.current.scene;
    const next = structuredClone(before);
    recipe(next);
    const last = past.current[past.current.length - 1];
    const now = Date.now();
    if (!(group && last && last.group === group && now - last.at < UNDO_GROUP_MS)) {
      past.current.push({ scene: before, group, at: now });
      if (past.current.length > MAX_UNDO) past.current.shift();
    } else last.at = now;
    future.current = [];
    save(next);
  };
  const undo = () => {
    const step = past.current.pop();
    if (!step) return;
    future.current.push(latest.current.scene);
    save(step.scene);
    redraw((n) => n + 1);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ scene: latest.current.scene, group: null, at: 0 });
    save(next);
    redraw((n) => n + 1);
  };

  const python = useMemo(() => sceneToPython(props.scene), [props.scene]);
  const problems = useMemo(() => sceneProblems(props.scene), [props.scene]);

  // Python saved by an older version of this file is brought up to date.
  useEffect(() => {
    if (python.code !== latest.current.code) latest.current.onChange(latest.current.scene, python.code);
  }, [python.code]);

  const errorId = props.errorLine ? (python.lines[props.errorLine.line - 1] ?? null) : null;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errorId) root.current?.querySelector(`[data-step-id="${CSS.escape(errorId)}"]`)?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.errorLine?.nonce]);

  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const add = (fn: string) => {
    const id = newId();
    const scene = latest.current.scene;
    const made = newStep(fn, id, latest.current.names(), scene);
    const at = scene.steps.findIndex((s) => s.id === selected);
    edit((s) => void s.steps.splice(at < 0 ? s.steps.length : at + 1, 0, made));
    setSelected(id);
    setPicking(false);
  };

  const dragging = useRef<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const finishDrop = () => {
    const id = dragging.current;
    const at = dropAt;
    dragging.current = null;
    setDropAt(null);
    if (!id || at === null) return;
    const from = latest.current.scene.steps.findIndex((s) => s.id === id);
    if (from >= 0 && at !== from && at !== from + 1) edit((s) => moveStep(s, id, at > from ? at - 1 : at));
  };

  const once = !!props.scene.once;
  // Made here, not in the recipe: a recipe mustn't create ids (React may run it twice).
  const seenName = `seen_${newId().toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  return (
    <div className="blocks-split">
      <div
        className="scene-editor"
        ref={root}
        data-testid="scene"
        data-tutorial="scene-editor"
        onKeyDown={(e) => {
          const t = e.target as HTMLElement;
          if (!(e.ctrlKey || e.metaKey) || t.closest(".cm-editor") || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
          const k = e.key.toLowerCase();
          if (k !== "z" && k !== "y") return;
          e.preventDefault();
          if (k === "y" || e.shiftKey) redo();
          else undo();
        }}
      >
        <div className="sheet-toolbar">
          <span className="sheet-add">
            <button className="btn small go" onClick={() => setPicking((o) => !o)} aria-expanded={picking} data-testid="scene-add">
              + Add a step
            </button>
            {picking && <StepPicker onPick={add} onClose={() => setPicking(false)} />}
          </span>
          <label className="scene-once" title="Remember for the rest of the game that this scene has played, so coming back doesn't play it again">
            <input
              type="checkbox"
              checked={once}
              onChange={(e) => {
                const on = e.target.checked;
                edit((s) => {
                  if (on) s.once = seenName;
                  else delete s.once;
                });
              }}
              data-testid="scene-once"
            />
            Play once
          </label>
          <span className="spacer" />
          <button className="icon-btn" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)" data-testid="scene-undo">
            ↶
          </button>
          <button className="icon-btn" onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Y)" data-testid="scene-redo">
            ↷
          </button>
        </div>
        {props.canRepeat && !once && props.scene.steps.length > 0 && (
          <p className="scene-hint" data-testid="scene-repeat-hint">
            This event can happen more than once, and the scene would start again each time. Tick <b>Play once</b> if it should only play the first time.
          </p>
        )}
        <div
          className="scene-steps"
          data-testid="scene-steps"
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(STEP_DRAG)) return;
            e.preventDefault();
            if (e.target === e.currentTarget) setDropAt(props.scene.steps.length);
          }}
          onDrop={(e) => {
            e.preventDefault();
            finishDrop();
          }}
        >
          {props.scene.steps.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              count={props.scene.steps.length}
              scene={props.scene}
              problem={problems.get(step.id) ?? null}
              failed={errorId === step.id}
              selected={selected === step.id}
              dropBefore={dropAt === i}
              dropAfter={dropAt === i + 1 && i === props.scene.steps.length - 1}
              names={props.names}
              collision={!!props.collision}
              objectId={props.objectId}
              edit={edit}
              onSelect={() => setSelected(step.id)}
              onDragStart={() => (dragging.current = step.id)}
              onDragEnd={() => ((dragging.current = null), setDropAt(null))}
              onDragOverCard={(after) => setDropAt(after ? i + 1 : i)}
            />
          ))}
          {!props.scene.steps.length && <p className="sheet-empty muted">A scene is a list of steps that play one after another while the game holds still. Press <b>+ Add a step</b> to begin.</p>}
        </div>
      </div>
      <div className="blocks-python" data-tutorial="scene-python">
        <div className="blocks-python-head">
          <span title="The Python your scene makes. It changes as the scene does.">Python</span>
          <button className="btn small" onClick={props.onConvert} data-testid="convert-to-python" title="Edit this as Python from now on">
            Convert to Python
          </button>
        </div>
        <CodeEditor docKey={`scene:${props.id}`} value={props.code} readOnly testId="scene-code" errorLine={props.errorLine} />
      </div>
    </div>
  );
}

function StepPicker({ onPick, onClose }: { onPick: (fn: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    window.addEventListener("mousedown", away);
    return () => window.removeEventListener("mousedown", away);
  }, [onClose]);
  return (
    <div className="sheet-picker scene-picker" ref={ref} role="dialog" aria-label="Add a step" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="sheet-picker-list">
        {SCENE_GROUPS.map((g) => (
          <div key={g.label}>
            <h4>{g.label}</h4>
            <div className="scene-picker-group">
              {Object.entries(g.steps).map(([fn, label]) => (
                <button key={fn} className="menu-item" title={fnOf(fn)?.description} onClick={() => onPick(fn)} data-testid={`step-${fn}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  step: SceneStep;
  index: number;
  count: number;
  scene: Scene;
  problem: string | null;
  failed: boolean;
  selected: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
  names: () => SheetNames;
  collision: boolean;
  objectId: string | undefined;
  edit: (recipe: (s: Scene) => void, group?: string | null) => void;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverCard: (after: boolean) => void;
}

function StepCard(c: CardProps) {
  const { step, scene, edit } = c;
  const f = fnOf(step.fn);
  const [more, setMore] = useState(false);
  const change = (recipe: (s: SceneStep) => void, group: string | null = null) =>
    edit((sc) => {
      const s = sc.steps.find((x) => x.id === step.id);
      if (s) recipe(s);
    }, group);
  const required = f?.params.filter((p) => p.default === undefined) ?? [];
  const main = f?.params.filter((p) => p.default === undefined || isMainOption(p)) ?? [];
  const optional = f?.params.filter((p) => p.default !== undefined && !isMainOption(p)) ?? [];
  // Optional boxes that hold something stay open, or a value could hide behind a closed door.
  const showMore = more || optional.some((p) => step.args[p.name]);
  const box = (p: Param) => <ValueBox key={p.name} p={p} step={step} scene={scene} names={c.names} collision={c.collision} change={change} />;
  return (
    <div
      className={`scene-step${c.selected ? " on" : ""}${c.problem ? " bad" : ""}${c.failed ? " error" : ""}${c.dropBefore ? " drop-before" : ""}${c.dropAfter ? " drop-after" : ""}`}
      data-step-id={step.id}
      data-testid="scene-step"
      onMouseDownCapture={c.onSelect}
      onFocusCapture={c.onSelect}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(STEP_DRAG)) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        c.onDragOverCard(e.clientY > r.top + r.height / 2);
      }}
    >
      <span
        className="sheet-grip"
        draggable
        title="Drag to move this step"
        data-testid="scene-grip"
        onDragStart={(e) => {
          e.dataTransfer.setData(STEP_DRAG, step.id);
          e.dataTransfer.effectAllowed = "move";
          c.onDragStart();
        }}
        onDragEnd={c.onDragEnd}
      >
        ⠿
      </span>
      <div className="scene-step-body">
        <div className="scene-step-head">
          <span className="scene-number">{c.index + 1}</span>
          <b title={f?.description}>{stepLabel(step.fn)}</b>
          {step.fn === "scene_create" && (
            <label className="scene-field">
              called
              <input value={step.as ?? ""} onChange={(e) => change((s) => void (s.as = e.target.value), `as:${step.id}`)} data-testid="scene-as" />
            </label>
          )}
          <span className="spacer" />
          {optional.length > 0 && !optional.some((p) => step.args[p.name]) && (
            <button className="sheet-plus" onClick={() => setMore((m) => !m)} aria-expanded={more} data-testid="scene-more">
              {more ? "Less" : "More"}
            </button>
          )}
          <button className="icon-btn small" disabled={c.index === 0} onClick={() => edit((s) => moveStep(s, step.id, c.index - 1))} aria-label="Move up" data-testid="scene-up">
            ▲
          </button>
          <button className="icon-btn small" disabled={c.index === c.count - 1} onClick={() => edit((s) => moveStep(s, step.id, c.index + 1))} aria-label="Move down" data-testid="scene-down">
            ▼
          </button>
          <button className="icon-btn small" onClick={() => edit((s) => void (s.steps = s.steps.filter((x) => x.id !== step.id)))} aria-label="Delete this step" title="Delete this step" data-testid="scene-delete">
            ✕
          </button>
        </div>
        <div className="scene-fields">
          {main.map(box)}
          {showMore && optional.map(box)}
          {required.some((p) => p.name === "x") && <PickButton step={step} objectId={c.objectId} change={change} />}
        </div>
        {c.problem && (
          <p className="sheet-problem" data-testid="scene-problem">
            {c.problem}
          </p>
        )}
      </div>
    </div>
  );
}

/** The room last picked in, per scene card editor: the next pick is most likely in the same one. */
let lastRoom: string | null = null;

function PickButton({ step, objectId, change }: { step: SceneStep; objectId: string | undefined; change: (r: (s: SceneStep) => void) => void }) {
  const { project, assets } = useProjectApi();
  const [open, setOpen] = useState(false);
  const known = project.rooms.find((r) => r.id === lastRoom)?.id ?? startingRoom(project, objectId)?.id;
  const num = (v: string | undefined) => (v !== undefined && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : null);
  const x = num(step.args.x), y = num(step.args.y);
  return (
    <>
      <button className="btn small scene-pick-btn" onClick={() => setOpen(true)} disabled={!known} title={known ? "Click the place in the room instead of typing x and y" : "This game has no room yet"} data-testid="scene-pick">
        Pick in room
      </button>
      {open && known && (
        <PositionPicker
          project={project}
          assets={assets}
          roomId={known}
          showView={step.fn === "scene_camera"}
          current={x !== null && y !== null ? { x, y } : null}
          onClose={() => setOpen(false)}
          onPick={(px, py, roomId) => {
            lastRoom = roomId;
            setOpen(false);
            change((s) => {
              s.args.x = String(px);
              s.args.y = String(py);
            });
          }}
        />
      )}
    </>
  );
}

const WORDS: Record<string, string> = { text: "Words", question: "Question", name: "Speaker", choices: "Choices, one a line", instance: "Who", above: "Bubble over", picture: "Face", steps: "Steps", sprite: "Sprite", obj: "Object", sound: "Sound", room: "Room", target: "Toward", function: "Function", then: "Then call", on: "Bars on", wait: "Wait for it", ease: "Easing", color: "Colour", size: "Size", zoom: "Zoom", strength: "Strength", to: "To (1 = covered)" };

function ValueBox({ p, step, scene, names, collision, change }: { p: Param; step: SceneStep; scene: Scene; names: () => SheetNames; collision: boolean; change: (r: (s: SceneStep) => void, group?: string | null) => void }) {
  const value = step.args[p.name] ?? "";
  const kind = boxOf(p);
  const set = (v: string, group: string | null = null) =>
    change((s) => {
      if (v) s.args[p.name] = v;
      else delete s.args[p.name];
    }, group);
  const group = `${step.id}:${p.name}`;
  const word = WORDS[p.name] ?? p.name;
  const test = `scene-${step.fn}-${p.name}`;
  const n = names();

  if (kind === "text") {
    return (
      <label className={`scene-field${p.name === "name" ? "" : " wide"}`}>
        {word}
        <input value={value ? unquote(value) : ""} onChange={(e) => set(e.target.value ? quote(e.target.value) : "", group)} data-testid={test} />
      </label>
    );
  }
  if (kind === "choices") {
    return (
      <label className="scene-field wide">
        {word}
        <textarea rows={Math.max(2, linesOf(value).length)} value={linesOf(value).join("\n")} onChange={(e) => set(e.target.value ? listOf(e.target.value.split("\n")) : "", group)} data-testid={test} />
      </label>
    );
  }
  if (kind === "bool") {
    const on = (value || p.default || "False") === "True";
    return (
      <label className="scene-field row">
        <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked ? "True" : "False")} data-testid={test} />
        {word}
      </label>
    );
  }
  if (kind === "color") {
    // A colour a person typed in Python ("red") has no place in the picker; white is its neighbour.
    const hex = /^"#[0-9a-f]{6}"$/i.test(value) ? unquote(value) : p.default === '"black"' && !value ? "#000000" : "#ffffff";
    return (
      <label className="scene-field">
        {word}
        <input type="color" value={hex} onChange={(e) => set(quote(e.target.value), group)} data-testid={test} />
      </label>
    );
  }

  let options: { label: string; code: string }[] | null = null;
  const fromList = (list: string[] | undefined) => (list ?? []).map((x) => ({ label: x, code: quote(x) }));
  if (kind === "ease") options = EASES.map((x) => ({ label: x, code: quote(x) }));
  else if (kind === "name") options = fromList(p.type === "sprite" ? n.sprites : p.type === "object" ? n.objects : p.type === "room" ? n.rooms : n.sounds);
  else if (kind === "function") options = n.functions.filter((x) => (p.name === "then" ? x.params.length === 1 : !x.params.length)).map((x) => ({ label: `${x.name}()`, code: x.name }));
  else if (kind === "actor" || kind === "face") {
    const before = scene.steps.slice(0, scene.steps.findIndex((s) => s.id === step.id)).flatMap((s) => (s.as ? [s.as] : []));
    options = [
      ...(kind === "face" ? [{ label: "left", code: quote("left") }, { label: "right", code: quote("right") }] : []),
      { label: "this one (self)", code: "self" },
      ...(collision ? [{ label: "the one bumped into (other)", code: "other" }] : []),
      ...before.map((x) => ({ label: x, code: x })),
      ...n.objects.map((x) => ({ label: `the first ${x}`, code: `instances(${quote(x)})[0]` })),
    ];
  }

  if (options) {
    const optional = p.default !== undefined;
    return (
      <label className="scene-field">
        {word}
        <select value={value} onChange={(e) => set(e.target.value)} data-testid={test}>
          {(optional || !value) && <option value="">{optional ? "—" : "Choose…"}</option>}
          {/* A name that's gone stays listed: the card says what's wrong, and a silent swap would change the scene. */}
          {value && !options.some((o) => o.code === value) && <option value={value}>{unquote(value)}</option>}
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="scene-field">
      {word}
      <ExprBox value={value} onChange={(v) => set(v.trim() ? v : "", group)} problem={null} label={word} names={names} type={p.type} testId={test} />
    </label>
  );
}
