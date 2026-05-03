#!/usr/bin/env node
/**
 * payload-diff CLI
 *
 * Usage:
 *   payload-diff <left> <right> [options]
 *
 * <left> / <right> may be a file path, or `-` for stdin (one only).
 *
 * Options:
 *   --json                       Output diffs as JSON instead of text.
 *   --no-color                   Disable terminal colors.
 *   --array-as-set               Treat arrays as unordered sets.
 *   --iso-tolerance=<ms>         Tolerate ISO-date drift up to N ms.
 *   --ignore=<path>              Ignore a JSON-pointer path. Repeatable.
 *   --exit-on-diff               Exit with code 1 if any diff is found.
 *   -h, --help                   Show help.
 */
import { readFileSync } from "node:fs";
import { diff, summarize } from "./diff.js";
import { parsePayload } from "./parsers.js";
import { formatDiffs } from "./format.js";

interface CliArgs {
  left: string;
  right: string;
  json: boolean;
  color: boolean;
  arrayAsSet: boolean;
  isoToleranceMs: number;
  ignore: string[];
  exitOnDiff: boolean;
}

function parseArgs(argv: string[]): CliArgs | "help" {
  const positionals: string[] = [];
  const flags = {
    json: false,
    color: true,
    arrayAsSet: false,
    isoToleranceMs: 0,
    ignore: [] as string[],
    exitOnDiff: false,
  };

  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") return "help";
    if (arg === "--json") flags.json = true;
    else if (arg === "--no-color") flags.color = false;
    else if (arg === "--array-as-set") flags.arrayAsSet = true;
    else if (arg === "--exit-on-diff") flags.exitOnDiff = true;
    else if (arg.startsWith("--iso-tolerance=")) {
      const n = Number(arg.split("=")[1]);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`Invalid --iso-tolerance value: ${arg}`);
      }
      flags.isoToleranceMs = n;
    } else if (arg.startsWith("--ignore=")) {
      const p = arg.split("=")[1];
      if (p) flags.ignore.push(p);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length !== 2) {
    return "help";
  }

  return {
    left: positionals[0]!,
    right: positionals[1]!,
    ...flags,
  };
}

function readSource(src: string): string {
  if (src === "-") {
    return readFileSync(0, "utf8");
  }
  return readFileSync(src, "utf8");
}

const HELP = `payload-diff — type-aware structural diff for JSON & XML

Usage:
  payload-diff <left> <right> [options]

Arguments:
  <left>  <right>               File paths, or '-' for stdin (one only).

Options:
  --json                        Emit diffs as JSON.
  --no-color                    Disable terminal colors.
  --array-as-set                Treat arrays as unordered sets.
  --iso-tolerance=<ms>          Tolerate ISO-date drift up to N ms.
  --ignore=<path>               Ignore a JSON-pointer path. Repeatable.
  --exit-on-diff                Exit with code 1 if any diff is found.
  -h, --help                    Show this help.

Examples:
  payload-diff prod.json uat.json
  payload-diff prod.xml  uat.xml --array-as-set
  curl -s ... | payload-diff - baseline.json --exit-on-diff
`;

export function run(argv: string[] = process.argv.slice(2)): void {
  let parsed: CliArgs | "help";
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n\n${HELP}`);
    process.exit(2);
  }
  if (parsed === "help") {
    process.stdout.write(HELP);
    return;
  }

  // Cannot stdin both sides
  if (parsed.left === "-" && parsed.right === "-") {
    process.stderr.write(`error: only one of <left>/<right> may be '-'\n`);
    process.exit(2);
  }

  let leftRaw: string;
  let rightRaw: string;
  try {
    leftRaw = readSource(parsed.left);
    rightRaw = readSource(parsed.right);
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    process.exit(2);
  }

  let left, right;
  try {
    left = parsePayload(leftRaw).value;
    right = parsePayload(rightRaw).value;
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    process.exit(2);
  }

  const diffs = diff(left, right, {
    arrayOrderIndependent: parsed.arrayAsSet,
    isoDateToleranceMs: parsed.isoToleranceMs,
    ignorePaths: parsed.ignore,
  });
  const summary = summarize(diffs);

  if (parsed.json) {
    process.stdout.write(JSON.stringify({ summary, diffs }, null, 2) + "\n");
  } else {
    process.stdout.write(formatDiffs(diffs, summary, { color: parsed.color }) + "\n");
  }

  if (parsed.exitOnDiff && diffs.length > 0) {
    process.exit(1);
  }
}

run();
