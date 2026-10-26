import { describe, expect, it } from "vitest";
import { codeHash } from "./runXp";
import { blankProject as newProject, newScript } from "../store/project";

describe("the code hash a run's XP is claimed with", () => {
  it("changes when the game's code changes, and only then", () => {
    const p = newProject("Test");
    const before = codeHash(p);
    const renamed = structuredClone(p);
    renamed.name = "Something else";
    expect(codeHash(renamed)).toBe(before);
    const scripted = structuredClone(p);
    scripted.scripts.push({ ...newScript("helpers"), code: "def f():\n    return 1\n" });
    expect(codeHash(scripted)).not.toBe(before);
    const edited = structuredClone(scripted);
    edited.scripts[0]!.code = "def f():\n    return 2\n";
    expect(codeHash(edited)).not.toBe(codeHash(scripted));
  });
  it("is 16 hex characters, which is all the server keeps", () => {
    expect(codeHash(newProject("x"))).toMatch(/^[0-9a-f]{16}$/);
  });
});
