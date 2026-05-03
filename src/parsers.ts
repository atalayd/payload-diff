/**
 * Input parsing — accepts JSON or XML and normalizes both to a
 * comparable JavaScript value.
 */
import { XMLParser } from "fast-xml-parser";

export type PayloadKind = "json" | "xml";

export interface ParsedPayload {
  kind: PayloadKind;
  value: unknown;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

/**
 * Best-effort parse of an arbitrary string. Tries JSON first, falls back to
 * XML. Throws if neither parser can handle the input.
 */
export function parsePayload(text: string): ParsedPayload {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("Empty payload");
  }

  const first = trimmed[0];
  const looksJson = first === "{" || first === "[";
  const looksXml = first === "<";

  if (!looksJson && !looksXml) {
    throw new Error(
      "Could not parse input as JSON or XML — must start with '{', '[' or '<'",
    );
  }

  if (looksJson) {
    try {
      return { kind: "json", value: JSON.parse(trimmed) };
    } catch (e) {
      throw new Error(`Invalid JSON: ${(e as Error).message}`);
    }
  }

  // looksXml
  try {
    const value = xmlParser.parse(trimmed);
    if (value == null || (typeof value === "object" && Object.keys(value).length === 0)) {
      throw new Error("XML parsed to empty document");
    }
    return { kind: "xml", value };
  } catch (e) {
    throw new Error(`Invalid XML: ${(e as Error).message}`);
  }
}
