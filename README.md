# payload-diff

> Type-aware structural diff for **JSON** and **XML** payloads.
> Inspired by an internal Wall Street reconciliation workbook that delivered
> 90%+ testing-productivity gains for a tier-1 bank's surveillance team.
> This is the open, AI-augmented take.


[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Why this exists

In a previous role I built a private Excel + VBA tool that diffed Prod-vs-UAT
JSON / XML payloads for the team. It removed hours of manual
side-by-side comparison every day, drove a measurable **90%+ testing-productivity
gain**, and got adopted across the organization.

This is the **open, language-agnostic, AI-augmented version of that tool** —
written from scratch, with no proprietary code or data, and designed to be
useful to any team that has to reconcile payloads between two environments.

The deterministic diff engine ships in v0.1. The LLM "explain this diff"
mode and a hosted web UI are scoped in [`TODO.md`](TODO.md) as follow-on work.

---

## What it does (today)

- Parses JSON or XML on either side (autodetected)
- Walks both payloads and emits a flat list of differences keyed by
  JSON-pointer-style path (`/orders/0/price`, `/meta/version`, ...)
- **Type-aware** — `1` vs `"1"` is reported as a `type-changed`, not a
  silent value change
- **Structural** — added / removed / changed keys, recursive into nested
  objects and arrays
- **Pragmatic options** for the things that actually matter in
  reconciliation:
  - `--array-as-set` — treat arrays as unordered (good when ordering is
    incidental, like a list of tags)
  - `--iso-tolerance=500` — tolerate ISO-8601 timestamp drift up to N ms
  - `--ignore=/meta` — skip prefixes you don't care about (timestamps,
    feed-source labels, etc.)
  - `--exit-on-diff` — exit code 1 if any diff is found, for CI pipelines
- Colored CLI output with a one-glance **MAJOR / MINOR / MATCH** verdict
- `--json` flag for piping into anything else

## What's coming (see [`TODO.md`](TODO.md))

- `--explain` — LLM-backed plain-English explanation of every diff, with
  structured `likelyCause` classification and an eval harness
- `web/` — a paste-and-diff Vite + React app, deployed publicly
- FIX-message parsing, baseline mode, watch mode, npm publish

---

## Install

```bash
git clone https://github.com/atalayd/payload-diff.git
cd payload-diff
npm install      # auto-builds via the `prepare` script
```

## Use

```bash
# Diff two files
npx payload-diff examples/prod.json examples/uat.json

# Pipe one side from stdin
curl -s https://api.example.com/order/123 | npx payload-diff - baseline.json

# CI: fail the job if anything drifted
npx payload-diff prod.json uat.json --exit-on-diff

# Tolerant mode for noisy reconciliations
npx payload-diff prod.json uat.json \
  --array-as-set \
  --iso-tolerance=1000 \
  --ignore=/meta/source
```

## Try it on the included sample

```bash
npm run example
```

You'll see something like:

```
payload-diff  MAJOR  6 diff(s) — 1 high · 4 medium · 1 low

  ! type-changed   /quantity
      left  = 5000
      right = "5000"
  ~ changed        /tradingCapacity
      left  = "DEAL"
      right = "MTCH"
  ~ changed        /executionTimestamp
      left  = "2026-05-01T14:33:21.412Z"
      right = "2026-05-01T14:33:21.520Z"
  + added          /tags/2
      right = "smart-routed"
  ~ changed        /meta/source
      left  = "prod-feed-1"
      right = "uat-feed-1"
  ~ changed        /meta/version
      left  = "2.4.1"
      right = "2.4.2"
```

Re-run with realistic tolerance to ignore the noise:

```bash
npx payload-diff examples/prod.json examples/uat.json \
  --iso-tolerance=1000 \
  --ignore=/meta
```

Now only the genuine alert-payload differences (`quantity`, `tradingCapacity`,
new `tags` element) remain — which is exactly the triage decision an analyst
would have to make manually.

---

## Use as a library

```ts
import { diff, summarize, parsePayload } from "@atalayd/payload-diff";

const left = parsePayload(rawA).value;
const right = parsePayload(rawB).value;
const diffs = diff(left, right, { isoDateToleranceMs: 1000 });
const summary = summarize(diffs);

if (summary.status === "major") {
  // page someone
}
```

---

## Development

```bash
npm install
npm run dev          # run the CLI via tsx (no build step)
npm test             # run the unit tests
npm run typecheck    # strict TS check
npm run build        # emit dist/
```

---

## Author

**Atalay Durdu** — AI Solutions Architect & Senior Business Analyst
- Portfolio: [[atalaydurdu.com](https://www.atalaydurdu.com/))
- GitHub:    [@atalayd](https://github.com/atalayd)

## License

MIT — see [LICENSE](LICENSE).
