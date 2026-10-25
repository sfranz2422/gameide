import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { packed } from "./api";
import { blankProject } from "./project";
import { exportZip, importZip } from "./zip";

const PNG = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], { type: "image/png" });

describe("project .zip", () => {
  it("round-trips a project and its pictures, as a new project", async () => {
    const p = blankProject("Maze");
    p.sprites.push({ id: "s1", name: "wall", width: 32, height: 32, originX: 0, originY: 0, frames: ["a1", "a2"] });
    const zip = await exportZip(p, async (id) => (id === "a1" ? PNG : null));
    const back = await importZip(zip, ["Maze"]);
    expect(back.project.id).not.toBe(p.id); // never overwrites the original
    expect(back.project.name).toBe("Maze (imported)");
    expect(back.project.sprites).toEqual(p.sprites);
    expect([...back.assets.keys()]).toEqual(["a1"]); // a missing picture is left out, not invented
    expect(new Uint8Array(await back.assets.get("a1")!.arrayBuffer())).toEqual(new Uint8Array(await PNG.arrayBuffer()));
  });

  it("opens a zip whose files sit inside a folder", async () => {
    const p = blankProject("Nested");
    const zip = new Blob([zipSync({ "my game/project.json": strToU8(JSON.stringify(p)) }) as BlobPart]);
    expect((await importZip(zip, [])).project.name).toBe("Nested");
  });

  it("says what is wrong with a file that isn't a project", async () => {
    await expect(importZip(new Blob(["hello"]), [])).rejects.toThrow("isn't a .zip file");
    const noProject = new Blob([zipSync({ "readme.txt": strToU8("hi") }) as BlobPart]);
    await expect(importZip(noProject, [])).rejects.toThrow("no project.json");
    const other = new Blob([zipSync({ "project.json": strToU8('{"format":"scratch"}') }) as BlobPart]);
    await expect(importZip(other, [])).rejects.toThrow("isn't a GameIDE project");
  });
});

describe("packed request bodies", () => {
  it("carry any text, code and all, as base64 the server can unpack", () => {
    const value = { code: 'print("héllo")\n<script>alert(1)</script> SELECT * FROM users;', n: 1 };
    const body = JSON.parse(packed(value)) as { _packed: string };
    expect(Object.keys(body)).toEqual(["_packed"]);
    expect(body._packed).not.toContain("script");
    const text = new TextDecoder().decode(Uint8Array.from(atob(body._packed), (c) => c.charCodeAt(0)));
    expect(JSON.parse(text)).toEqual(value);
  });
});
