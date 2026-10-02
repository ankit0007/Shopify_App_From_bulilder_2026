import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("storefront proxy route", () => {
  it("stays a resource route so shortcode requests receive JSON", () => {
    const source = readFileSync(
      new URL("../../routes/proxy.forms.$publicId.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toMatch(/export async function loader/);
    expect(source).toMatch(/export async function action/);
    expect(source).not.toMatch(/export default function/);
  });
});
