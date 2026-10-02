import { describe, expect, it } from "vitest";
import type {
  BuilderField,
  FormBuilderConfig,
} from "../../domain/forms/builder-schema";
import {
  moveBuilderField,
  normalizeBuilderConfigForColumns,
  nextLibraryFieldPlacement,
  sortBuilderFields,
} from "./builder-dnd";

const field = (
  id: string,
  row: number,
  column: number,
  width: BuilderField["width"] = 6,
): BuilderField => ({
  id,
  type: "text",
  label: id,
  name: id,
  description: "",
  placeholder: "",
  defaultValue: "",
  required: false,
  disabled: false,
  hidden: false,
  row,
  column,
  width,
  options: [],
  validation: {},
});

const config = (...fields: BuilderField[]): FormBuilderConfig => ({
  columns: 2,
  settings: {
    description: "",
    submitLabel: "Submit",
    successMessage: "Success",
    errorMessage: "Error",
  },
  style: {
    fontFamily: "Inter",
    fontSize: "base",
    labelSize: "sm",
    textColor: "#000000",
    background: "#ffffff",
    inputBackground: "#ffffff",
    borderColor: "#000000",
    borderWidth: 1,
    borderRadius: "md",
    buttonTextColor: "#ffffff",
    buttonBackground: "#000000",
    buttonRadius: "md",
    spacing: "comfortable",
    fieldSpacing: "comfortable",
    formWidth: "md",
  },
  fields,
});

describe("builder drag placement", () => {
  it("sorts by row and column without changing stable field identity", () => {
    expect(sortBuilderFields([field("b", 2, 1), field("a", 1, 2)])).toEqual([
      expect.objectContaining({ id: "a" }),
      expect.objectContaining({ id: "b" }),
    ]);
  });

  it("moves a field before another field and preserves its width", () => {
    const result = moveBuilderField(
      config(field("text", 1, 1, 6), field("email", 1, 2, 4)),
      "email",
      "text",
      "before",
    );
    expect(result?.fields.map((item) => item.id)).toEqual(["email", "text"]);
    expect(result?.fields[0]).toEqual(
      expect.objectContaining({
        id: "email",
        row: 1,
        column: 1,
        width: 6,
        widthMode: "auto",
      }),
    );
  });

  it("moves a field into an empty row and column target", () => {
    const result = moveBuilderField(
      config(field("text", 1, 1), field("email", 1, 2)),
      "text",
      "canvas-cell:2:2",
      "before",
    );
    expect(result?.fields.find((item) => item.id === "text")).toEqual(
      expect.objectContaining({ row: 2, column: 2, width: 6 }),
    );
  });

  it("places a library field on an empty canvas cell or after the last row", () => {
    const current = config(field("text", 1, 1));
    expect(nextLibraryFieldPlacement(current, "canvas-cell:2:2")).toEqual({
      row: 2,
      column: 2,
    });
    expect(nextLibraryFieldPlacement(current, null)).toEqual({
      row: 2,
      column: 1,
    });
  });

  it.each([
    [1, 12],
    [2, 6],
    [3, 4],
  ] as const)("normalizes moved fields for %s columns", (columns, width) => {
    const result = moveBuilderField(
      { ...config(field("text", 1, 1, 12)), columns },
      "text",
      `canvas-cell:1:${columns}`,
      "before",
    );
    expect(result?.fields[0]).toEqual(
      expect.objectContaining({
        row: 1,
        column: columns,
        width,
        widthMode: "auto",
      }),
    );
  });

  it("reflows collisions without overlapping fields", () => {
    const result = moveBuilderField(
      {
        ...config(
          field("first", 1, 1, 4),
          field("second", 1, 2, 4),
          field("third", 1, 3, 4),
        ),
        columns: 3,
      },
      "third",
      "canvas-cell:1:1",
      "before",
    );
    expect(
      result?.fields.map(({ id, row, column, width }) => ({
        id,
        row,
        column,
        width,
      })),
    ).toEqual([
      { id: "third", row: 1, column: 1, width: 4 },
      { id: "first", row: 1, column: 2, width: 4 },
      { id: "second", row: 1, column: 3, width: 4 },
    ]);
  });

  it("normalizes auto fields when the column count changes", () => {
    const result = normalizeBuilderConfigForColumns(
      { ...config(field("text", 1, 1, 12)), columns: 1 },
      3,
    );
    expect(result.fields[0]).toEqual(
      expect.objectContaining({
        column: 1,
        width: 4,
        widthMode: "auto",
      }),
    );
  });
});
