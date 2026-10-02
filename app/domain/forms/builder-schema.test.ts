import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORM_SETTINGS,
  DEFAULT_STYLE_TOKENS,
  parseBuilderConfig,
  type FormBuilderConfig,
  validateBuilderConfig,
} from "./builder-schema";

function validConfig(columns: 1 | 2 | 3): FormBuilderConfig {
  return {
    columns,
    settings: DEFAULT_FORM_SETTINGS,
    style: DEFAULT_STYLE_TOKENS,
    fields: [
      {
        id: "field_name",
        type: "text",
        label: "Name",
        name: "name",
        description: "",
        placeholder: "Your name",
        defaultValue: "",
        required: true,
        disabled: false,
        hidden: false,
        row: 1,
        column: 1,
        width: 12,
        options: [],
        validation: {},
      },
    ],
  };
}

describe("form builder schema", () => {
  it.each([1, 2, 3] as const)("accepts a %s-column layout", (columns) => {
    expect(
      validateBuilderConfig(validConfig(columns), { forPublish: true }),
    ).toEqual([]);
  });

  it("allows an empty draft but rejects publishing it", () => {
    const config = { ...validConfig(1), fields: [] };
    expect(validateBuilderConfig(config)).toEqual([]);
    expect(validateBuilderConfig(config, { forPublish: true })).toEqual([
      { path: "fields", message: "Add at least one field before publishing." },
    ]);
  });

  it("rejects invalid layout, field names, and patterns", () => {
    const config = {
      ...validConfig(1),
      columns: 4 as 1,
      fields: [
        {
          ...validConfig(1).fields[0],
          type: "email" as const,
          name: "Invalid Name",
          validation: { pattern: "[" },
        },
      ],
    };

    const issues = validateBuilderConfig(config, { forPublish: true });
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        "columns",
        "fields.0.name",
        "fields.0.validation.pattern",
      ]),
    );
  });

  it("requires options for choice fields only when publishing", () => {
    const config = {
      ...validConfig(1),
      fields: [
        { ...validConfig(1).fields[0], type: "select" as const, options: [] },
      ],
    };

    expect(validateBuilderConfig(config)).toEqual([]);
    expect(validateBuilderConfig(config, { forPublish: true })).toEqual([
      { path: "fields.0.options", message: "Add at least one option." },
    ]);
  });

  it("rejects malformed runtime payloads instead of throwing", () => {
    expect(parseBuilderConfig(null).ok).toBe(false);
    expect(parseBuilderConfig([]).ok).toBe(false);
    expect(
      parseBuilderConfig({ columns: 1, settings: {}, style: {}, fields: [] })
        .ok,
    ).toBe(false);
  });

  it("rejects duplicate field IDs and unsafe option values", () => {
    const config = validConfig(1);
    const payload = {
      ...config,
      fields: [
        { ...config.fields[0], options: [{ label: "A", value: "bad value" }] },
        { ...config.fields[0], label: "Second" },
      ],
    };
    const result = parseBuilderConfig(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining(["fields.0.options.0.value", "fields.1.id"]),
      );
    }
  });
});
