/**
 * One object: its settings across the top, its events down the left, and
 * the selected event's code. Each event is the body of one method; the
 * `def` line it lives in is shown above the box, and "Python class" shows
 * the whole generated class, read-only, so students see the real Python.
 *
 * An event is written in Python or with blocks (its `mode`), and the tabs
 * say which. An empty event can be switched either way freely. One with
 * blocks can be converted to Python, once, after a warning; Python never
 * goes back to blocks — that would mean reading arbitrary code as blocks,
 * and a student's typing would come back changed.
 */
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { emptyBlocks, hasBlocks } from "../blocks/blockState";
import { KEY_NAMES } from "../engine/layout";
import { generateObject, methodSignature } from "../python/codegen";
import {
  eventLabel,
  eventSortKey,
  find,
  newEvent,
  sameEvent,
  wouldLoop,
  type EventKey,
  type ObjectEvent,
  type ObjectResource,
  type Project,
} from "../store/project";
import { CodeEditor } from "./code/CodeEditor";
import type { ProjectNames } from "./code/pythonHelp";
import { Icon } from "./ui/icons";
import { useProjectApi } from "./useProject";

// Blockly is about 700 KB: fetched the first time a Blocks tab opens.
const BlocksEditor = lazy(() => import("../blocks/BlocksEditor"));

export interface EventFocus {
  eventId: string;
  line: number;
  nonce: number;
}

export function projectNames(p: Project): ProjectNames {
  return {
    objects: p.objects.map((o) => o.name),
    sprites: p.sprites.map((s) => s.name),
    rooms: p.rooms.map((r) => r.name),
    layers: [...new Set(p.rooms.flatMap((r) => r.layers.filter((l) => l.kind === "tiles").map((l) => l.name)))],
  };
}

export function ObjectEditor({
  objectId,
  selected,
  select,
  focus,
}: {
  objectId: string;
  selected: string | null;
  select: (eventId: string | null) => void;
  focus: EventFocus | null;
}) {
  const { project, mutate } = useProjectApi();
  const obj = find(project, "objects", objectId);
  const [showClass, setShowClass] = useState(false);
  const [adding, setAdding] = useState(false);
  const generated = useMemo(() => (obj && showClass ? generateObject(project, obj).source : ""), [project, obj, showClass]);
  const projectRef = useRef(project);
  projectRef.current = project;
  if (!obj) return <div className="empty-pane">This object was deleted.</div>;

  /** `label` names the undo step ("Undo change depth"), and keeps different changes apart. */
  const set = (recipe: (o: ObjectResource) => void, label: string) => mutate((p) => recipe(find(p, "objects", objectId)!), { label });
  const events = [...obj.events].sort((a, b) => eventSortKey(a.key) - eventSortKey(b.key));
  const current = obj.events.find((e) => e.id === selected) ?? events[0] ?? null;

  const addEvent = (key: EventKey) => {
    setAdding(false);
    const existing = obj.events.find((e) => sameEvent(e.key, key));
    if (existing) return select(existing.id);
    const ev = newEvent(key);
    set((o) => void o.events.push(ev), `add ${eventLabel(project, key)} event`);
    select(ev.id);
  };

  const removeEvent = (id: string) => {
    const ev = obj.events.find((e) => e.id === id)!;
    if ((ev.code.trim() || hasBlocks(ev.blocks)) && !confirm(`Delete the ${eventLabel(project, ev.key)} event and its code?`)) return;
    set((o) => void (o.events = o.events.filter((e) => e.id !== id)), `delete ${eventLabel(project, ev.key)} event`);
    if (selected === id) select(null);
  };

  // Changing how an event is written is a change to its code, so it stays
  // out of the project's undo like typing does (history.ts).
  const setEvent = (eventId: string, recipe: (e: ObjectEvent) => void) =>
    mutate(
      (p) => {
        const ev = find(p, "objects", objectId)?.events.find((x) => x.id === eventId);
        if (ev) recipe(ev);
      },
      { history: "skip" },
    );
  const toBlocks = (ev: ObjectEvent) => {
    setShowClass(false);
    if (ev.mode === "blocks") return;
    if (ev.code.trim()) return; // the tab is disabled: Python never becomes blocks
    setEvent(ev.id, (e) => {
      e.mode = "blocks";
      e.blocks = emptyBlocks();
    });
  };
  const toPython = (ev: ObjectEvent) => {
    setShowClass(false);
    if (ev.mode === "python") return;
    if (
      hasBlocks(ev.blocks) &&
      !confirm(
        `Turn the ${eventLabel(project, ev.key)} event into Python?\n\nYou'll edit the Python from now on. It can't be turned back into blocks.`,
      )
    )
      return;
    setEvent(ev.id, (e) => {
      e.mode = "python";
      delete e.blocks;
    });
  };
  const isBlocks = current?.mode === "blocks";

  return (
    <div className="object-editor" data-tutorial="object-editor">
      <div className="props" data-tutorial="object-properties">
        <label>
          Sprite
          <select
            value={obj.sprite ?? ""}
            onChange={(e) => set((o) => void (o.sprite = e.target.value || null), "change sprite")}
            data-tutorial="object-sprite"
            data-testid="object-sprite"
          >
            <option value="">(none)</option>
            {project.sprites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Parent
          <select value={obj.parent ?? ""} onChange={(e) => set((o) => void (o.parent = e.target.value || null), "change parent")} data-tutorial="object-parent">
            <option value="">(none)</option>
            {project.objects
              .filter((o) => o.id !== obj.id)
              .map((o) => (
                <option key={o.id} value={o.id} disabled={wouldLoop(project, obj.id, o.id)}>
                  {o.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Depth
          <input
            type="number"
            value={obj.depth}
            onChange={(e) => set((o) => void (o.depth = Number(e.target.value) || 0), "change depth")}
            style={{ width: 64 }}
            data-tutorial="object-depth"
            title="Lower depth is drawn on top"
          />
        </label>
        {(["visible", "solid", "persistent"] as const).map((k) => (
          <label key={k} className="check" data-tutorial={`object-${k}`}>
            <input type="checkbox" checked={obj[k]} onChange={(e) => set((o) => void (o[k] = e.target.checked), `change ${k}`)} />
            {k[0]!.toUpperCase() + k.slice(1)}
          </label>
        ))}
      </div>

      <div className="events-split">
        <aside className="event-list" data-tutorial="event-list">
          <div className="event-list-head">Events</div>
          <ul>
            {events.map((e) => (
              <li key={e.id} className={current?.id === e.id ? "active" : ""}>
                <button className="event-btn" onClick={() => select(e.id)} data-testid={`event-${eventLabel(project, e.key)}`}>
                  {eventLabel(project, e.key)}
                  {!e.code.trim() && <span className="event-empty" title="No code yet">·</span>}
                </button>
                <button className="icon-btn event-del" aria-label={`Delete ${eventLabel(project, e.key)} event`} onClick={() => removeEvent(e.id)}>
                  {Icon.trash()}
                </button>
              </li>
            ))}
          </ul>
          <div className="add-event-wrap">
            <button className="btn add-event" onClick={() => setAdding((a) => !a)} data-tutorial="add-event" data-testid="add-event" aria-expanded={adding}>
              {Icon.plus()} Add event
            </button>
            {adding && <AddEventMenu project={project} obj={obj} onPick={addEvent} onClose={() => setAdding(false)} />}
          </div>
        </aside>

        <section className="event-code">
          <div className="code-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={!showClass && !isBlocks}
              className={!showClass && !isBlocks ? "on" : ""}
              onClick={() => (current ? toPython(current) : setShowClass(false))}
              data-testid="tab-python"
              title={isBlocks ? "Turn these blocks into Python, to edit as Python from now on" : "Write this event in Python"}
            >
              Python
            </button>
            <button
              role="tab"
              aria-selected={!showClass && isBlocks}
              className={!showClass && isBlocks ? "on" : ""}
              disabled={!current || (!isBlocks && !!current.code.trim())}
              onClick={() => current && toBlocks(current)}
              data-testid="tab-blocks"
              data-tutorial="tab-blocks"
              title={
                current && !isBlocks && current.code.trim()
                  ? "This event is written in Python. Python can't be turned into blocks — add a new event to use blocks."
                  : "Build this event with code blocks"
              }
            >
              Blocks
            </button>
            <button role="tab" disabled title="Event sheets arrive in a later phase">
              Event Sheet
            </button>
            <span className="spacer" />
            <button
              role="tab"
              aria-selected={showClass}
              className={showClass ? "on" : ""}
              onClick={() => setShowClass((s) => !s)}
              data-tutorial="generated-class"
              title="See the whole Python class your events make"
            >
              {Icon.code()} Python class
            </button>
          </div>
          {showClass ? (
            <>
              <div className="signature">The Python your events make. Read-only — edit the events instead.</div>
              <CodeEditor docKey={`class:${obj.id}`} value={generated} readOnly testId="generated-class" />
            </>
          ) : current && isBlocks ? (
            <Suspense fallback={<div className="empty-pane">Loading blocks…</div>}>
              <BlocksEditor
                key={current.id}
                eventId={current.id}
                signature={methodSignature(project, current.key)}
                state={current.blocks ?? emptyBlocks()}
                code={current.code}
                onChange={(blocks, code) =>
                  setEvent(current.id, (e) => {
                    e.blocks = blocks;
                    e.code = code;
                  })
                }
                names={() => ({ layers: [], ...projectNames(projectRef.current) })}
                onConvert={() => toPython(current)}
                errorLine={focus && focus.eventId === current.id ? { line: focus.line, nonce: focus.nonce } : null}
              />
            </Suspense>
          ) : current ? (
            <>
              <div className="signature" title="Your code is the inside of this method">
                <code>{methodSignature(project, current.key)}</code>
              </div>
              <CodeEditor
                docKey={current.id}
                value={current.code}
                onChange={(code) =>
                  // Code has its own undo, in its editor (history.ts).
                  mutate(
                    (p) => {
                      const ev = find(p, "objects", objectId)?.events.find((x) => x.id === current.id);
                      if (ev) ev.code = code;
                    },
                    { history: "skip" },
                  )
                }
                names={() => projectNames(project)}
                errorLine={focus && focus.eventId === current.id ? { line: focus.line, nonce: focus.nonce } : null}
                testId="event-code"
              />
            </>
          ) : (
            <div className="empty-pane">
              <p>
                <b>{obj.name}</b> has no events yet.
              </p>
              <p>Add one — Create runs once when an instance appears, Step runs every frame.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AddEventMenu({ project, obj, onPick, onClose }: { project: Project; obj: ObjectResource; onPick: (k: EventKey) => void; onClose: () => void }) {
  const has = (k: EventKey) => obj.events.some((e) => sameEvent(e.key, k));
  const [keyKind, setKeyKind] = useState<"down" | "pressed" | "released">("pressed");
  const [keyName, setKeyName] = useState<(typeof KEY_NAMES)[number]>("space");
  const [collide, setCollide] = useState(project.objects[0]?.id ?? "");
  const [alarm, setAlarm] = useState(0);
  const [mouse, setMouse] = useState("left pressed false");

  const simple = (label: string, type: EventKey["type"] & string, hint: string) => {
    const k = { type } as EventKey;
    return (
      <button className="menu-item" disabled={has(k)} onClick={() => onPick(k)} title={hint} data-testid={`pick-${type}`}>
        {label}
      </button>
    );
  };

  return (
    <div className="add-event-menu" role="dialog" aria-label="Add event" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="menu-group">
        <h4>Basics</h4>
        {simple("Create", "create", "Runs once, when an instance appears")}
        {simple("Step", "step", "Runs every frame (60 times a second)")}
        {simple("Draw", "draw", "Draw it yourself; the sprite is drawn only if you call draw_self()")}
        {simple("Draw GUI", "draw_gui", "Draw on the screen, over everything, where the camera can't move it: scores, health, menus")}
        {simple("Destroy", "destroy", "Runs when the instance is destroyed")}
      </div>
      <div className="menu-group">
        <h4>Collision with</h4>
        <div className="menu-row">
          <select value={collide} onChange={(e) => setCollide(e.target.value)} aria-label="Collision with" data-testid="collision-target">
            {project.objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button className="btn small" disabled={!collide || has({ type: "collision", object: collide })} onClick={() => onPick({ type: "collision", object: collide })} data-testid="pick-collision">
            Add
          </button>
        </div>
      </div>
      <div className="menu-group">
        <h4>Keyboard</h4>
        <div className="menu-row">
          <select value={keyKind} onChange={(e) => setKeyKind(e.target.value as typeof keyKind)} aria-label="Key event">
            <option value="pressed">Pressed</option>
            <option value="down">Down (held)</option>
            <option value="released">Released</option>
          </select>
          <select value={keyName} onChange={(e) => setKeyName(e.target.value as typeof keyName)} aria-label="Key">
            {KEY_NAMES.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button className="btn small" disabled={has({ type: "key", kind: keyKind, key: keyName })} onClick={() => onPick({ type: "key", kind: keyKind, key: keyName })}>
            Add
          </button>
        </div>
      </div>
      <div className="menu-group">
        <h4>Mouse</h4>
        <div className="menu-row">
          <select value={mouse} onChange={(e) => setMouse(e.target.value)} aria-label="Mouse event">
            {["left", "right", "middle"].flatMap((b) =>
              ["pressed", "released"].flatMap((edge) =>
                [false, true].map((g) => (
                  <option key={`${b}${edge}${g}`} value={`${b} ${edge} ${g}`}>
                    {g ? "Anywhere: " : "On it: "}
                    {b} {edge}
                  </option>
                )),
              ),
            )}
          </select>
          <button
            className="btn small"
            onClick={() => {
              const [button, edge, g] = mouse.split(" ");
              onPick({ type: "mouse", button: button as "left", edge: edge as "pressed", global: g === "true" });
            }}
          >
            Add
          </button>
        </div>
      </div>
      <div className="menu-group">
        <h4>Alarm</h4>
        <div className="menu-row">
          <select value={alarm} onChange={(e) => setAlarm(Number(e.target.value))} aria-label="Alarm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                Alarm {i}
              </option>
            ))}
          </select>
          <button className="btn small" disabled={has({ type: "alarm", n: alarm })} onClick={() => onPick({ type: "alarm", n: alarm })}>
            Add
          </button>
        </div>
      </div>
      <div className="menu-group">
        <h4>More</h4>
        {simple("Begin Step", "begin_step", "Every frame, before Step")}
        {simple("End Step", "end_step", "Every frame, after movement and collisions")}
        {simple("Clean Up", "cleanup", "When it is removed, by destroy() or leaving the room")}
        {simple("Room Start", "room_start", "When a room begins")}
        {simple("Room End", "room_end", "When a room ends")}
        {simple("Game Start", "game_start", "Once, when the game begins")}
        {simple("Animation End", "animation_end", "When the sprite's animation reaches its last frame")}
        {simple("Outside Room", "outside_room", "When it leaves the room completely")}
        {simple("Intersect Boundary", "intersect_boundary", "When it starts to cross the room's edge")}
      </div>
    </div>
  );
}
