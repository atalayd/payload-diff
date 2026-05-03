/**
 * Terminal formatter — turns a list of DiffEntry into colored, scannable output.
 */
import pc from "picocolors";
import type { DiffEntry, DiffSummary } from "./diff.js";

export interface FormatOptions {
  color?: boolean;
}

export function formatDiffs(
  diffs: DiffEntry[],
  summary: DiffSummary,
  opts: FormatOptions = {},
): string {
  const useColor = opts.color !== false;
  const c = useColor ? pc : passthrough;

  const lines: string[] = [];

  // Header
  const statusColor =
    summary.status === "major"
      ? c.red
      : summary.status === "minor"
        ? c.yellow
        : c.green;
  lines.push(
    `${c.bold("payload-diff")}  ${statusColor(c.bold(summary.status.toUpperCase()))}  ` +
      `${c.dim(`${summary.total} diff(s) — ${summary.bySeverity.high} high · ${summary.bySeverity.medium} medium · ${summary.bySeverity.low} low`)}`,
  );

  if (diffs.length === 0) {
    lines.push(c.green("  ✓ payloads are structurally identical"));
    return lines.join("\n");
  }

  lines.push("");

  for (const d of diffs) {
    const tag =
      d.kind === "added"
        ? c.green("+ added       ")
        : d.kind === "removed"
          ? c.red("- removed     ")
          : d.kind === "type-changed"
            ? c.magenta("! type-changed")
            : c.yellow("~ changed     ");
    lines.push(`  ${tag}  ${c.cyan(d.path)}`);
    if (d.left !== undefined) {
      lines.push(`      ${c.dim("left  =")} ${c.red(short(d.left))}`);
    }
    if (d.right !== undefined) {
      lines.push(`      ${c.dim("right =")} ${c.green(short(d.right))}`);
    }
    if (d.note) {
      lines.push(`      ${c.dim("note  =")} ${c.dim(d.note)}`);
    }
  }
  return lines.join("\n");
}

function short(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") {
    return String(v);
  }
  let s: string;
  try {
    s = JSON.stringify(v);
  } catch {
    s = String(v);
  }
  if (s.length > 120) s = s.slice(0, 117) + "...";
  return s;
}

const passthrough = new Proxy(
  {},
  {
    get:
      () =>
      (s: string): string =>
        s,
  },
) as unknown as typeof pc;
