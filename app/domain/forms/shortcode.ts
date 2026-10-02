const SHORTCODE_PATTERN = /^\[form:([A-Za-z0-9_-]+)\]$/;
const EMBEDDED_SHORTCODE_PATTERN = /\[form:([A-Za-z0-9_-]+)\]/g;

export type EmbeddedFormShortcode = {
  publicId: string;
  index: number;
  length: number;
};

export function createFormShortcode(publicId: string): string {
  if (!publicId || !/^[A-Za-z0-9_-]+$/.test(publicId)) {
    throw new Error("Invalid form public ID");
  }

  return `[form:${publicId}]`;
}

export function parseFormShortcode(value: string): string | null {
  const match = SHORTCODE_PATTERN.exec(value.trim());
  return match?.[1] ?? null;
}

export function findFormShortcodes(value: string): EmbeddedFormShortcode[] {
  return Array.from(value.matchAll(EMBEDDED_SHORTCODE_PATTERN), (match) => ({
    publicId: match[1],
    index: match.index ?? 0,
    length: match[0].length,
  }));
}
