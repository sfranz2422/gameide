/**
 * One section of `animate:` notes, played into view (NotesPane): word by
 * word ("words") or letter by letter ("type") — notes.js's animateIn, for
 * GameIDE's Notes tab. A code block, a question, the cards, the tests and
 * what the teacher wrapped in :::pop come in whole, the :::pop with a little
 * pop. Hidden with visibility, not display, so nothing jumps as it lands.
 * Someone whose computer asks for reduced motion gets it all at once.
 *
 * Resolves when it's all in — or at once, everything shown, when the
 * `finish` it hands to `onFinish` is called (the teacher's Skip).
 *
 * Called before the browser paints the new section (useLayoutEffect), so
 * it's never seen whole and then hidden.
 */
import type { Speed } from "./quiz";

export type Finish = () => void;

/** ms a word, a letter and a block take to come in, at each speed (notes.js's SPEEDS). */
export const SPEEDS: Record<Speed, { word: number; letter: number; block: number; pause: number }> = {
  slow: { word: 450, letter: 80, block: 700, pause: 1500 },
  normal: { word: 250, letter: 45, block: 450, pause: 1000 },
  fast: { word: 120, letter: 22, block: 260, pause: 600 },
};
const TEXT_BLOCKS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "BLOCKQUOTE", "DL"]);

export function animateIn(part: HTMLElement, how: "words" | "type", onFinish: (f: Finish) => void, speed: Speed = "normal"): Promise<void> {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  const { word: WORD_MS, letter: CHAR_MS, block: BLOCK_MS, pause: PAUSE_MS } = SPEEDS[speed] ?? SPEEDS.normal;
  const steps: [HTMLElement, number, string][] = [];
  const hide = (n: HTMLElement) => n.classList.add("reveal-hidden");
  const splitText = (node: Element) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.nodeValue ?? "";
        const bits = how === "type" ? text.split("") : text.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const bit of bits) {
          if (!bit) continue;
          if (how !== "type" && /^\s+$/.test(bit)) {
            frag.appendChild(document.createTextNode(bit));
            continue;
          }
          const span = document.createElement("span");
          span.className = "reveal-bit";
          span.textContent = bit;
          hide(span);
          frag.appendChild(span);
          steps.push([span, how === "type" ? (/\s/.test(bit) ? 0 : CHAR_MS) : WORD_MS, ""]);
        }
        child.parentNode!.replaceChild(frag, child);
      } else if (child instanceof HTMLElement || child instanceof SVGElement) {
        if (child.classList.contains("reveal-pause")) {
          // A `^`: a wait before what comes after it.
          steps.push([child as HTMLElement, PAUSE_MS * (Number((child as HTMLElement).dataset.beats) || 1), ""]);
        } else if (/^(IMG|INPUT|IFRAME|SVG)$/i.test(child.tagName)) {
          hide(child as HTMLElement);
          steps.push([child as HTMLElement, BLOCK_MS, ""]);
        } else splitText(child);
      }
    }
  };
  // The section's blocks, inside the markdown's own wrappers.
  const blocks = (node: Element): HTMLElement[] =>
    Array.from(node.children).flatMap((c) => (c.classList.contains("notes-md") ? blocks(c) : [c as HTMLElement]));
  for (const block of blocks(part)) {
    if (TEXT_BLOCKS.has(block.tagName)) splitText(block);
    else {
      hide(block);
      steps.push([block, BLOCK_MS, block.classList.contains("pop-box") ? "reveal-pop" : ""]);
    }
  }
  return new Promise((resolve) => {
    let i = 0, over = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    onFinish(() => {
      if (over) return;
      over = true;
      if (timer) clearTimeout(timer);
      part.querySelectorAll(".reveal-hidden").forEach((n) => n.classList.remove("reveal-hidden"));
      resolve();
    });
    const nextStep = () => {
      if (over) return;
      if (i >= steps.length) {
        over = true;
        return resolve();
      }
      const [node, wait, add] = steps[i++]!;
      timer = setTimeout(() => {
        node.classList.remove("reveal-hidden");
        if (add) node.classList.add(add);
        // Keep what's appearing in view, a word now and then.
        if (i % 8 === 0 || wait === BLOCK_MS) node.scrollIntoView?.({ block: "nearest" });
        nextStep();
      }, wait);
    };
    nextStep();
  });
}
