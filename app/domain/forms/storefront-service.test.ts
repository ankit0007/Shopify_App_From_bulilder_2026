import { describe, expect, it } from "vitest";
import {
  resolvePublishedForm,
  validateSubmission,
} from "./storefront-service.server";
import { DEFAULT_STYLE_TOKENS } from "./builder-schema";

const baseForm = {
  shopId: "shop-a",
  formId: "form-a",
  versionId: "version-a",
  publicId: "public-a",
  columns: 1 as const,
  settings: {
    description: "",
    submitLabel: "Submit",
    successMessage: "Thanks",
    errorMessage: "Try again",
  },
  style: DEFAULT_STYLE_TOKENS,
  fields: [
    {
      id: "name_id",
      type: "text" as const,
      label: "Name",
      name: "name",
      description: "",
      placeholder: "",
      defaultValue: "",
      required: true,
      disabled: false,
      hidden: false,
      row: 1,
      column: 1,
      width: 12 as const,
      options: [],
      validation: {},
    },
  ],
};

describe("storefront submissions", () => {
  it("accepts valid values and rejects unexpected fields", () => {
    expect(validateSubmission(baseForm, { name: "Ada" })).toEqual({
      ok: true,
      values: { name: "Ada" },
    });
    expect(
      validateSubmission(baseForm, { name: "Ada", injected: "x" }),
    ).toEqual(expect.objectContaining({ ok: false }));
  });

  it("validates required, email, URL, number, and choice values", () => {
    const form = {
      ...baseForm,
      fields: [
        { ...baseForm.fields[0], type: "email" as const, name: "email" },
        {
          ...baseForm.fields[0],
          type: "url" as const,
          name: "website",
          required: false,
        },
        {
          ...baseForm.fields[0],
          type: "number" as const,
          name: "age",
          required: false,
          validation: { min: 18, max: 65 },
        },
        {
          ...baseForm.fields[0],
          type: "select" as const,
          name: "plan",
          required: false,
          options: [{ label: "Free", value: "free" }],
        },
      ],
    };
    const result = validateSubmission(form, {
      email: "not-an-email",
      website: "javascript:alert(1)",
      age: "10",
      plan: "premium",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toHaveLength(4);
  });

  it("rejects oversized payloads", () => {
    expect(validateSubmission(baseForm, { name: "x".repeat(70_000) })).toEqual(
      expect.objectContaining({ ok: false }),
    );
  });

  it("resolves only the current published version for the tenant", async () => {
    const db = {
      form: {
        findFirst: async () => ({
          id: "form-a",
          shopId: "shop-a",
          publicId: "public-a",
          publishedVersion: 2,
          versions: [
            {
              id: "version-a",
              version: 2,
              settings: baseForm.settings,
              layout: { columns: 1 },
              style: { tokens: DEFAULT_STYLE_TOKENS },
              fields: [
                {
                  id: "name_id",
                  key: "name_id",
                  label: "Name",
                  type: "TEXT",
                  position: 0,
                  row: 1,
                  column: 1,
                  width: 12,
                  required: true,
                  configuration: {
                    name: "name",
                    description: "",
                    placeholder: "",
                    defaultValue: "",
                    disabled: false,
                    hidden: false,
                    options: [],
                  },
                  validation: {},
                },
              ],
            },
          ],
        }),
      },
    };
    const result = await resolvePublishedForm(db as never, {
      shopId: "shop-a",
      publicIdOrShortcode: " [form:public-a] ",
    });
    expect(result?.publicId).toBe("public-a");
    expect(db.form.findFirst).toBeDefined();
  });

  it.each(["[form:missing]", "[form:bad space]", "not-a-public-id"])(
    "fails safely for invalid or unknown public ID: %s",
    async (publicIdOrShortcode) => {
      const db = {
        form: { findFirst: async () => null },
      };
      await expect(
        resolvePublishedForm(db as never, {
          shopId: "shop-a",
          publicIdOrShortcode,
        }),
      ).resolves.toBeNull();
    },
  );

  it("does not resolve a draft or disabled form", async () => {
    const db = {
      form: {
        findFirst: async ({ where }: { where: { status: string } }) =>
          where.status === "PUBLISHED" ? null : baseForm,
      },
    };
    const result = await resolvePublishedForm(db as never, {
      shopId: "shop-a",
      publicIdOrShortcode: "public-a",
    });
    expect(result).toBeNull();
  });

  it("keeps submitted text as data rather than executable markup", () => {
    const result = validateSubmission(baseForm, {
      name: "<script>alert('xss')</script>",
    });
    expect(result).toEqual({
      ok: true,
      values: { name: "<script>alert('xss')</script>" },
    });
  });
});
