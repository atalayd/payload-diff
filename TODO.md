# TODO — the AI-augmented and weekend roadmap

The scaffold ships a deterministic, type-aware structural diff engine + a CLI.
The two things that turn this from "useful tool" into "portfolio piece" are
below. Both are intentionally weekend-sized.

---

## 1. AI explanation mode (`--explain`)

**Goal:** when run with `--explain`, every diff entry gets a one-sentence
plain-English explanation of *what changed and why it might matter*.

### Suggested implementation

- Add an `src/explain.ts` module that takes `DiffEntry[]` + the original
  payloads and calls an LLM via the OpenAI / Anthropic / Replit AI Integrations
  SDK.
- Constrain output with a JSON schema:
  ```json
  {
    "explanations": [
      { "path": "/foo", "summary": "...", "likelyCause": "...", "severity": "high|medium|low" }
    ]
  }
  ```
- Group related diffs (e.g. all field changes inside the same object) before
  sending to the LLM — saves tokens and produces cleaner narratives.
- Add a small eval harness in `test/explain.eval.ts` with ~20 hand-labeled
  diff scenarios. Track precision on `likelyCause` classification across
  prompt iterations.

### CLI surface

```
payload-diff prod.json uat.json --explain
payload-diff prod.json uat.json --explain --json   # structured output for piping
```

### Env

- `PAYLOAD_DIFF_LLM_PROVIDER=openai|anthropic|replit` (default `replit`)
- `PAYLOAD_DIFF_LLM_MODEL=...`
- API key from the corresponding env var

---

## 2. Web UI (`web/`)

**Goal:** a single-page React + Vite app where you can paste two payloads,
hit Diff, and see a colored, sortable result. Deployed publicly so a
recruiter can use it without `npm install`.

### Suggested stack

- Vite + React + TypeScript (mirror the portfolio site's stack)
- Reuse the `diff` and `parsePayload` exports — they already work in the
  browser, no Node-only imports.
- Tailwind for styling. Match the portfolio's dark-mode palette.
- Two `<textarea>` panes, a Diff button, results list with severity color.
- Optional: a "Try sample payloads" button that loads `examples/prod.json`
  and `examples/uat.json`.
- Bonus: hook the AI explanation mode behind a "Why?" button per diff row.

### Deployment

- Deploy on Replit alongside the portfolio. Add a route on the portfolio
  Projects section that links to the live demo.

---

## 3. Smaller follow-ups

- [ ] Publish to npm as `@atalayd/payload-diff`
- [ ] Add `--baseline=<file>` mode that records a "known good" payload and
      compares all subsequent inputs against it
- [ ] Add a `--watch` mode for live feeds
- [ ] FIX-message support (parse `8=FIX.4.4|9=...` into key-value pairs)
- [ ] CSV / fixed-width record support
- [ ] A neutral/CI-friendly output mode that produces a unified-diff–style
      patch, so it can be commented on PRs
