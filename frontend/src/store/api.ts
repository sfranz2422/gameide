/**
 * Talking to GameIDE's server.
 *
 * Every JSON body goes as {"_packed": base64(json)}. Render's firewall
 * refuses requests whose body looks like an attack, and a project is code:
 * in FlaskIDE a teacher's notes full of Flask routes were turned away before
 * reaching the app, with nothing in its logs and an editor that could only
 * say it couldn't reach the server. backend/app.py's PackedRequest unwraps
 * it. Everything goes through `api()` here, so no call can forget.
 */

/** The server answered, and said no — with a sentence for the student. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The server couldn't be reached at all: offline, or it is down. */
export class OfflineError extends Error {
  constructor() {
    super("Can't reach GameIDE's server.");
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  // String.fromCharCode over one huge array overflows the call stack.
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

export function packed(value: unknown): string {
  return JSON.stringify({ _packed: toBase64(JSON.stringify(value)) });
}

export interface ApiOptions {
  method?: string;
  json?: unknown;
  body?: Blob;
}

/**
 * A request to our own server. Resolves with the parsed JSON (or the raw
 * Response for non-JSON answers); throws ApiError with the server's sentence,
 * or OfflineError when nothing answered.
 */
export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.json !== undefined || opts.body ? "POST" : "GET"),
      credentials: "same-origin",
      headers: opts.json !== undefined ? { "Content-Type": "application/json" } : opts.body ? { "Content-Type": opts.body.type || "application/octet-stream" } : {},
      body: opts.json !== undefined ? packed(opts.json) : opts.body,
    });
  } catch {
    throw new OfflineError();
  }
  const type = res.headers.get("Content-Type") ?? "";
  if (!res.ok) {
    if (type.includes("application/json")) {
      const body = (await res.json()) as { error?: string };
      throw new ApiError(res.status, body.error ?? `The server said no (${res.status}).`);
    }
    // An HTML page where JSON was expected: a proxy, or the firewall.
    if (res.status === 403 || res.status >= 500)
      throw new ApiError(res.status, `The server refused that (${res.status}). If it keeps happening, tell your teacher.`);
    throw new ApiError(res.status, `The server said no (${res.status}).`);
  }
  if (type.includes("application/json")) return (await res.json()) as T;
  return res as unknown as T;
}

export interface Me {
  loginEnabled: boolean;
  devLogin: boolean;
  user: { id: number; name: string; email: string; teacher: boolean; admin?: boolean } | null;
  idleSeconds: number;
}

/**
 * Who is signed in. With no server at all (the editor served on its own, as
 * by `vite` without the backend), sign-in is simply off — the editor works
 * the same, keeping projects in the browser.
 */
export async function fetchMe(): Promise<Me> {
  try {
    const m = await api<{ login_enabled: boolean; dev_login: boolean; user: Me["user"]; idle_seconds: number }>("/api/me");
    // A static server with no API answers /api/me with its HTML page.
    if (!m || typeof m !== "object" || !("login_enabled" in m)) throw new Error("no API here");
    return { loginEnabled: m.login_enabled, devLogin: m.dev_login, user: m.user, idleSeconds: m.idle_seconds };
  } catch {
    return { loginEnabled: false, devLogin: false, user: null, idleSeconds: 0 };
  }
}

/** Where Sign in goes, coming back to this page (hash included) afterwards. */
export function signInUrl(me: Me): string {
  const here = location.pathname + location.search + location.hash;
  return `${me.devLogin ? "/dev/login" : "/login"}?next=${encodeURIComponent(here)}`;
}
