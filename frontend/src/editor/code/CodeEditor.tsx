/**
 * A CodeMirror 6 editor for one piece of Python at a time.
 *
 * `docKey` names what is being edited (an event's id, a script's id).
 * Switching key swaps in that document's own EditorState, kept in a cache,
 * so each event keeps its own undo history and cursor — pressing Ctrl+Z in
 * Step never undoes typing done in Create.
 */
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python, pythonLanguage } from "@codemirror/lang-python";
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import { apiHover, completionSource, type ProjectNames } from "./pythonHelp";

const usedJumps = new Set<number>();

/** The editor with focus, so the docs pane can insert at its cursor. */
export const activeEditor: { view: EditorView | null } = { view: null };

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: "var(--syn-keyword)" },
  { tag: [t.definitionKeyword, t.controlKeyword, t.operatorKeyword], color: "var(--syn-keyword)" },
  { tag: [t.string, t.special(t.string)], color: "var(--syn-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--syn-number)" },
  { tag: t.comment, color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--syn-function)" },
  { tag: t.self, color: "var(--syn-self)" },
  { tag: t.propertyName, color: "var(--syn-property)" },
  { tag: [t.className, t.definition(t.variableName)], color: "var(--syn-class)" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "14px", backgroundColor: "var(--code-bg)", color: "var(--code-text)" },
  ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.55" },
  ".cm-content": { caretColor: "var(--accent)" },
  // (CodeMirror's own cursor, which is what shows, is coloured in app.css for every CodeMirror box.)
  ".cm-gutters": { backgroundColor: "var(--code-gutter)", color: "var(--muted)", border: "none" },
  ".cm-activeLine": { backgroundColor: "var(--code-active)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--code-active)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "var(--code-selection) !important" },
  ".cm-error-line": { backgroundColor: "var(--code-error-line)" },
  ".cm-tooltip": { backgroundColor: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "var(--accent)", color: "#fff" },
});

// A red band on the line an error points at, until the student edits.
const setErrorLine = StateEffect.define<number | null>();
const errorLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        if (e.value == null || e.value < 1 || e.value > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(e.value);
        return Decoration.set([Decoration.line({ class: "cm-error-line" }).range(line.from)]);
      }
    }
    return tr.docChanged ? Decoration.none : deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export interface CodeEditorProps {
  docKey: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  names?: () => ProjectNames;
  /** Highlight and scroll to this line (1-based); changing it re-highlights. */
  errorLine?: { line: number; nonce: number } | null;
  testId?: string;
}

export function CodeEditor({ docKey, value, onChange, readOnly, names, errorLine: err, testId }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const states = useRef(new Map<string, EditorState>());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const namesRef = useRef(names);
  namesRef.current = names;
  const keyRef = useRef(docKey);
  const valueRef = useRef(value);
  valueRef.current = value;

  const extensions = (): Extension[] => [
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    drawSelection(),
    indentOnInput(),
    indentUnit.of("    "),
    EditorState.tabSize.of(4),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    python(),
    pythonLanguage.data.of({ autocomplete: completionSource(() => namesRef.current?.() ?? { objects: [], sprites: [], rooms: [] }) }),
    autocompletion({ icons: false }),
    apiHover,
    syntaxHighlighting(highlight),
    theme,
    errorLine,
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
    EditorState.readOnly.of(!!readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.updateListener.of((u) => {
      if (u.docChanged && !readOnly) {
        // Not when the change is the new value arriving from outside: that
        // would report back the text we were just given, and save for nothing.
        const text = u.state.doc.toString();
        if (text !== valueRef.current) onChangeRef.current?.(text);
      }
      if (u.focusChanged && u.view.hasFocus) activeEditor.view = u.view;
    }),
  ];

  const stateFor = (key: string, text: string) => {
    const cached = states.current.get(key);
    if (cached && cached.doc.toString() === text) return cached;
    return EditorState.create({ doc: text, extensions: extensions() });
  };

  useEffect(() => {
    const v = new EditorView({ state: stateFor(docKey, value), parent: host.current! });
    view.current = v;
    return () => {
      if (activeEditor.view === v) activeEditor.view = null;
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Another document, or the same one changed from outside (a rename that
  // updated quoted names, the generated-class view refreshing).
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    if (keyRef.current !== docKey) {
      states.current.set(keyRef.current, v.state);
      keyRef.current = docKey;
      v.setState(stateFor(docKey, value));
      return;
    }
    if (v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, value]);

  // Keyed on the nonce, not the object: the parent makes a new object on
  // every render, and re-running this on each keystroke would throw the
  // cursor back to the error line while the student types the fix. A jump
  // is also used once only, so reopening the tab later doesn't jump again.
  useEffect(() => {
    const v = view.current;
    if (!v || !err || usedJumps.has(err.nonce)) return;
    usedJumps.add(err.nonce);
    const n = Math.min(Math.max(1, err.line), v.state.doc.lines);
    const line = v.state.doc.line(n);
    v.dispatch({ effects: [setErrorLine.of(n), EditorView.scrollIntoView(line.from, { y: "center" })], selection: { anchor: line.from } });
    v.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [err?.nonce]);

  return <div className="code-editor" ref={host} data-tutorial="code-editor" data-testid={testId} />;
}
