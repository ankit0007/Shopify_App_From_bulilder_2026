import { describe, expect, it } from "vitest";
import { newFormPublicId } from "./ids";
import {
  createFormShortcode,
  findFormShortcodes,
  parseFormShortcode,
} from "./shortcode";

describe("form public identifiers", () => {
  it("generates unique identifiers", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newFormPublicId()));
    expect(ids).toHaveLength(500);
  });

  it("derives the shortcode only from the immutable public ID", () => {
    const publicId = "184729";
    expect(createFormShortcode(publicId)).toBe("[form:184729]");
    expect(createFormShortcode(publicId)).toBe(createFormShortcode(publicId));
  });

  it("does not change when the form name changes", () => {
    const publicId = "stable123";
    const beforeRename = createFormShortcode(publicId);
    const afterRename = createFormShortcode(publicId);
    expect(afterRename).toBe(beforeRename);
  });

  it("parses valid shortcodes and rejects malformed values", () => {
    expect(parseFormShortcode("[form:184729]")).toBe("184729");
    expect(parseFormShortcode("[form:VQIeABuC4oTP]")).toBe("VQIeABuC4oTP");
    expect(parseFormShortcode("[form:]")).toBeNull();
    expect(parseFormShortcode("[form: ]")).toBeNull();
    expect(parseFormShortcode("[form:abc with spaces]")).toBeNull();
    expect(parseFormShortcode("[FORM:ABC123]")).toBeNull();
    expect(parseFormShortcode("[form:ABC123 extra]")).toBeNull();
    expect(parseFormShortcode("[form:missing space]")).toBeNull();
    expect(parseFormShortcode("[contact:184729]")).toBeNull();
  });

  it("finds only exact shortcodes inside surrounding content", () => {
    const content = [
      "Intro [form:ABC123]",
      "Some content.",
      "[form:XYZ789]",
      "[form:ABC123]",
      "[form:]",
      "[form: ]",
      "[form:abc with spaces]",
      "[FORM:ABC123]",
      "[form:ABC123 extra]",
      "End [form:END123]",
    ].join("\n");

    expect(findFormShortcodes(content).map((match) => match.publicId)).toEqual([
      "ABC123",
      "XYZ789",
      "ABC123",
      "END123",
    ]);
    expect(
      findFormShortcodes("[form:ABC123]").map((match) => match.index),
    ).toEqual([0]);
  });
});
