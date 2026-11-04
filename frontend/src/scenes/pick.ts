/**
 * Clicking a spot in a room, for a scene's step: which room to show and where a
 * click lands. Pure, so it runs headless.
 */
import type { Project, RoomResource } from "../store/project";
import { snap } from "../editor/rooms/roomOps";

/** The room to start in: one this object is really in, or else the first. */
export function startingRoom(project: Project, objectId: string | undefined): RoomResource | undefined {
  return project.rooms.find((r) => r.instances.some((i) => i.object === objectId)) ?? project.rooms[0];
}

export interface Fit {
  zoom: number;
  panX: number;
  panY: number;
}

/** The whole room, as large as fits and in the middle, with a little room around it. */
export function fitRoom(room: { width: number; height: number }, width: number, height: number): Fit {
  const zoom = Math.min((width - 24) / room.width, (height - 24) / room.height);
  return { zoom, panX: (width - room.width * zoom) / 2, panY: (height - room.height * zoom) / 2 };
}

/** The room's point under a place on the canvas, snapped to its grid (exact with Alt); null outside the room. */
export function pointAt(room: { width: number; height: number; gridWidth: number; gridHeight: number }, fit: Fit, canvasX: number, canvasY: number, exact = false): { x: number; y: number } | null {
  const x = (canvasX - fit.panX) / fit.zoom;
  const y = (canvasY - fit.panY) / fit.zoom;
  if (x < 0 || y < 0 || x > room.width || y > room.height) return null;
  return exact ? { x: Math.round(x), y: Math.round(y) } : { x: snap(x, room.gridWidth), y: snap(y, room.gridHeight) };
}
