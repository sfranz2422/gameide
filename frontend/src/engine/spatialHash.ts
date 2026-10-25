/**
 * A uniform grid of buckets, each holding the slots whose collision box
 * touches that cell. Every collision query in the engine goes through here:
 * a query looks only at the cells its rectangle covers, so asking "is there
 * a Wall here?" costs the same with 10 walls in the room as with 10 000.
 *
 * Each slot remembers the range of cells it was filed under. `update` with
 * the same range is a no-op, which is the common case — most moves stay
 * inside the cells they started in.
 */
export class SpatialHash {
  private readonly cells = new Map<number, number[]>();
  /** Per slot: [cx0, cy0, cx1, cy1], or cx0 = NONE when not filed. */
  private ranges = new Int32Array(0);
  /**
   * Per slot, the query number that last reported it. Lets a query skip a
   * slot it already saw in another cell without allocating a Set.
   */
  private stamps = new Uint32Array(0);
  private stamp = 0;

  private static readonly NONE = 0x7fffffff;

  constructor(readonly cellSize = 64) {}

  private ensure(slot: number) {
    if (slot < this.stamps.length) return;
    let n = Math.max(64, this.stamps.length);
    while (n <= slot) n *= 2;
    const r = new Int32Array(n * 4).fill(SpatialHash.NONE);
    r.set(this.ranges);
    this.ranges = r;
    const s = new Uint32Array(n);
    s.set(this.stamps);
    this.stamps = s;
  }

  /** Cell keys pack two signed 16-bit cell coordinates into one number. */
  private static key(cx: number, cy: number) {
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }

  /** File `slot` under the cells covering [left, right) × [top, bottom). */
  update(slot: number, left: number, top: number, right: number, bottom: number) {
    this.ensure(slot);
    const cs = this.cellSize;
    const cx0 = Math.floor(left / cs);
    const cy0 = Math.floor(top / cs);
    // A box exactly one cell wide must not spill into the next cell, so the
    // far edge is treated as exclusive. Never less than the near edge: a box
    // of zero size (a sprite with no pixels) still lives somewhere.
    const cx1 = Math.max(cx0, Math.ceil(right / cs) - 1);
    const cy1 = Math.max(cy0, Math.ceil(bottom / cs) - 1);
    const r = this.ranges;
    const b = slot * 4;
    if (r[b] === cx0 && r[b + 1] === cy0 && r[b + 2] === cx1 && r[b + 3] === cy1) return;
    this.remove(slot);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = SpatialHash.key(cx, cy);
        const bucket = this.cells.get(k);
        if (bucket) bucket.push(slot);
        else this.cells.set(k, [slot]);
      }
    }
    r[b] = cx0;
    r[b + 1] = cy0;
    r[b + 2] = cx1;
    r[b + 3] = cy1;
  }

  remove(slot: number) {
    if (slot >= this.stamps.length) return;
    const r = this.ranges;
    const b = slot * 4;
    const cx0 = r[b]!;
    if (cx0 === SpatialHash.NONE) return;
    const cy0 = r[b + 1]!, cx1 = r[b + 2]!, cy1 = r[b + 3]!;
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = SpatialHash.key(cx, cy);
        const bucket = this.cells.get(k);
        if (!bucket) continue;
        const i = bucket.indexOf(slot);
        if (i >= 0) {
          // Order inside a bucket does not matter: swap-remove.
          bucket[i] = bucket[bucket.length - 1]!;
          bucket.pop();
        }
        if (bucket.length === 0) this.cells.delete(k);
      }
    }
    r[b] = SpatialHash.NONE;
  }

  clear() {
    this.cells.clear();
    this.ranges.fill(SpatialHash.NONE);
  }

  /**
   * Calls `visit` once for each slot filed in a cell the rectangle covers.
   * These are candidates only: the caller still tests the real boxes.
   * Returning true from `visit` stops the search (first match wins).
   */
  query(left: number, top: number, right: number, bottom: number, visit: (slot: number) => boolean | void): boolean {
    const cs = this.cellSize;
    const cx0 = Math.floor(left / cs);
    const cy0 = Math.floor(top / cs);
    const cx1 = Math.max(cx0, Math.ceil(right / cs) - 1);
    const cy1 = Math.max(cy0, Math.ceil(bottom / cs) - 1);
    const stamps = this.stamps;
    if (this.stamp >= 0xfffffffe) {
      // After four billion queries the counter would wrap and every slot
      // would look already-seen. Start the count again.
      stamps.fill(0);
      this.stamp = 0;
    }
    const stamp = ++this.stamp;
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const bucket = this.cells.get(SpatialHash.key(cx, cy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const s = bucket[i]!;
          if (stamps[s] === stamp) continue;
          stamps[s] = stamp;
          if (visit(s)) return true;
        }
      }
    }
    return false;
  }
}
