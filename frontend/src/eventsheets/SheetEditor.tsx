/**
 * The Event Sheet tab: rows of conditions → actions, with the Python they
 * make beside them, read-only.
 *
 * Every change saves the sheet and its Python into the event (`onChange`).
 * The sheet keeps its own undo, as a code editor does: Ctrl+Z inside a box
 * undoes typing in that box, anywhere else on the sheet it undoes the last
 * change to the sheet. The project's undo leaves sheets alone (history.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { type ApiFunction } from "../catalog/api";
import { CodeEditor } from "../editor/code/CodeEditor";
import type { ProjectNames } from "../editor/code/pythonHelp";
import { Icon } from "../editor/ui/icons";
import { newId } from "../store/project";
import { ExprBox } from "./ExprBox";
import {
  ACTION_FUNCTIONS,
  PICKER_ORDER,
  checkExpr,
  checkLine,
  CONDITION_FUNCTIONS,
  canDrop,
  defaultArg,
  findRow,
  fitCalls,
  moveRow,
  sheetProblems,
  sheetToPython,
  type Action,
  type CompareOp,
  type DropWhere,
  type RowPlace,
  type Condition,
  type Row,
  type SetOp,
  type Sheet,
} from "./sheet";

export interface SheetNames extends ProjectNames {
  /** Functions the project's scripts define: actions (and conditions) too. */
  functions: { name: string; params: string[] }[];
}

export interface SheetEditorProps {
  /** The event's (or instance's) id: the Python pane keeps its own state by it. */
  id: string;
  sheet: Sheet;
  code: string;
  onChange: (sheet: Sheet, code: string) => void;
  names: () => SheetNames;
  onConvert: () => void;
  errorLine: { line: number; nonce: number } | null;
  /** In a collision event `other` is the one bumped into: "destroy" starts with it. */
  collision?: boolean;
}

const UNDO_GROUP_MS = 1000;
const MAX_UNDO = 200;

type Where = RowPlace;
const locate = findRow;

/** The drag type of a row being moved: nothing else (a picture, text) is taken for one. */
const ROW_DRAG = "application/x-gameide-sheet-row";

const newRow = (kind: "event" | "else"): Row => ({ id: newId(), kind, conditions: [], actions: [], children: [] });

export default function SheetEditor(props: SheetEditorProps) {
  const latest = useRef(props);
  latest.current = props;
  const past = useRef<{ sheet: Sheet; group: string | null; at: number }[]>([]);
  const future = useRef<Sheet[]>([]);
  const [, redraw] = useState(0);

  /**
   * Every change: a copy of the sheet changed by `recipe`, saved with its
   * Python. `group` makes typing in one box one undo step, not one per key.
   */
  const edit = (recipe: (s: Sheet) => void, group: string | null = null) => {
    const before = latest.current.sheet;
    const next = structuredClone(before);
    recipe(next);
    const last = past.current[past.current.length - 1];
    const now = Date.now();
    if (!(group && last && last.group === group && now - last.at < UNDO_GROUP_MS)) {
      past.current.push({ sheet: before, group, at: now });
      if (past.current.length > MAX_UNDO) past.current.shift();
    } else last.at = now;
    future.current = [];
    latest.current.onChange(next, sheetToPython(next).code);
  };
  const undo = () => {
    const step = past.current.pop();
    if (!step) return;
    future.current.push(latest.current.sheet);
    latest.current.onChange(step.sheet, sheetToPython(step.sheet).code);
    redraw((n) => n + 1);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ sheet: latest.current.sheet, group: null, at: 0 });
    latest.current.onChange(next, sheetToPython(next).code);
    redraw((n) => n + 1);
  };

  const python = useMemo(() => sheetToPython(props.sheet), [props.sheet]);
  const problems = useMemo(() => sheetProblems(props.sheet), [props.sheet]);

  // Calls follow their script functions' parameters as they are now, and
  // Python saved by an older version of the compiler is brought up to date.
  useEffect(() => {
    const sheet = structuredClone(latest.current.sheet);
    const refitted = fitCalls(sheet, latest.current.names().functions);
    const code = sheetToPython(sheet).code;
    if (refitted || code !== latest.current.code) latest.current.onChange(refitted ? sheet : latest.current.sheet, code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An error: mark the row (and the condition or action) that made its line.
  const errorId = props.errorLine ? (python.lines[props.errorLine.line - 1] ?? null) : null;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!errorId) return;
    root.current?.querySelector(`[data-item-id="${CSS.escape(errorId)}"]`)?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.errorLine?.nonce]);

  // Drag and drop: the row being dragged, and where it would land.
  const dragging = useRef<string | null>(null);
  const [drop, setDrop] = useState<{ target: string | null; where: DropWhere } | null>(null);
  const dropAt = (target: string | null, where: DropWhere) => {
    const id = dragging.current;
    const ok = !!id && canDrop(latest.current.sheet, id, target, where);
    setDrop((d) => (ok ? (d?.target === target && d.where === where ? d : { target, where }) : null));
    return ok;
  };
  const finishDrop = () => {
    const id = dragging.current;
    const d = drop;
    dragging.current = null;
    setDrop(null);
    if (id && d) edit((s) => void moveRow(s, id, d.target, d.where));
  };

  const ops: Ops = {
    names: () => latest.current.names(),
    problems,
    errorId: props.errorLine ? errorId : null,
    collision: !!props.collision,
    edit,
    drop,
    startDrag: (id) => (dragging.current = id),
    endDrag: () => ((dragging.current = null), setDrop(null)),
    dropAt,
    finishDrop,
  };

  return (
    <div className="blocks-split">
      <div
        className="sheet-editor"
        ref={root}
        data-testid="sheet"
        data-tutorial="event-sheet"
        onKeyDown={(e) => {
          // Inside a box, its own undo (ExprBox); anywhere else, the sheet's.
          const t = e.target as HTMLElement;
          if (!(e.ctrlKey || e.metaKey) || t.closest(".cm-editor") || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
          const k = e.key.toLowerCase();
          if (k !== "z" && k !== "y") return;
          e.preventDefault();
          if (k === "y" || e.shiftKey) redo();
          else undo();
        }}
        tabIndex={-1}
      >
        <div className="sheet-toolbar">
          <button className="btn small" onClick={() => edit((s) => void s.rows.push(newRow("event")))} data-testid="sheet-add-row" title="A row of conditions and the actions they run">
            {Icon.plus()} Row
          </button>
          <button
            className="btn small"
            onClick={() => edit((s) => void s.rows.push({ id: newId(), kind: "foreach", object: ops.names().objects[0] ?? "", as: "e", children: [] }))}
            data-testid="sheet-add-foreach"
            title="Rows under it run once for each instance of an object"
          >
            {Icon.plus()} For each
          </button>
          <button className="btn small" onClick={() => edit((s) => void s.rows.push({ id: newId(), kind: "comment", text: "" }))} data-testid="sheet-add-comment">
            {Icon.plus()} Comment
          </button>
          <span className="spacer" />
          <button className="icon-btn" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)" data-testid="sheet-undo">
            ↶
          </button>
          <button className="icon-btn" onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Y)" data-testid="sheet-redo">
            ↷
          </button>
        </div>
        <div
          className={`sheet-rows${drop?.target === null ? " drop-end" : ""}`}
          // Below the last row: the end of the sheet. In a gap between
          // rows (also the container), the marker stays where it was rather
          // than flicking to the end.
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(ROW_DRAG)) return;
            const top = e.currentTarget.querySelectorAll(":scope > .sheet-block, :scope > .sheet-row");
            const last = top[top.length - 1];
            if (last && e.clientY < last.getBoundingClientRect().bottom) {
              if (drop) e.preventDefault();
              return;
            }
            if (dropAt(null, "after")) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            finishDrop();
          }}
          data-testid="sheet-rows"
        >
          {props.sheet.rows.length ? (
            <Rows rows={props.sheet.rows} ops={ops} />
          ) : (
            <p className="muted sheet-empty">
              No rows yet. Press <b>+ Row</b>, then add conditions (when) and actions (what happens). A row with no conditions runs its actions every time.
            </p>
          )}
        </div>
      </div>
      <div className="blocks-python" data-tutorial="sheet-python">
        <div className="blocks-python-head">
          <span title="The Python your sheet makes. It changes as the sheet does.">Python</span>
          <button className="btn small" onClick={props.onConvert} data-testid="convert-to-python" title="Edit this as Python from now on">
            Convert to Python
          </button>
        </div>
        <CodeEditor docKey={`sheet:${props.id}`} value={props.code} readOnly testId="sheet-code" errorLine={props.errorLine} />
      </div>
    </div>
  );
}

interface Ops {
  names: () => SheetNames;
  problems: Map<string, string>;
  errorId: string | null;
  collision: boolean;
  edit: (recipe: (s: Sheet) => void, group?: string | null) => void;
  drop: { target: string | null; where: DropWhere } | null;
  startDrag: (id: string) => void;
  endDrag: () => void;
  /** Shows where a drop would land; false (and nothing shown) if it can't go there. */
  dropAt: (target: string | null, where: DropWhere) => boolean;
  finishDrop: () => void;
}

/**
 * A row as a drop target: its top part puts the dragged row before it, its
 * bottom part after it, and its middle makes it a sub-event (a comment has
 * no middle: nothing goes inside one).
 */
function dropTarget(row: Row, ops: Ops) {
  const where = (e: React.DragEvent<HTMLElement>): DropWhere => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientY - r.top) / r.height;
    if (row.kind === "comment") return f < 0.5 ? "before" : "after";
    return f < 0.25 ? "before" : f > 0.75 ? "after" : "inside";
  };
  const mark = ops.drop?.target === row.id ? ` drop-${ops.drop.where}` : "";
  return {
    mark,
    props: {
      onDragOver: (e: React.DragEvent<HTMLElement>) => {
        if (!e.dataTransfer.types.includes(ROW_DRAG)) return;
        e.stopPropagation();
        if (ops.dropAt(row.id, where(e))) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      },
      onDrop: (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        ops.finishDrop();
      },
    },
  };
}

/** What a row is dragged by. Not the whole row: that would fight with selecting text in its boxes. */
function Grip({ row, ops }: { row: Row; ops: Ops }) {
  return (
    <span
      className="sheet-grip"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ROW_DRAG, row.id);
        e.dataTransfer.effectAllowed = "move";
        const el = e.currentTarget.closest(".sheet-row");
        if (el) e.dataTransfer.setDragImage(el, 12, 12);
        ops.startDrag(row.id);
      }}
      onDragEnd={ops.endDrag}
      title="Drag to move this row, with its sub-events. Drop on the middle of a row to make it a sub-event."
      aria-label="Drag to move this row"
      data-testid="sheet-grip"
    >
      ⋮⋮
    </span>
  );
}

/** Changes the row with this id, wherever it is in the sheet. */
const onRow = (ops: Ops, id: string, recipe: (r: Row, where: Where) => void, group: string | null = null) =>
  ops.edit((s) => {
    const w = locate(s.rows, id);
    if (w) recipe(w.list[w.index]!, w);
  }, group);

function Rows({ rows, ops }: { rows: Row[]; ops: Ops }) {
  return (
    <>
      {rows.map((r) => (
        <RowView key={r.id} row={r} ops={ops} />
      ))}
    </>
  );
}

function RowView({ row, ops }: { row: Row; ops: Ops }) {
  const problem = ops.problems.get(row.id);
  const marked = ops.errorId === row.id || (row.kind !== "comment" && row.kind !== "foreach" && [...row.conditions, ...row.actions].some((x) => x.id === ops.errorId));
  const tools = <RowTools row={row} ops={ops} />;
  const target = dropTarget(row, ops);

  if (row.kind === "comment")
    return (
      <div className={`sheet-row comment${marked ? " error" : ""}${target.mark}`} data-item-id={row.id} data-testid="sheet-row" {...target.props}>
        <Grip row={row} ops={ops} />
        <span className="sheet-hash">#</span>
        <input
          className="sheet-comment"
          value={row.text}
          placeholder="A note for people reading this"
          onChange={(e) => onRow(ops, row.id, (r) => void (r.kind === "comment" && (r.text = e.target.value)), `comment:${row.id}`)}
          aria-label="Comment"
        />
        {tools}
      </div>
    );

  if (row.kind === "foreach")
    return (
      <div className={`sheet-block${marked ? " error" : ""}`} data-item-id={row.id}>
        <div className={`sheet-row foreach${target.mark}`} data-testid="sheet-row" {...target.props}>
          <Grip row={row} ops={ops} />
          <span className="sheet-kw">For each</span>
          <select
            value={row.object}
            onChange={(e) => onRow(ops, row.id, (r) => void (r.kind === "foreach" && (r.object = e.target.value)))}
            aria-label="Object"
            data-testid="foreach-object"
          >
            {[...new Set([row.object, ...ops.names().objects])].filter(Boolean).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            {!row.object && <option value="">(pick an object)</option>}
          </select>
          <span className="sheet-kw">as</span>
          <input
            className="sheet-as"
            value={row.as}
            onChange={(e) => onRow(ops, row.id, (r) => void (r.kind === "foreach" && (r.as = e.target.value.replace(/\s/g, "_"))), `as:${row.id}`)}
            aria-label="Name for each one"
            title="What the rows under this call each instance, as in: for e in instances(...)"
          />
          {problem && <span className="sheet-problem">{problem}</span>}
          {tools}
        </div>
        <Children row={row} ops={ops} />
      </div>
    );

  return (
    <div className={`sheet-block${marked && ops.errorId === row.id ? " error" : ""}`} data-item-id={row.id}>
      <div className={`sheet-row event${row.kind === "else" ? " else" : ""}${target.mark}`} data-testid="sheet-row" {...target.props}>
        <Grip row={row} ops={ops} />
        <div className="sheet-conds">
          {row.kind === "else" && <span className="sheet-kw">{row.conditions.length ? "Else if" : "Else"}</span>}
          {row.conditions.length > 1 && (
            <button
              className={`sheet-any${row.any ? " on" : ""}`}
              onClick={() => onRow(ops, row.id, (r) => void (r.kind !== "comment" && r.kind !== "foreach" && (r.any = !r.any)))}
              title={row.any ? "Any one of these is enough (or). Click for all of them." : "All of these must hold (and). Click for any one of them."}
              data-testid="sheet-any"
            >
              {row.any ? "any (or)" : "all (and)"}
            </button>
          )}
          {row.conditions.map((c) => (
            <ConditionChip key={c.id} row={row} cond={c} ops={ops} />
          ))}
          <AddButton what="condition" row={row} ops={ops} />
          {!row.conditions.length && row.kind === "event" && <span className="muted small">Always</span>}
          {problem && <span className="sheet-problem">{problem}</span>}
        </div>
        <div className="sheet-acts">
          {row.actions.map((a) => (
            <ActionChip key={a.id} row={row} act={a} ops={ops} />
          ))}
          <AddButton what="action" row={row} ops={ops} />
        </div>
        {tools}
      </div>
      <Children row={row} ops={ops} />
    </div>
  );
}

function Children({ row, ops }: { row: Row; ops: Ops }) {
  if (row.kind === "comment" || !row.children.length) return null;
  return (
    <div className="sheet-children">
      <Rows rows={row.children} ops={ops} />
    </div>
  );
}

/** Add a sub-event, an else, a for-each or a comment; move; delete. */
function RowTools({ row, ops }: { row: Row; ops: Ops }) {
  const [open, setOpen] = useState(false);
  const after = (make: () => Row) => onRow(ops, row.id, (_r, w) => void w.list.splice(w.index + 1, 0, make()));
  const inside = (make: () => Row) => onRow(ops, row.id, (r) => void (r.kind !== "comment" && r.children.push(make())));
  const item = (label: string, testid: string, run: () => void, disabled = false) => (
    <button
      className="menu-item"
      disabled={disabled}
      onClick={() => {
        setOpen(false);
        run();
      }}
      data-testid={testid}
    >
      {label}
    </button>
  );
  const canHold = row.kind !== "comment";
  return (
    <span className="sheet-tools">
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Row menu" aria-expanded={open} data-testid="sheet-row-menu">
        {Icon.more()}
      </button>
      {open && (
        <div className="sheet-menu" role="menu" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          {item("Add sub-event (runs only when this row does)", "sheet-sub", () => inside(() => newRow("event")), !canHold)}
          {item("Add Else after", "sheet-else", () => after(() => newRow("else")), row.kind !== "event" && row.kind !== "else")}
          {item("Add For each inside", "sheet-foreach-in", () => inside(() => ({ id: newId(), kind: "foreach", object: ops.names().objects[0] ?? "", as: "e", children: [] })), !canHold)}
          {item("Add row after", "sheet-row-after", () => after(() => newRow("event")))}
          {item("Add comment after", "sheet-comment-after", () => after(() => ({ id: newId(), kind: "comment", text: "" })))}
          {item("Move up", "sheet-up", () => onRow(ops, row.id, (_r, w) => void (w.index > 0 && w.list.splice(w.index - 1, 0, ...w.list.splice(w.index, 1)))))}
          {item("Move down", "sheet-down", () => onRow(ops, row.id, (_r, w) => void (w.index < w.list.length - 1 && w.list.splice(w.index + 1, 0, ...w.list.splice(w.index, 1)))))}
          {item("Delete row", "sheet-delete", () => onRow(ops, row.id, (_r, w) => void w.list.splice(w.index, 1)))}
        </div>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- conditions and actions

type EventRow = Extract<Row, { kind: "event" | "else" }>;

type Item = Condition | Action;

/** The condition or action with this id in a row (the sheet's working copy, inside a recipe). */
const itemIn = (r: Row, id: string): Item | undefined =>
  r.kind === "comment" || r.kind === "foreach" ? undefined : [...r.conditions, ...r.actions].find((x) => x.id === id);

/**
 * A box for one of an item's values. `fix` changes the item in the sheet's
 * working copy (never the one on screen); typing in one box is one undo step.
 */
function box(ops: Ops, row: Row, itemId: string, value: string, label: string, fix: (item: Item, v: string) => void, line = false) {
  return (
    <ExprBox
      value={value}
      label={label}
      names={ops.names}
      problem={line ? checkLine(value) : checkExpr(value)}
      onChange={(v) => {
        if (v !== value) onRow(ops, row.id, (r) => void (itemIn(r, itemId) && fix(itemIn(r, itemId)!, v)), `box:${itemId}:${label}`);
      }}
      testId={`box-${label}`}
    />
  );
}

function ConditionChip({ row, cond, ops }: { row: EventRow; cond: Condition; ops: Ops }) {
  const patch = (fix: (c: Condition) => void, group: string | null = null) =>
    onRow(ops, row.id, (r) => {
      const c = (r as EventRow).conditions.find((x) => x.id === cond.id);
      if (c) fix(c);
    }, group);
  const remove = () => onRow(ops, row.id, (r) => void ((r as EventRow).conditions = (r as EventRow).conditions.filter((x) => x.id !== cond.id)));
  const bad = ops.problems.get(cond.id);
  const notToggle = cond.type !== "once" && (
    <button className={`sheet-not${cond.not ? " on" : ""}`} onClick={() => patch((c) => void (c.type !== "once" && (c.not = !c.not)))} title="Turn this condition around" data-testid="sheet-not">
      not
    </button>
  );
  const inner = (() => {
    switch (cond.type) {
      case "once":
        return <span className="sheet-kw" title="True the first time the rest of this row is true, then not again until it has been false">Trigger once</span>;
      case "call":
        return <CallBoxes item={cond} ops={ops} onArg={(i, v) => patch((c) => void (c.type === "call" && (c.args[i] = v)), `arg:${cond.id}:${i}`)} />;
      case "compare":
        return (
          <>
            {box(ops, row, cond.id, cond.left, "left", (c, v) => void (c.type === "compare" && (c.left = v)))}
            <select value={cond.op} onChange={(e) => patch((c) => void (c.type === "compare" && (c.op = e.target.value as CompareOp)))} aria-label="Compare">
              {(["==", "!=", "<", "<=", ">", ">="] as const).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            {box(ops, row, cond.id, cond.right, "right", (c, v) => void (c.type === "compare" && (c.right = v)))}
          </>
        );
      case "expr":
        return (
          <>
            <span className="sheet-kw">Python</span>
            {box(ops, row, cond.id, cond.code, "condition", (c, v) => void (c.type === "expr" && (c.code = v)))}
          </>
        );
    }
  })();
  return (
    <span className={`sheet-chip cond${bad ? " bad" : ""}${ops.errorId === cond.id ? " error" : ""}`} data-item-id={cond.id} data-testid="sheet-condition">
      {notToggle}
      {inner}
      <button className="sheet-x" onClick={remove} aria-label="Remove condition">
        ×
      </button>
    </span>
  );
}

function ActionChip({ row, act, ops }: { row: EventRow; act: Action; ops: Ops }) {
  const patch = (fix: (a: Action) => void, group: string | null = null) =>
    onRow(ops, row.id, (r) => {
      const a = (r as EventRow).actions.find((x) => x.id === act.id);
      if (a) fix(a);
    }, group);
  const remove = () => onRow(ops, row.id, (r) => void ((r as EventRow).actions = (r as EventRow).actions.filter((x) => x.id !== act.id)));
  const bad = ops.problems.get(act.id);
  const inner = (() => {
    switch (act.type) {
      case "call":
        return <CallBoxes item={act} ops={ops} onArg={(i, v) => patch((a) => void (a.type === "call" && (a.args[i] = v)), `arg:${act.id}:${i}`)} />;
      case "set":
        return (
          <>
            {box(ops, row, act.id, act.target, "target", (a, v) => void (a.type === "set" && (a.target = v)))}
            <select value={act.op} onChange={(e) => patch((a) => void (a.type === "set" && (a.op = e.target.value as SetOp)))} aria-label="How" title="= sets it, += adds to it, -= takes away from it">
              <option value="=" title="set to">=</option>
              <option value="+=" title="add">+=</option>
              <option value="-=" title="take away">-=</option>
            </select>
            {box(ops, row, act.id, act.value, "value", (a, v) => void (a.type === "set" && (a.value = v)))}
          </>
        );
      case "destroy":
        return (
          <>
            <span className="sheet-kw">destroy</span>
            {box(ops, row, act.id, act.who, "who", (a, v) => void (a.type === "destroy" && (a.who = v)))}
          </>
        );
      case "code":
        return (
          <>
            <span className="sheet-kw">Python</span>
            {box(ops, row, act.id, act.code, "line", (a, v) => void (a.type === "code" && (a.code = v)), true)}
          </>
        );
    }
  })();
  return (
    <span className={`sheet-chip act${bad ? " bad" : ""}${ops.errorId === act.id ? " error" : ""}`} data-item-id={act.id} data-testid="sheet-action">
      {inner}
      <button className="sheet-x" onClick={remove} aria-label="Remove action">
        ×
      </button>
    </span>
  );
}

/** `fn` with a box per parameter, named as in the catalog (or the script's def). */
function CallBoxes({ item, ops, onArg }: { item: Extract<Condition | Action, { type: "call" }>; ops: Ops; onArg: (i: number, v: string) => void }) {
  const f = [...CONDITION_FUNCTIONS, ...ACTION_FUNCTIONS].find((x) => x.name === item.fn);
  const params = f ? f.params.map((p) => ({ name: p.name, type: p.type })) : (ops.names().functions.find((x) => x.name === item.fn)?.params ?? item.args.map((_, i) => `arg${i + 1}`)).map((name) => ({ name, type: undefined }));
  return (
    <>
      <span className="sheet-fn" title={f?.description}>
        {item.fn}
      </span>
      {params.map((p, i) => (
        <label key={i} className="sheet-arg">
          <span>{p.name}</span>
          <ExprBox
            value={item.args[i] ?? ""}
            label={p.name}
            names={ops.names}
            type={p.type}
            // An optional parameter may be left empty: it is left out of the call.
            problem={f?.params[i]?.default !== undefined && !(item.args[i] ?? "").trim() ? null : checkExpr(item.args[i] ?? "")}
            onChange={(v) => v !== (item.args[i] ?? "") && onArg(i, v)}
            testId={`box-${p.name}`}
          />
        </label>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- the pickers

function AddButton({ what, row, ops }: { what: "condition" | "action"; row: EventRow; ops: Ops }) {
  const [open, setOpen] = useState(false);
  const add = (item: Condition | Action) =>
    onRow(ops, row.id, (r) => {
      const e = r as EventRow;
      if (what === "condition") e.conditions.push(item as Condition);
      else e.actions.push(item as Action);
    });
  return (
    <span className="sheet-add">
      <button className="sheet-plus" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid={`add-${what}`} title={what === "condition" ? "Add a condition: when this row runs" : "Add an action: what this row does"}>
        + {what}
      </button>
      {open && (
        <Picker
          what={what}
          ops={ops}
          onClose={() => setOpen(false)}
          onPick={(item) => {
            setOpen(false);
            add(item);
          }}
        />
      )}
    </span>
  );
}


function Picker({ what, ops, onPick, onClose }: { what: "condition" | "action"; ops: Ops; onPick: (item: Condition | Action) => void; onClose: () => void }) {
  const [filter, setFilter] = useState("");
  const names = ops.names();
  // A name parameter starts as the project's first of that kind — a real one, so the action works as it is.
  const firsts: Record<string, string | undefined> = {
    object: names.objects[0],
    sprite: names.sprites[0],
    room: names.rooms[0],
    layer: names.layers?.[0],
    sound: names.sounds?.[0],
    font: names.fonts?.[0],
  };
  const first = (kind: string) => firsts[kind];
  const call = (f: ApiFunction) => ({ id: newId(), type: "call" as const, fn: f.name, args: f.params.map((p) => defaultArg(p, first)) });
  const fns = what === "condition" ? CONDITION_FUNCTIONS : ACTION_FUNCTIONS;
  const special: { label: string; hint: string; make: () => Condition | Action; testid: string }[] =
    what === "condition"
      ? [
          { label: "Compare two values", hint: "self.lives <= 0, global_vars.score >= 10…", make: () => ({ id: newId(), type: "compare", left: "self.x", op: "<", right: "0" }), testid: "pick-compare" },
          { label: "Python condition", hint: "Any condition, typed", make: () => ({ id: newId(), type: "expr", code: "True" }), testid: "pick-expr" },
          { label: "Trigger once", hint: "Only the first step the rest of the row is true", make: () => ({ id: newId(), type: "once" }), testid: "pick-once" },
        ]
      : [
          { label: "Set or change a value", hint: "self.x += 4, global_vars.score = 0…", make: () => ({ id: newId(), type: "set", target: "self.x", op: "+=", value: "4" }), testid: "pick-set" },
          { label: "Destroy an instance", hint: "self, other, or a for-each's name", make: () => ({ id: newId(), type: "destroy", who: ops.collision ? "other" : "self" }), testid: "pick-destroy" },
          { label: "Python line", hint: "Any one line, typed", make: () => ({ id: newId(), type: "code", code: "" }), testid: "pick-code" },
        ];
  const match = (s: string) => !filter || s.toLowerCase().includes(filter.toLowerCase());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    window.addEventListener("mousedown", away);
    return () => window.removeEventListener("mousedown", away);
  }, [onClose]);

  return (
    <div className="sheet-picker" ref={ref} role="dialog" aria-label={`Add ${what}`} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <input autoFocus placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search" />
      <div className="sheet-picker-list">
        {special.filter((s) => match(s.label)).map((s) => (
          <button key={s.testid} className="menu-item" onClick={() => onPick(s.make())} title={s.hint} data-testid={s.testid}>
            {s.label} <span className="muted small">{s.hint}</span>
          </button>
        ))}
        {PICKER_ORDER.map((cat) => {
          const list = fns.filter((f) => f.category === cat && match(f.name));
          if (!list.length) return null;
          return (
            <div key={cat}>
              <h4>{cat}</h4>
              {list.map((f) => (
                <button key={f.name} className="menu-item" onClick={() => onPick(call(f))} title={f.description} data-testid={`pick-${f.name}`}>
                  {f.name}
                </button>
              ))}
            </div>
          );
        })}
        {names.functions.some((f) => match(f.name)) && (
          <div>
            <h4>Your functions</h4>
            {names.functions
              .filter((f) => match(f.name))
              .map((f) => (
                <button key={f.name} className="menu-item" onClick={() => onPick({ id: newId(), type: "call", fn: f.name, args: f.params.map(() => "0") })} data-testid={`pick-${f.name}`}>
                  {f.name}({f.params.join(", ")})
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
