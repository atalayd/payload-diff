import { describe, expect, it } from "vitest";
import { parsePayload } from "../src/parsers.js";

describe("parsePayload", () => {
  it("parses JSON", () => {
    const p = parsePayload('{"a":1}');
    expect(p.kind).toBe("json");
    expect(p.value).toEqual({ a: 1 });
  });

  it("parses XML", () => {
    const p = parsePayload("<root><a>1</a></root>");
    expect(p.kind).toBe("xml");
    expect(p.value).toMatchObject({ root: { a: "1" } });
  });

  it("throws on garbage", () => {
    expect(() => parsePayload("not a payload at all")).toThrow();
  });

  it("rejects empty input", () => {
    expect(() => parsePayload("   ")).toThrow(/Empty/);
  });
});
