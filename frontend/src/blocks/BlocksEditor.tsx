/**
 * The Blocks tab: a Blockly workspace for one event, creation code or
 * script, with the Python it makes beside it, read-only, updated as blocks
 * move.
 *
 * Loaded only when a Blocks tab opens (ObjectEditor imports it lazily), so
 * a student who only types Python never downloads Blockly.
 *
 * Every change saves both the blocks and their Python into the event
 * (`onChange`). Blockly keeps its own undo inside the workspace, as a code
 * editor does; the project's undo leaves blocks alone (history.ts).
 */
import * as Blockly from "blockly/core";
import { useEffect, useRef, useState } from "react";
import { CodeEditor } from "../editor/code/CodeEditor";
import type { BlocksKind, BlocksState } from "./blockState";
import { COLOURS, refreshCalls, setBlockNames, type BlockNames } from "./catalogBlocks";
import { hatOf, workspaceToPython } from "./python";
import { functionsFlyout, toolbox, variablesFlyout } from "./toolbox";

export interface BlocksEditorProps {
  /** Names the workspace (an event's, instance's or script's id): its Python pane keeps its own state. */
  eventId: string;
  kind: BlocksKind;
  /** `def on_step(self):` — shown on the hat. Not used for a script, which has none. */
  signature: string;
  state: BlocksState;
  code: string;
  onChange: (state: BlocksState, code: string) => void;
  names: () => BlockNames;
  onConvert: () => void;
  /** An error to show: its line in the Python, and the block that made it selected. */
  errorLine: { line: number; nonce: number } | null;
}

/**
 * Blockly's look, in the editor's colours. Only what a theme must set is
 * here; backgrounds and text follow the page's light or dark theme through
 * CSS (app.css, `.blocks-editor`), so switching theme needs no reload.
 */
// Only the main colour: Blockly works out the shades. (It throws on a colour
// it can't read, such as one with alpha, and the workspace never appears.)
const style = (colour: string) => ({ colourPrimary: colour }) as Blockly.Theme.BlockStyle;
const THEME = Blockly.Theme.defineTheme("gameide", {
  name: "gameide",
  base: Blockly.Themes.Classic,
  // Blockly's own blocks (if, loops, maths, text) in the same colours as
  // their categories, as ours are.
  blockStyles: {
    logic_blocks: style(COLOURS.Logic),
    loop_blocks: style(COLOURS.Loops),
    math_blocks: style(COLOURS.Math),
    text_blocks: style(COLOURS.Text),
    variable_blocks: style(COLOURS.Variables),
    variable_dynamic_blocks: style(COLOURS.Variables),
    procedure_blocks: style(COLOURS.Functions),
  },
  fontStyle: { family: "system-ui, -apple-system, \"Segoe UI\", sans-serif", size: 11, weight: "600" },
  startHats: false,
});

export default function BlocksEditor(props: BlocksEditorProps) {
  const div = useRef<HTMLDivElement>(null);
  const ws = useRef<Blockly.WorkspaceSvg | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [lines, setLines] = useState<(string | null)[]>([]);
  /** The blocks as this workspace last saved them, to tell its own changes from someone else's. */
  const saved = useRef(JSON.stringify(props.state));
  setBlockNames(() => latest.current.names());

  useEffect(() => {
    const workspace = Blockly.inject(div.current!, {
      toolbox: toolbox(props.kind),
      renderer: "zelos", // Scratch's shapes
      theme: THEME,
      media: "/blockly-media/", // served by us, not Google's site (school filters)
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.75, maxScale: 2, minScale: 0.3 },
      move: { scrollbars: true, drag: true, wheel: false },
      grid: { spacing: 24, length: 2, colour: "#7d8aa3", snap: false }, // drawn faint by app.css
    });
    ws.current = workspace;
    workspace.registerToolboxCategoryCallback("GAMEIDE_VARIABLES", (w) => variablesFlyout(w, props.kind) as unknown as Blockly.utils.toolbox.FlyoutDefinition);
    workspace.registerToolboxCategoryCallback("GAMEIDE_FUNCTIONS", () => functionsFlyout() as unknown as Blockly.utils.toolbox.FlyoutDefinition);
    workspace.registerButtonCallback("CREATE_VARIABLE", (b) => Blockly.Variables.createVariableButtonHandler(b.getTargetWorkspace()));

    Blockly.serialization.workspaces.load(props.state as Record<string, unknown>, workspace);
    let hat = hatOf(workspace);
    if (!hat && props.kind !== "script") {
      // A saved event always has its hat; this is only for one that somehow lost it.
      hat = workspace.newBlock("gm_event") as Blockly.BlockSvg;
      (hat as Blockly.BlockSvg).initSvg();
      (hat as Blockly.BlockSvg).render();
      hat.moveBy(24, 24);
    }
    hat?.setFieldValue(props.signature, "SIG");

    const save = () => {
      const py = workspaceToPython(workspace, latest.current.kind);
      setLines(py.lines);
      const state = Blockly.serialization.workspaces.save(workspace) as BlocksState;
      // Only when something changed: saving on every click would mark the
      // project unsaved for nothing.
      const json = JSON.stringify(state);
      if (py.code !== latest.current.code || json !== saved.current) {
        saved.current = json;
        latest.current.onChange(state, py.code);
      }
    };
    // A block lying loose isn't code: greyed out, as in Scratch, and left
    // out of the Python (python.ts takes only what is under the hat).
    workspace.addChangeListener(Blockly.Events.disableOrphans);
    workspace.addChangeListener((e) => {
      if (e.isUiEvent || workspace.isDragging()) return;
      // Another function picked in a call block: its slots follow.
      if (e.type === Blockly.Events.BLOCK_CHANGE && (e as Blockly.Events.BlockChange).name === "FN") {
        const b = workspace.getBlockById((e as Blockly.Events.BlockChange).blockId ?? "");
        if (b) refreshCalls(workspace, [b]);
      }
      save();
    });
    // Calls follow their functions' parameters as they are now, and Python
    // saved by an older version of the blocks is brought up to date.
    refreshCalls(workspace);
    const py = workspaceToPython(workspace, latest.current.kind);
    const state = Blockly.serialization.workspaces.save(workspace) as BlocksState;
    setLines(py.lines);
    if (py.code !== props.code || JSON.stringify(state) !== saved.current) {
      saved.current = JSON.stringify(state);
      latest.current.onChange(state, py.code);
    }

    const resize = new ResizeObserver(() => Blockly.svgResize(workspace));
    resize.observe(div.current!);
    return () => {
      resize.disconnect();
      workspace.dispose();
      ws.current = null;
    };
    // One workspace per event: the parent remounts this for another event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The blocks changed from outside — renaming an object rewrites the names
  // in its pickers (project.replaceQuoted). Load them again, or the next
  // change here would save the old name straight back.
  useEffect(() => {
    const w = ws.current;
    const json = JSON.stringify(props.state);
    if (!w || json === saved.current) return;
    saved.current = json;
    Blockly.Events.disable();
    try {
      Blockly.serialization.workspaces.load(props.state as Record<string, unknown>, w);
      hatOf(w)?.setFieldValue(latest.current.signature, "SIG");
    } finally {
      Blockly.Events.enable();
    }
    setLines(workspaceToPython(w, latest.current.kind).lines);
  }, [props.state]);

  // An error: select the block that made that line, and bring it into view.
  useEffect(() => {
    const w = ws.current;
    const id = props.errorLine ? lines[props.errorLine.line - 1] : null;
    if (!w || !id) return;
    const block = w.getBlockById(id);
    if (!block) return;
    w.centerOnBlock(id);
    Blockly.getFocusManager().focusNode(block);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.errorLine?.nonce, lines.length]);

  return (
    <div className="blocks-split">
      <div className="blocks-editor" ref={div} data-testid="blocks-workspace" data-tutorial="blocks-workspace" />
      <div className="blocks-python" data-tutorial="blocks-python">
        <div className="blocks-python-head">
          <span title="The Python your blocks make. It changes as the blocks do.">Python</span>
          <button className="btn small" onClick={props.onConvert} data-testid="convert-to-python" title="Edit this event as Python from now on">
            Convert to Python
          </button>
        </div>
        <CodeEditor docKey={`blocks:${props.eventId}`} value={props.code} readOnly testId="blocks-code" errorLine={props.errorLine} />
      </div>
    </div>
  );
}
