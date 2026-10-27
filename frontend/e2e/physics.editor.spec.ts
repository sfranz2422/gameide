/**
 * Physics in the browser: the game runs in a worker, so this is the check
 * that planck is in the worker's bundle and steps there. The rules
 * themselves are src/python/physics.test.ts's, in node.
 *
 * The coins template's Walls are solid instances without physics, so they
 * are the kinematic bodies a physics coin lands on.
 */
import { expect, test } from "@playwright/test";
import { fromTemplate, playAndWait, py, SHOTS, watchErrors } from "./helpers";

test("a physics coin falls onto a solid wall and rests there; a rope holds another", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await fromTemplate(page, "coins");
  await playAndWait(page);
  await py(page, `w = min(instances('Wall'), key=lambda w: w.y)
global_vars.w = w
c = instance_create(w.x, w.y - 80, 'Coin')
c.physics = True
global_vars.c = c
h = instance_create(w.x + 100, w.y - 40, 'Coin')
h.physics = True
physics_join(h, None, 'rope', w.x + 140, w.y - 80)
global_vars.h = h`);
  const start = (await py(page, "global_vars.c.y")) as number;
  // Falls…
  await expect.poll(async () => (await py(page, "global_vars.c.y")) as number, { timeout: 10_000 }).toBeGreaterThan(start + 20);
  // …and comes to rest on the wall's top, not through it.
  await expect.poll(async () => Math.abs((await py(page, "global_vars.c.vspeed")) as number), { timeout: 10_000 }).toBeLessThan(0.05);
  const resting = (await py(page, "(global_vars.c.place_free(global_vars.c.x, global_vars.c.y + 1), global_vars.c.y < global_vars.w.y)")) as boolean[];
  expect(resting).toEqual([false, true]);
  // The rope: swung down, never further from its knot than it started (56.6 px).
  const d = (await py(page, "point_distance(global_vars.h.x, global_vars.h.y, global_vars.w.x + 140, global_vars.w.y - 80)")) as number;
  expect(d).toBeLessThan(58);
  expect((await py(page, "global_vars.h.y")) as number).toBeGreaterThan(((await py(page, "global_vars.w.y")) as number) - 40);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/physics.png` });
  expect(errors).toEqual([]);
});
