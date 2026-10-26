/**
 * One small box for a Python value (or line) in an event sheet: a one-line
 * CodeMirror with the editor's highlighting and autocomplete, and a red
 * outline while what's typed isn't valid Python (sheet.ts checks it as you
 * type — no Pyodide needed on the page).
 *
 * A box for an object, sprite, room, key… parameter also offers the
 * project's names while the cursor is inside its quotes.
 */
import { autocompletion, closeBrackets, completionKeymap, type CompletionContext } from "@codemirror/autocomplete";
import { history, historyKeymap } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import type { ParamType } from "../catalog/api";
import { completionSource, valuesFor, type ProjectNames } from "../editor/code/pythonHelp";

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: "var(--syn-keyword)" },
  { tag: [t.string, t.special(t.string)], color: "var(--syn-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--syn-number)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--syn-function)" },
  { tag: t.self, color: "var(--syn-self)" },
  { tag: t.propertyName, color: "var(--syn-property)" },
]);

export interface ExprBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** Why the value is wrong, or null; shown as a red outline and its tooltip. */
  problem: string | null;
  label: string;
  names: () => ProjectNames;
  /** The parameter's type, for name suggestions inside quotes. */
  type?: ParamType;
  testId?: string;
}

export function ExprBox({ value, onChange, problem, label, names, type, testId }: ExprBoxProps) {
  const host = useRef<HTMLSpanElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ onChange, names, type });
  latest.current = { onChange, names, type };

  useEffect(() => {
    const general = completionSource(() => latest.current.names());
    const source = (ctx: CompletionContext) => {
      const before = ctx.state.sliceDoc(0, ctx.pos);
      const ty = latest.current.type;
      // Inside the quotes of a name parameter: the project's names.
      if (ty && (before.match(/"/g) ?? []).length % 2 === 1) {
        const word = ctx.matchBefore(/[\w ]*/);
        const values = valuesFor(ty, latest.current.names());
        return values.length ? { from: word ? word.from : ctx.pos, options: values.map((v) => ({ label: v, type: "constant" })), validFor: /^[\w ]*$/ } : null;
      }
      return general(ctx);
    };
    view.current = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          python(),
          syntaxHighlighting(highlight),
          closeBrackets(),
          // Its own typing undo, as the code editor has; Ctrl+Z outside the
          // boxes undoes the sheet (SheetEditor).
          history(),
          autocompletion({ override: [source], icons: false }),
          // One line: Enter accepts a suggestion (completionKeymap) or leaves the box.
          keymap.of([...completionKeymap, ...historyKeymap, { key: "Enter", run: (v) => (v.contentDOM.blur(), true) }]),
          EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr)),
          EditorView.contentAttributes.of({ "aria-label": label, ...(testId ? { "data-testid": testId } : {}) }),
          EditorView.updateListener.of((u) => u.docChanged && latest.current.onChange(u.state.doc.toString())),
        ],
      }),
    });
    return () => view.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A change from outside (undo, a rename) while the box isn't being typed in.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value && !v.hasFocus) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <span ref={host} className={`expr-box${problem ? " bad" : ""}`} title={problem ?? undefined} />;
}
