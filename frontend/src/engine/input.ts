import { G, KEY_COUNT, KEY_NAMES, PAD_AXES, PAD_BUTTONS, PAD_COUNT, type KeyName } from "./layout";

/** One gamepad as the page last saw it: which buttons are down, where the sticks are. */
export interface PadState {
  connected: boolean;
  buttons: boolean[]; // PAD_BUTTONS order
  axes: number[]; // PAD_AXES order, dead zone already applied
}

/** Below this a stick counts as centred: worn sticks never quite rest at 0. */
export const DEAD_ZONE = 0.2;

/**
 * Reads the browser's gamepads into PadStates. Only "standard" mapping pads
 * have buttons where PAD_BUTTONS says; others are read the same way, which
 * is right for almost every pad sold for PCs.
 */
export function readPads(list: readonly (Gamepad | null)[]): PadState[] {
  const out: PadState[] = [];
  for (let p = 0; p < PAD_COUNT; p++) {
    const g = list[p];
    if (!g || !g.connected) {
      out.push({ connected: false, buttons: PAD_BUTTONS.map(() => false), axes: PAD_AXES.map(() => 0) });
      continue;
    }
    out.push({
      connected: true,
      buttons: PAD_BUTTONS.map((_, i) => !!g.buttons[i] && (g.buttons[i]!.pressed || g.buttons[i]!.value > 0.5)),
      axes: PAD_AXES.map((_, i) => {
        const v = g.axes[i] ?? 0;
        return Math.abs(v) < DEAD_ZONE ? 0 : Math.max(-1, Math.min(1, v));
      }),
    });
  }
  return out;
}

/** KeyboardEvent.code → our key name. Physical keys, so WASD works on AZERTY. */
const CODE_TO_KEY: Record<string, KeyName> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  Space: "space",
  Enter: "enter",
  NumpadEnter: "enter",
  ShiftLeft: "shift",
  ShiftRight: "shift",
  ControlLeft: "control",
  ControlRight: "control",
  AltLeft: "alt",
  AltRight: "alt",
  Escape: "escape",
  Tab: "tab",
  Backspace: "backspace",
};
for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") CODE_TO_KEY[`Key${c}`] = c.toLowerCase() as KeyName;
for (const d of "0123456789") {
  CODE_TO_KEY[`Digit${d}`] = d as KeyName;
  CODE_TO_KEY[`Numpad${d}`] = d as KeyName;
}
for (let i = 1; i <= 12; i++) CODE_TO_KEY[`F${i}`] = `f${i}` as KeyName;

export const KEY_CODE = new Map<string, number>(KEY_NAMES.map((k, i) => [k, i]));

/**
 * Where attachInput sends what the page sees. InputState is one; in the IDE
 * the sink posts to the game's worker, which feeds the InputState there.
 */
export interface InputSink {
  keyDown(code: number): void;
  keyUp(code: number): void;
  mouseDown(button: number): void;
  mouseUp(button: number): void;
  mouseMove(x: number, y: number): void;
  releaseAll(): void;
  /** The gamepads, sent whenever they change. */
  pads(state: PadState[]): void;
}

/**
 * Collects input between steps and hands each step a consistent picture.
 *
 * "Pressed" and "released" are latched until the next step reads them: a
 * key tapped and let go between two steps (easy at 30 fps on a slow
 * Chromebook) still shows up as pressed for one step, rather than being
 * missed entirely. "Held" is what is down at the moment the step starts.
 */
export class InputState implements InputSink {
  private held = new Uint8Array(KEY_COUNT);
  private pressed = new Uint8Array(KEY_COUNT);
  private released = new Uint8Array(KEY_COUNT);
  private mouseHeld = [0, 0, 0];
  private mousePressed = [0, 0, 0];
  private mouseReleased = [0, 0, 0];
  mouseX = 0;
  mouseY = 0;
  /** Presses and releases this step, for the engine's instance mouse events. */
  readonly mouseEdges: { button: number; released: boolean }[] = [];
  private pendingEdges: { button: number; released: boolean }[] = [];
  // Gamepads: what the page last said, and what the last step saw (for
  // pressed/released). A tap between two steps is latched like a key's.
  private padHeld = new Uint8Array(PAD_COUNT * PAD_BUTTONS.length);
  private padPressed = new Uint8Array(PAD_COUNT * PAD_BUTTONS.length);
  private padReleased = new Uint8Array(PAD_COUNT * PAD_BUTTONS.length);
  private padAxes = new Float64Array(PAD_COUNT * PAD_AXES.length);
  private padConnected = new Uint8Array(PAD_COUNT);

  pads(state: PadState[]) {
    state.slice(0, PAD_COUNT).forEach((p, pad) => {
      this.padConnected[pad] = p.connected ? 1 : 0;
      p.axes.forEach((v, i) => (this.padAxes[pad * PAD_AXES.length + i] = v));
      p.buttons.forEach((down, i) => {
        const at = pad * PAD_BUTTONS.length + i;
        if (down && !this.padHeld[at]) this.padPressed[at] = 1;
        if (!down && this.padHeld[at]) this.padReleased[at] = 1;
        this.padHeld[at] = down ? 1 : 0;
      });
    });
  }

  mouseMove(x: number, y: number) {
    this.mouseX = x;
    this.mouseY = y;
  }

  keyDown(code: number) {
    if (!this.held[code]) this.pressed[code] = 1;
    this.held[code] = 1;
  }

  keyUp(code: number) {
    if (this.held[code]) this.released[code] = 1;
    this.held[code] = 0;
  }

  /** Lets go of everything — the window lost focus and the keyups will never come. */
  releaseAll() {
    for (let i = 0; i < KEY_COUNT; i++) if (this.held[i]) this.keyUp(i);
    for (let b = 0; b < 3; b++) if (this.mouseHeld[b]) this.mouseUp(b);
    // Not the gamepads: they keep working without focus (the page polls them).
  }

  mouseDown(button: number) {
    if (button > 2) return;
    if (!this.mouseHeld[button]) {
      this.mousePressed[button] = 1;
      this.pendingEdges.push({ button, released: false });
    }
    this.mouseHeld[button] = 1;
  }

  mouseUp(button: number) {
    if (button > 2) return;
    if (this.mouseHeld[button]) {
      this.mouseReleased[button] = 1;
      this.pendingEdges.push({ button, released: true });
    }
    this.mouseHeld[button] = 0;
  }

  /** Writes this step's input into the shared arrays and starts the next. */
  commit(keys: Uint8Array, g: Float64Array) {
    let any = 0, anyPressed = 0, anyReleased = 0;
    for (let i = 1; i < KEY_COUNT; i++) {
      keys[i] = this.held[i]!;
      keys[KEY_COUNT + i] = this.pressed[i]!;
      keys[2 * KEY_COUNT + i] = this.released[i]!;
      any |= this.held[i]!;
      anyPressed |= this.pressed[i]!;
      anyReleased |= this.released[i]!;
    }
    keys[0] = any;
    keys[KEY_COUNT] = anyPressed;
    keys[2 * KEY_COUNT] = anyReleased;
    this.pressed.fill(0);
    this.released.fill(0);

    g[G.MOUSE_X] = this.mouseX;
    g[G.MOUSE_Y] = this.mouseY;
    for (let b = 0; b < 3; b++) {
      g[G.MOUSE_DOWN + b] = this.mouseHeld[b]!;
      g[G.MOUSE_PRESSED + b] = this.mousePressed[b]!;
      g[G.MOUSE_RELEASED + b] = this.mouseReleased[b]!;
      this.mousePressed[b] = 0;
      this.mouseReleased[b] = 0;
    }
    this.mouseEdges.length = 0;
    this.mouseEdges.push(...this.pendingEdges);
    this.pendingEdges.length = 0;

    for (let i = 0; i < this.padHeld.length; i++) {
      g[G.PAD_DOWN + i] = this.padHeld[i]!;
      g[G.PAD_PRESSED + i] = this.padPressed[i]!;
      g[G.PAD_RELEASED + i] = this.padReleased[i]!;
    }
    this.padPressed.fill(0);
    this.padReleased.fill(0);
    for (let i = 0; i < this.padAxes.length; i++) g[G.PAD_AXIS + i] = this.padAxes[i]!;
    for (let p = 0; p < PAD_COUNT; p++) g[G.PAD_CONNECTED + p] = this.padConnected[p]!;
  }
}

/**
 * Wires an InputState to the page. Keys are listened for on the window, but
 * only acted on while `active()` says the game has focus — otherwise typing
 * in the code editor would move the player. Arrow keys and space are kept
 * from scrolling the page while the game is playing.
 *
 * `toRoom` turns a pointer event into room coordinates (the canvas may be
 * scaled to fit its pane).
 */
export function attachInput(
  input: InputSink,
  canvas: HTMLElement,
  active: () => boolean,
  toRoom: (e: PointerEvent) => { x: number; y: number },
): () => void {
  const SCROLLERS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Tab"]);
  const down = (e: KeyboardEvent) => {
    if (!active()) return;
    const k = CODE_TO_KEY[e.code];
    if (k === undefined) return;
    if (SCROLLERS.has(e.code)) e.preventDefault();
    input.keyDown(KEY_CODE.get(k)!);
  };
  const up = (e: KeyboardEvent) => {
    const k = CODE_TO_KEY[e.code];
    // Released keys are always honoured, even without focus, or a key held
    // while clicking away would stay "held" forever.
    if (k !== undefined) input.keyUp(KEY_CODE.get(k)!);
  };
  const move = (e: PointerEvent) => {
    const p = toRoom(e);
    input.mouseMove(p.x, p.y);
  };
  const press = (e: PointerEvent) => {
    move(e);
    input.mouseDown(e.button === 2 ? 1 : e.button === 1 ? 2 : 0);
  };
  const release = (e: PointerEvent) => {
    move(e);
    input.mouseUp(e.button === 2 ? 1 : e.button === 1 ? 2 : 0);
  };
  const blur = () => input.releaseAll();
  const menu = (e: Event) => e.preventDefault(); // right-click is a game button

  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", press);
  window.addEventListener("pointerup", release);
  canvas.addEventListener("contextmenu", menu);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerdown", press);
    window.removeEventListener("pointerup", release);
    canvas.removeEventListener("contextmenu", menu);
  };
}
