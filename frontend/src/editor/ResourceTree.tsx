/**
 * The resource tree: one folder per kind. Create with +, rename by double
 * click (or F2), duplicate and delete from the ⋯ menu, drag to reorder.
 * Order means something for two kinds: the first room is where the game
 * starts, and scripts run top to bottom.
 */
import { useEffect, useRef, useState } from "react";
import {
  deleteResource,
  freeName,
  nameProblem,
  newId,
  newObject,
  newRoom,
  newScript,
  newTileset,
  quotedUses,
  replaceQuoted,
  type Project,
  type Resource,
  type ResourceKind,
} from "../store/project";
import { OBJECT_DRAG_TYPE } from "./rooms/RoomEditor";
import { Icon } from "./ui/icons";
import { useProjectApi } from "./useProject";

export interface TabRef {
  kind: ResourceKind | "settings";
  id: string;
}

const FOLDERS: { kind: ResourceKind; label: string; icon: () => React.ReactNode; base: string }[] = [
  { kind: "sprites", label: "Sprites", icon: Icon.sprite, base: "sprite" },
  { kind: "tilesets", label: "Tilesets", icon: Icon.tileset, base: "tileset" },
  { kind: "objects", label: "Objects", icon: Icon.object, base: "Object" },
  { kind: "rooms", label: "Rooms", icon: Icon.room, base: "Room" },
  { kind: "scripts", label: "Scripts", icon: Icon.script, base: "script" },
];

// Shown so students can see what is coming, and greyed out until then.
const LATER: { label: string; icon: () => React.ReactNode; phase: string }[] = [
  { label: "Sounds", icon: Icon.sound, phase: "Sounds arrive with audio support." },
];

/** A copy with fresh ids throughout, named "<name>_copy", "<name>_copy2", ... */
function duplicate(project: Project, kind: ResourceKind, r: Resource): Resource {
  const copy = structuredClone(r) as Resource;
  copy.id = newId();
  let name = `${r.name}_copy`;
  for (let i = 2; nameProblem(project, kind, name); i++) name = `${r.name}_copy${i}`;
  copy.name = name;
  if ("events" in copy) copy.events = copy.events.map((e) => ({ ...e, id: newId() }));
  if ("instances" in copy) copy.instances = copy.instances.map((i) => ({ ...i, id: newId() }));
  return copy;
}

export function ResourceTree({
  active,
  open,
  closeTabs,
  addSprite,
}: {
  active: TabRef | null;
  open: (t: TabRef) => void;
  closeTabs: (ids: string[]) => void;
  addSprite: () => void;
}) {
  const { project, mutate } = useProjectApi();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ kind: ResourceKind; id: string; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ kind: ResourceKind; id: string } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  const create = (kind: ResourceKind) => {
    if (kind === "sprites") return addSprite();
    const name = freeName(project, kind, FOLDERS.find((f) => f.kind === kind)!.base);
    const r = kind === "objects" ? newObject(name) : kind === "rooms" ? newRoom(name) : kind === "tilesets" ? newTileset(name) : newScript(name);
    mutate((p) => void (p[kind] as Resource[]).push(r), { label: `add ${name}` });
    open({ kind, id: r.id });
    setRenaming(r.id);
  };

  const remove = (kind: ResourceKind, id: string) => {
    const r = (project[kind] as Resource[]).find((x) => x.id === id)!;
    if (kind === "rooms" && project.rooms.length === 1) {
      alert("A game needs at least one room.");
      return;
    }
    // Work out what would go with it on a copy, to say so before asking.
    const effects = deleteResource(structuredClone(project), kind, id);
    const also = effects.length ? `\n\nThis also removes: ${effects.join(", ")}.` : "";
    if (!confirm(`Delete ${r.name}?${also}`)) return;
    mutate((p) => void deleteResource(p, kind, id), { label: `delete ${r.name}` });
    closeTabs([id]);
  };

  const reorder = (kind: ResourceKind, id: string, beforeId: string | null) => {
    if (id === beforeId) return;
    mutate((p) => {
      const list = p[kind] as Resource[];
      const from = list.findIndex((r) => r.id === id);
      const [item] = list.splice(from, 1);
      const to = beforeId ? list.findIndex((r) => r.id === beforeId) : list.length;
      list.splice(to < 0 ? list.length : to, 0, item!);
    }, { label: "reorder" });
  };

  return (
    <nav className="tree" data-tutorial="resource-tree" aria-label="Resources">
      {FOLDERS.map((f) => {
        const items = project[f.kind] as Resource[];
        const isOpen = !collapsed.has(f.kind);
        return (
          <section key={f.kind} className="tree-folder" data-tutorial={`folder-${f.kind}`}>
            <header
              className="tree-folder-head"
              onDragOver={(e) => drag?.kind === f.kind && e.preventDefault()}
              onDrop={() => drag && drag.kind === f.kind && reorder(f.kind, drag.id, null)}
            >
              <button
                className="tree-toggle"
                aria-expanded={isOpen}
                onClick={() =>
                  setCollapsed((c) => {
                    const n = new Set(c);
                    if (n.has(f.kind)) n.delete(f.kind);
                    else n.add(f.kind);
                    return n;
                  })
                }
              >
                {Icon.chevron(isOpen)}
                {f.icon()}
                <span>{f.label}</span>
                <span className="tree-count">{items.length}</span>
              </button>
              <button
                className="icon-btn"
                title={`New ${f.label.toLowerCase().replace(/s$/, "")}`}
                aria-label={`New ${f.label.toLowerCase().replace(/s$/, "")}`}
                data-tutorial={`add-${f.kind}`}
                data-testid={`add-${f.kind}`}
                onClick={() => create(f.kind)}
              >
                {Icon.plus()}
              </button>
            </header>
            {isOpen && (
              <ul className="tree-items">
                {items.map((r, i) => (
                  <li
                    key={r.id}
                    className={`tree-item ${active?.id === r.id ? "active" : ""}`}
                    draggable={renaming !== r.id}
                    onDragStart={(e) => {
                      setDrag({ kind: f.kind, id: r.id });
                      // An object can also be dropped into a room to place it.
                      if (f.kind === "objects") e.dataTransfer.setData(OBJECT_DRAG_TYPE, r.id);
                      e.dataTransfer.effectAllowed = "copyMove";
                    }}
                    onDragEnd={() => setDrag(null)}
                    onDragOver={(e) => drag?.kind === f.kind && e.preventDefault()}
                    onDrop={(e) => {
                      e.stopPropagation();
                      if (drag && drag.kind === f.kind) reorder(f.kind, drag.id, r.id);
                    }}
                    data-tutorial={`resource-${r.name}`}
                  >
                    {renaming === r.id ? (
                      <RenameBox
                        project={project}
                        kind={f.kind}
                        resource={r}
                        done={(name) => {
                          setRenaming(null);
                          if (name === null || name === r.name) return;
                          const uses = f.kind === "objects" || f.kind === "sprites" || f.kind === "rooms" ? quotedUses(project, r.name) : [];
                          const total = uses.reduce((n, u) => n + u.count, 0);
                          const alsoCode =
                            total > 0 &&
                            confirm(
                              `"${r.name}" appears in quotes ${total} time${total === 1 ? "" : "s"} in your code (${uses
                                .map((u) => u.where)
                                .join(", ")}).\n\nChange those to "${name}" too?`,
                            );
                          mutate(
                            (p) => {
                              (p[f.kind] as Resource[]).find((x) => x.id === r.id)!.name = name;
                              if (alsoCode) replaceQuoted(p, r.name, name);
                            },
                            { label: `rename ${r.name}` },
                          );
                        }}
                      />
                    ) : (
                      <button
                        className="tree-item-btn"
                        onClick={() => open({ kind: f.kind, id: r.id })}
                        onDoubleClick={() => setRenaming(r.id)}
                        onKeyDown={(e) => e.key === "F2" && setRenaming(r.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMenu({ kind: f.kind, id: r.id, x: e.clientX, y: e.clientY });
                        }}
                      >
                        {f.icon()}
                        <span className="tree-name">{r.name}</span>
                        {f.kind === "rooms" && i === 0 && (
                          <span className="tree-badge" title="The game starts in the first room. Drag to change.">
                            start
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      className="icon-btn tree-more"
                      aria-label={`More for ${r.name}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setMenu({ kind: f.kind, id: r.id, x: b.left, y: b.bottom });
                      }}
                    >
                      {Icon.more()}
                    </button>
                  </li>
                ))}
                {items.length === 0 && <li className="tree-empty">None yet — press +</li>}
              </ul>
            )}
          </section>
        );
      })}
      {LATER.map((l) => (
        <section key={l.label} className="tree-folder later" title={l.phase}>
          <header className="tree-folder-head">
            <span className="tree-toggle">
              {Icon.chevron(false)}
              {l.icon()}
              <span>{l.label}</span>
              <span className="tree-soon">soon</span>
            </span>
          </header>
        </section>
      ))}
      <button className="tree-settings" onClick={() => open({ kind: "settings", id: "settings" })} data-tutorial="game-settings">
        {Icon.settings()} Game settings
      </button>

      {menu && (
        <div className="menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()} role="menu">
          <button role="menuitem" onClick={() => (setRenaming(menu.id), setMenu(null))}>
            Rename
          </button>
          <button
            role="menuitem"
            onClick={() => {
              const r = (project[menu.kind] as Resource[]).find((x) => x.id === menu.id)!;
              const copy = duplicate(project, menu.kind, r);
              mutate(
                (p) => {
                  const list = p[menu.kind] as Resource[];
                  list.splice(list.findIndex((x) => x.id === menu.id) + 1, 0, copy);
                },
                { label: `duplicate ${r.name}` },
              );
              open({ kind: menu.kind, id: copy.id });
              setMenu(null);
            }}
          >
            Duplicate
          </button>
          <button role="menuitem" className="danger" onClick={() => (setMenu(null), remove(menu.kind, menu.id))}>
            Delete
          </button>
        </div>
      )}
    </nav>
  );
}

function RenameBox({
  project,
  kind,
  resource,
  done,
}: {
  project: Project;
  kind: ResourceKind;
  resource: Resource;
  done: (name: string | null) => void;
}) {
  const [value, setValue] = useState(resource.name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.select();
  }, []);
  const problem = value === resource.name ? null : nameProblem(project, kind, value, resource.id);
  const commit = () => done(problem ? null : value.trim());
  return (
    <span className="rename">
      <input
        ref={input}
        value={value}
        aria-label="Name"
        aria-invalid={!!problem}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") done(null);
        }}
      />
      {problem && <span className="rename-problem">{problem}</span>}
    </span>
  );
}
