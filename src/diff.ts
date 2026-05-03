/**
 * Core structural diff engine.
 *
 * Walks two arbitrary values in parallel and emits a flat list of differences
 * keyed by JSON-pointer-style path. Type-aware (so `1` vs `"1"` is reported as
 * a type change, not a value change).
 */

export type DiffKind =
  | "added"
  | "removed"
  | "changed"
  | "type-changed";

export interface DiffEntry {
  /** JSON-pointer-ish path to the differing node, e.g. `/orders/0/price`. */
  path: string;
  kind: DiffKind;
  /** Value on the left side (undefined when added). */
  left?: unknown;
  /** Value on the right side (undefined when removed). */
  right?: unknown;
  /** Optional human-readable reason (e.g. "ISO date drift within tolerance"). */
  note?: string;
}

export interface DiffOptions {
  /**
   * Treat arrays as unordered sets — match elements by deep equality
   * rather than by index. Useful for payloads where ordering is incidental.
   * @default false
   */
  arrayOrderIndependent?: boolean;
  /**
   * If both sides parse as ISO-8601 timestamps and differ by less than
   * this many milliseconds, treat as equal (with a note instead of a diff).
   * @default 0
   */
  isoDateToleranceMs?: number;
  /**
   * Path prefixes to ignore entirely. e.g. `["/meta/timestamp"]`.
   * @default []
   */
  ignorePaths?: string[];
}

const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Public entry point. */
export function diff(
  left: unknown,
  right: unknown,
  opts: DiffOptions = {},
): DiffEntry[] {
  const out: DiffEntry[] = [];
  walk(left, right, "", out, opts);
  return out;
}

function isPrefixIgnored(path: string, ignore: string[] | undefined): boolean {
  if (!ignore || ignore.length === 0) return false;
  return ignore.some((p) => path === p || path.startsWith(p + "/"));
}

function walk(
  l: unknown,
  r: unknown,
  path: string,
  out: DiffEntry[],
  opts: DiffOptions,
): void {
  if (isPrefixIgnored(path, opts.ignorePaths)) return;

  // Identical references / primitives short-circuit.
  if (Object.is(l, r)) return;

  const lt = typeOf(l);
  const rt = typeOf(r);

  if (lt !== rt) {
    // ISO date drift tolerance only applies if both sides are strings.
    if (lt === "string" && rt === "string") {
      // unreachable because lt !== rt, but keeps typing tidy
    }
    out.push({ path: path || "/", kind: "type-changed", left: l, right: r });
    return;
  }

  switch (lt) {
    case "object":
      walkObject(l as Record<string, unknown>, r as Record<string, unknown>, path, out, opts);
      return;
    case "array":
      if (opts.arrayOrderIndependent) {
        walkArrayUnordered(l as unknown[], r as unknown[], path, out, opts);
      } else {
        walkArray(l as unknown[], r as unknown[], path, out, opts);
      }
      return;
    case "string": {
      const ls = l as string;
      const rs = r as string;
      if (ls === rs) return;
      // ISO date drift tolerance
      const tol = opts.isoDateToleranceMs ?? 0;
      if (tol > 0 && ISO_RE.test(ls) && ISO_RE.test(rs)) {
        const lms = Date.parse(ls);
        const rms = Date.parse(rs);
        if (
          Number.isFinite(lms) &&
          Number.isFinite(rms) &&
          Math.abs(lms - rms) <= tol
        ) {
          out.push({
            path: path || "/",
            kind: "changed",
            left: ls,
            right: rs,
            note: `ISO date drift within ${tol}ms tolerance`,
          });
          return;
        }
      }
      out.push({ path: path || "/", kind: "changed", left: ls, right: rs });
      return;
    }
    default:
      // number, boolean, null, bigint, undefined — direct compare
      out.push({ path: path || "/", kind: "changed", left: l, right: r });
  }
}

function walkObject(
  l: Record<string, unknown>,
  r: Record<string, unknown>,
  path: string,
  out: DiffEntry[],
  opts: DiffOptions,
): void {
  const keys = new Set<string>([...Object.keys(l), ...Object.keys(r)]);
  // Stable, sorted output
  const sorted = [...keys].sort();
  for (const k of sorted) {
    const childPath = `${path}/${escapeKey(k)}`;
    if (isPrefixIgnored(childPath, opts.ignorePaths)) continue;
    const inL = Object.prototype.hasOwnProperty.call(l, k);
    const inR = Object.prototype.hasOwnProperty.call(r, k);
    if (inL && !inR) {
      out.push({ path: childPath, kind: "removed", left: l[k] });
    } else if (!inL && inR) {
      out.push({ path: childPath, kind: "added", right: r[k] });
    } else {
      walk(l[k], r[k], childPath, out, opts);
    }
  }
}

function walkArray(
  l: unknown[],
  r: unknown[],
  path: string,
  out: DiffEntry[],
  opts: DiffOptions,
): void {
  const max = Math.max(l.length, r.length);
  for (let i = 0; i < max; i++) {
    const childPath = `${path}/${i}`;
    if (i >= l.length) {
      out.push({ path: childPath, kind: "added", right: r[i] });
    } else if (i >= r.length) {
      out.push({ path: childPath, kind: "removed", left: l[i] });
    } else {
      walk(l[i], r[i], childPath, out, opts);
    }
  }
}

function walkArrayUnordered(
  l: unknown[],
  r: unknown[],
  path: string,
  out: DiffEntry[],
  opts: DiffOptions,
): void {
  const rRemaining = [...r];
  const onlyInL: unknown[] = [];
  for (const item of l) {
    const idx = rRemaining.findIndex((cand) => deepEqual(item, cand));
    if (idx === -1) {
      onlyInL.push(item);
    } else {
      rRemaining.splice(idx, 1);
    }
  }
  let i = 0;
  for (const item of onlyInL) {
    out.push({ path: `${path}/-${i++}`, kind: "removed", left: item });
  }
  i = 0;
  for (const item of rRemaining) {
    out.push({ path: `${path}/+${i++}`, kind: "added", right: item });
  }
}

function escapeKey(k: string): string {
  // RFC 6901 escaping for `/` and `~` in keys
  return k.replace(/~/g, "~0").replace(/\//g, "~1");
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  const at = typeOf(a);
  const bt = typeOf(b);
  if (at !== bt) return false;
  if (at === "array") {
    const aa = a as unknown[];
    const bb = b as unknown[];
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) {
      if (!deepEqual(aa[i], bb[i])) return false;
    }
    return true;
  }
  if (at === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
      if (!deepEqual(ao[k], bo[k])) return false;
    }
    return true;
  }
  return false;
}

/** Severity classifier for triage / colored output. */
export function severityOf(kind: DiffKind): "high" | "medium" | "low" {
  switch (kind) {
    case "type-changed":
      return "high";
    case "removed":
    case "added":
      return "medium";
    case "changed":
      return "low";
  }
}

export interface DiffSummary {
  total: number;
  byKind: Record<DiffKind, number>;
  bySeverity: Record<"high" | "medium" | "low", number>;
  status: "match" | "minor" | "major";
}

export function summarize(diffs: DiffEntry[]): DiffSummary {
  const byKind: Record<DiffKind, number> = {
    added: 0,
    removed: 0,
    changed: 0,
    "type-changed": 0,
  };
  const bySeverity: Record<"high" | "medium" | "low", number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const d of diffs) {
    byKind[d.kind]++;
    bySeverity[severityOf(d.kind)]++;
  }
  let status: DiffSummary["status"] = "match";
  if (bySeverity.high > 0) status = "major";
  else if (bySeverity.medium > 0 || bySeverity.low > 0) status = "minor";
  return { total: diffs.length, byKind, bySeverity, status };
}
