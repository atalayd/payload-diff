import { describe, expect, it } from "vitest";
import { diff, summarize, severityOf } from "../src/diff.js";

describe("diff — primitives", () => {
  it("returns empty for identical primitives", () => {
    expect(diff(1, 1)).toEqual([]);
    expect(diff("a", "a")).toEqual([]);
    expect(diff(null, null)).toEqual([]);
  });

  it("flags value changes", () => {
    const d = diff(1, 2);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ kind: "changed", left: 1, right: 2 });
  });

  it("flags type changes (1 vs '1' is not equal)", () => {
    const d = diff(1, "1");
    expect(d).toHaveLength(1);
    expect(d[0]?.kind).toBe("type-changed");
  });
});

describe("diff — objects", () => {
  it("detects added, removed, changed keys", () => {
    const d = diff(
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 99, d: 4 },
    );
    const byKind = Object.fromEntries(d.map((x) => [x.path, x.kind]));
    expect(byKind["/b"]).toBe("changed");
    expect(byKind["/c"]).toBe("removed");
    expect(byKind["/d"]).toBe("added");
    expect(d).toHaveLength(3);
  });

  it("recurses into nested objects", () => {
    const d = diff(
      { user: { name: "a", age: 1 } },
      { user: { name: "b", age: 1 } },
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("/user/name");
  });

  it("escapes / and ~ in keys (RFC 6901)", () => {
    const d = diff({ "a/b": 1 }, { "a/b": 2 });
    expect(d[0]?.path).toBe("/a~1b");
  });
});

describe("diff — arrays", () => {
  it("compares positionally by default", () => {
    const d = diff([1, 2, 3], [1, 9, 3]);
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("/1");
  });

  it("flags length differences", () => {
    const d = diff([1, 2], [1, 2, 3]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ path: "/2", kind: "added", right: 3 });
  });

  it("treats arrays as unordered sets when arrayOrderIndependent=true", () => {
    const d = diff([1, 2, 3], [3, 2, 1], { arrayOrderIndependent: true });
    expect(d).toEqual([]);
  });

  it("still surfaces real differences in unordered mode", () => {
    const d = diff([1, 2, 3], [3, 2, 4], { arrayOrderIndependent: true });
    // 1 only on left, 4 only on right
    expect(d).toHaveLength(2);
    const kinds = d.map((x) => x.kind).sort();
    expect(kinds).toEqual(["added", "removed"]);
  });
});

describe("diff — ISO date tolerance", () => {
  it("treats close ISO dates as equal with a note", () => {
    const d = diff(
      "2026-05-03T12:00:00.000Z",
      "2026-05-03T12:00:00.500Z",
      { isoDateToleranceMs: 1000 },
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.kind).toBe("changed");
    expect(d[0]?.note).toMatch(/tolerance/);
  });

  it("flags ISO dates outside tolerance as a normal change", () => {
    const d = diff(
      "2026-05-03T12:00:00.000Z",
      "2026-05-03T12:00:05.000Z",
      { isoDateToleranceMs: 1000 },
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.note).toBeUndefined();
  });
});

describe("diff — ignore paths", () => {
  it("skips ignored prefixes", () => {
    const d = diff(
      { meta: { ts: "a" }, data: { x: 1 } },
      { meta: { ts: "b" }, data: { x: 2 } },
      { ignorePaths: ["/meta"] },
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("/data/x");
  });
});

describe("summarize", () => {
  it("classifies status by severity", () => {
    expect(summarize([]).status).toBe("match");
    expect(
      summarize([
        { path: "/a", kind: "changed", left: 1, right: 2 },
      ]).status,
    ).toBe("minor");
    expect(
      summarize([
        { path: "/a", kind: "type-changed", left: 1, right: "1" },
      ]).status,
    ).toBe("major");
  });

  it("severityOf maps correctly", () => {
    expect(severityOf("type-changed")).toBe("high");
    expect(severityOf("added")).toBe("medium");
    expect(severityOf("removed")).toBe("medium");
    expect(severityOf("changed")).toBe("low");
  });
});
