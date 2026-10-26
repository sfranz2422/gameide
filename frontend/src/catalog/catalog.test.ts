/**
 * The catalog and the runtime must agree exactly: every catalog entry exists
 * in runtime.py with these parameter names and defaults, and every public
 * name in runtime.py is in the catalog. Autocomplete, blocks and event
 * sheets are built from the catalog, so a mismatch would offer students a
 * function that fails, or hide one that works.
 */
import { expect, it } from "vitest";
import { load, py } from "../python/testkit";
import { toolbox } from "../blocks/toolbox";
import { PICKER_ORDER } from "../eventsheets/sheet";
import { API, CATEGORIES, PROPERTIES } from "./api";

it("every category is in the docs' list, the blocks palette and the sheet pickers", () => {
  const used = [...new Set(API.map((e) => e.category))].sort();
  expect([...CATEGORIES].sort()).toEqual(used);
  expect([...PICKER_ORDER].sort()).toEqual(used);
  const palette = (toolbox() as unknown as { contents: { name: string }[] }).contents.map((c) => c.name);
  for (const c of used) expect(palette, c).toContain(c);
});

it("matches runtime.py's public names, parameters and defaults", async () => {
  const { game } = await load({ code: {} , objects: [] , rooms: [{ name: "R", width: 10, height: 10, instances: [] }] });
  const described = py(game, `
import inspect, json, gameide
def shown(d):
    # As the catalog writes it: strings in double quotes, the rest as Python.
    return json.dumps(d) if isinstance(d, str) else repr(d)
out = {}
for name in gameide.__all__:
    if name == "GameObject":
        continue
    v = getattr(gameide, name)
    if callable(v) and not isinstance(v, type(gameide.global_vars)):
        out[name] = [[p.name, None if p.default is p.empty else shown(p.default)]
                     for p in inspect.signature(v).parameters.values()]
    else:
        out[name] = "variable"
out
`) as Record<string, unknown>;
  const catalog = Object.fromEntries(
    API.map((e) => [e.name, e.kind === "variable" ? "variable" : e.params.map((p) => [p.name, p.default])]),
  );
  expect(catalog).toEqual(described);
});

it("lists only properties GameObject really has", async () => {
  const { game } = await load({ code: {}, objects: [], rooms: [{ name: "R", width: 10, height: 10, instances: [] }] });
  const names = PROPERTIES.map((p) => p.name);
  const missing = py(game, `[n for n in ${JSON.stringify(names)} if not hasattr(GameObject, n)]`);
  expect(missing).toEqual([]);
  // And the other way: every built-in property is documented.
  const undocumented = py(game, `
import gameide
[n for n in gameide._BUILTIN_PROPS if n not in ${JSON.stringify(names)}]`);
  expect(undocumented).toEqual([]);
});
