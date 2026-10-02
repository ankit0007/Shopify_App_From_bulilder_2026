import { describe, expect, it } from "vitest";
import { newFormPublicId } from "./ids";
import { createFormShortcode, parseFormShortcode } from "./shortcode";

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
    expect(parseFormShortcode("[form:missing space]")).toBeNull();
    expect(parseFormShortcode("[contact:184729]")).toBeNull();
  });
});
