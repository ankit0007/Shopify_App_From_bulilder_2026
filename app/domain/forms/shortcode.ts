const SHORTCODE_PATTERN = /^\[form:([A-Za-z0-9_-]+)\]$/;

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
