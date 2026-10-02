import {
  FIELD_REGISTRY,
  type BuilderFieldType,
  type FieldOption,
} from "./field-registry";

export const ALLOWED_WIDTHS = [3, 4, 6, 8, 9, 12] as const;
export type FieldWidth = (typeof ALLOWED_WIDTHS)[number];
export type FieldWidthMode = "auto" | "manual";

export type FieldValidation = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  requiredMessage?: string;
  invalidMessage?: string;
};

export type BuilderField = {
  id: string;
  type: BuilderFieldType;
  label: string;
  name: string;
  description: string;
  placeholder: string;
  defaultValue: string;
  required: boolean;
  disabled: boolean;
  hidden: boolean;
  row: number;
  column: number;
  width: FieldWidth;
  widthMode?: FieldWidthMode;
  options: FieldOption[];
  validation: FieldValidation;
};

export type FormSettings = {
  description: string;
  submitLabel: string;
  successMessage: string;
  errorMessage: string;
};

export type FormStyleTokens = {
  fontFamily: string;
  fontSize: "sm" | "base" | "lg";
  labelSize: "sm" | "base" | "lg";
  textColor: string;
  background: string;
  inputBackground: string;
  borderColor: string;
  borderWidth: 0 | 1 | 2;
  borderRadius: "none" | "sm" | "md" | "lg";
  buttonTextColor: string;
  buttonBackground: string;
  buttonRadius: "none" | "sm" | "md" | "lg";
  spacing: "compact" | "comfortable" | "spacious";
  fieldSpacing: "compact" | "comfortable" | "spacious";
  formWidth: "sm" | "md" | "lg" | "full";
};

export type FormBuilderConfig = {
  columns: 1 | 2 | 3;
  settings: FormSettings;
  style: FormStyleTokens;
  fields: BuilderField[];
};

export function autoFieldWidth(
  columns: FormBuilderConfig["columns"],
): FieldWidth {
  return columns === 1 ? 12 : columns === 2 ? 6 : 4;
}

export function effectiveFieldWidth(
  field: Pick<BuilderField, "width" | "widthMode">,
  columns: FormBuilderConfig["columns"],
): FieldWidth {
  return field.widthMode === "manual" ? field.width : autoFieldWidth(columns);
}

export function fieldGridSpan(
  field: Pick<BuilderField, "width" | "widthMode">,
  columns: FormBuilderConfig["columns"],
) {
  return Math.max(
    1,
    Math.min(
      columns,
      Math.ceil((effectiveFieldWidth(field, columns) / 12) * columns),
    ),
  );
}

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  description: "",
  submitLabel: "Submit",
  successMessage: "Thanks for getting in touch.",
  errorMessage: "Something went wrong. Please try again.",
};

export const DEFAULT_STYLE_TOKENS: FormStyleTokens = {
  fontFamily: "Inter",
  fontSize: "base",
  labelSize: "sm",
  textColor: "#0f172a",
  background: "#ffffff",
  inputBackground: "#ffffff",
  borderColor: "#cbd5e1",
  borderWidth: 1,
  borderRadius: "md",
  buttonTextColor: "#ffffff",
  buttonBackground: "#0f172a",
  buttonRadius: "md",
  spacing: "comfortable",
  fieldSpacing: "comfortable",
  formWidth: "md",
};

export type ValidationIssue = {
  path: string;
  message: string;
};

const SAFE_FIELD_NAME = /^[a-z][a-z0-9_]{1,63}$/;
const SAFE_FIELD_ID = /^[A-Za-z0-9_-]{1,100}$/;
const SAFE_OPTION_VALUE = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_COLOR = /^#[0-9A-Fa-f]{6}$/;
const SAFE_FONT_FAMILY = /^[A-Za-z0-9 ,"'_-]{1,80}$/;
const FIELD_TYPES = new Set(Object.keys(FIELD_REGISTRY));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readString(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  options: { required?: boolean; maxLength?: number } = {},
) {
  if (typeof value !== "string") {
    if (options.required || value !== undefined) {
      issues.push({ path, message: "Enter a valid text value." });
    }
    return "";
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    issues.push({
      path,
      message: `Use no more than ${options.maxLength} characters.`,
    });
  }
  if (options.required && !value.trim()) {
    issues.push({ path, message: "This value is required." });
  }
  return value;
}

function readInteger(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  options: { required?: boolean; min?: number; max?: number } = {},
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    !Number.isFinite(value)
  ) {
    if (options.required || value !== undefined) {
      issues.push({ path, message: "Enter a valid whole number." });
    }
    return 0;
  }
  if (options.min !== undefined && value < options.min) {
    issues.push({ path, message: `Use a value of at least ${options.min}.` });
  }
  if (options.max !== undefined && value > options.max) {
    issues.push({
      path,
      message: `Use a value no greater than ${options.max}.`,
    });
  }
  return value;
}

function readNumber(value: unknown, path: string, issues: ValidationIssue[]) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ path, message: "Enter a finite number." });
    return undefined;
  }
  return value;
}

function readBoolean(value: unknown, path: string, issues: ValidationIssue[]) {
  if (typeof value !== "boolean") {
    issues.push({ path, message: "Enter a valid boolean value." });
    return false;
  }
  return value;
}

export function parseBuilderConfig(
  input: unknown,
):
  | { ok: true; config: FormBuilderConfig }
  | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        { path: "config", message: "Form configuration must be an object." },
      ],
    };
  }

  const columns = readInteger(input.columns, "columns", issues, {
    required: true,
    min: 1,
    max: 3,
  }) as 1 | 2 | 3;
  const rawSettings = input.settings;
  const rawStyle = input.style;
  if (!isRecord(rawSettings)) {
    issues.push({
      path: "settings",
      message: "Form settings must be an object.",
    });
  }
  if (!isRecord(rawStyle)) {
    issues.push({ path: "style", message: "Form style must be an object." });
  }
  const settingsRecord = isRecord(rawSettings) ? rawSettings : {};
  const styleRecord = isRecord(rawStyle) ? rawStyle : {};

  const settings = {
    description: readString(
      settingsRecord.description,
      "settings.description",
      issues,
      { maxLength: 2000 },
    ),
    submitLabel: readString(
      settingsRecord.submitLabel,
      "settings.submitLabel",
      issues,
      { required: true, maxLength: 120 },
    ),
    successMessage: readString(
      settingsRecord.successMessage,
      "settings.successMessage",
      issues,
      { maxLength: 2000 },
    ),
    errorMessage: readString(
      settingsRecord.errorMessage,
      "settings.errorMessage",
      issues,
      { maxLength: 2000 },
    ),
  };

  const style = {
    fontFamily: readString(styleRecord.fontFamily, "style.fontFamily", issues, {
      required: true,
      maxLength: 80,
    }),
    fontSize: styleRecord.fontSize,
    labelSize: styleRecord.labelSize,
    textColor: readString(styleRecord.textColor, "style.textColor", issues, {
      required: true,
      maxLength: 7,
    }),
    background: readString(styleRecord.background, "style.background", issues, {
      required: true,
      maxLength: 7,
    }),
    inputBackground: readString(
      styleRecord.inputBackground,
      "style.inputBackground",
      issues,
      { required: true, maxLength: 7 },
    ),
    borderColor: readString(
      styleRecord.borderColor,
      "style.borderColor",
      issues,
      { required: true, maxLength: 7 },
    ),
    borderWidth: readInteger(
      styleRecord.borderWidth,
      "style.borderWidth",
      issues,
      { required: true, min: 0, max: 2 },
    ) as 0 | 1 | 2,
    borderRadius: styleRecord.borderRadius,
    buttonTextColor: readString(
      styleRecord.buttonTextColor,
      "style.buttonTextColor",
      issues,
      { required: true, maxLength: 7 },
    ),
    buttonBackground: readString(
      styleRecord.buttonBackground,
      "style.buttonBackground",
      issues,
      { required: true, maxLength: 7 },
    ),
    buttonRadius: styleRecord.buttonRadius,
    spacing: styleRecord.spacing,
    fieldSpacing: styleRecord.fieldSpacing,
    formWidth: styleRecord.formWidth,
  };

  const enumValues: Array<[string, unknown, string[]]> = [
    ["style.fontSize", style.fontSize, ["sm", "base", "lg"]],
    ["style.labelSize", style.labelSize, ["sm", "base", "lg"]],
    ["style.borderRadius", style.borderRadius, ["none", "sm", "md", "lg"]],
    ["style.buttonRadius", style.buttonRadius, ["none", "sm", "md", "lg"]],
    ["style.spacing", style.spacing, ["compact", "comfortable", "spacious"]],
    [
      "style.fieldSpacing",
      style.fieldSpacing,
      ["compact", "comfortable", "spacious"],
    ],
    ["style.formWidth", style.formWidth, ["sm", "md", "lg", "full"]],
  ];
  for (const [path, value, allowed] of enumValues) {
    if (typeof value !== "string" || !allowed.includes(value)) {
      issues.push({ path, message: "Choose a supported style value." });
    }
  }
  for (const [path, value] of [
    ["style.textColor", style.textColor],
    ["style.background", style.background],
    ["style.inputBackground", style.inputBackground],
    ["style.borderColor", style.borderColor],
    ["style.buttonTextColor", style.buttonTextColor],
    ["style.buttonBackground", style.buttonBackground],
  ] as const) {
    if (!SAFE_COLOR.test(value)) {
      issues.push({ path, message: "Use a six-digit hexadecimal color." });
    }
  }
  if (!SAFE_FONT_FAMILY.test(style.fontFamily)) {
    issues.push({
      path: "style.fontFamily",
      message: "Use a safe font family name.",
    });
  }

  const rawFields = input.fields;
  if (!Array.isArray(rawFields) || rawFields.length > 100) {
    issues.push({
      path: "fields",
      message: "Fields must be an array of no more than 100 items.",
    });
  }
  const fields: BuilderField[] = [];
  const ids = new Set<string>();
  for (const [index, rawField] of (Array.isArray(rawFields)
    ? rawFields
    : []
  ).entries()) {
    const path = `fields.${index}`;
    if (!isRecord(rawField)) {
      issues.push({ path, message: "Each field must be an object." });
      continue;
    }
    const type = rawField.type;
    if (typeof type !== "string" || !FIELD_TYPES.has(type)) {
      issues.push({
        path: `${path}.type`,
        message: "Choose a supported field type.",
      });
    }
    const fieldType = (
      FIELD_TYPES.has(String(type)) ? type : "text"
    ) as BuilderFieldType;
    const id = readString(rawField.id, `${path}.id`, issues, {
      required: true,
      maxLength: 100,
    });
    if (!SAFE_FIELD_ID.test(id)) {
      issues.push({
        path: `${path}.id`,
        message: "Field ID contains unsupported characters.",
      });
    }
    if (ids.has(id)) {
      issues.push({ path: `${path}.id`, message: "Field IDs must be unique." });
    }
    ids.add(id);
    const definition = FIELD_REGISTRY[fieldType];
    const optionsValue = rawField.options;
    if (!Array.isArray(optionsValue) || optionsValue.length > 100) {
      issues.push({
        path: `${path}.options`,
        message: "Options must be an array of no more than 100 items.",
      });
    }
    const options: FieldOption[] = [];
    for (const [optionIndex, rawOption] of (Array.isArray(optionsValue)
      ? optionsValue
      : []
    ).entries()) {
      if (!isRecord(rawOption)) {
        issues.push({
          path: `${path}.options.${optionIndex}`,
          message: "Each option must be an object.",
        });
        continue;
      }
      const label = readString(
        rawOption.label,
        `${path}.options.${optionIndex}.label`,
        issues,
        { required: true, maxLength: 200 },
      );
      const value = readString(
        rawOption.value,
        `${path}.options.${optionIndex}.value`,
        issues,
        { required: true, maxLength: 64 },
      );
      if (!SAFE_OPTION_VALUE.test(value)) {
        issues.push({
          path: `${path}.options.${optionIndex}.value`,
          message: "Option values contain unsupported characters.",
        });
      }
      options.push({ label, value });
    }
    if (!definition.supportsOptions && options.length) {
      issues.push({
        path: `${path}.options`,
        message: "This field type does not support options.",
      });
    }

    const rawValidation = rawField.validation;
    if (rawValidation !== undefined && !isRecord(rawValidation)) {
      issues.push({
        path: `${path}.validation`,
        message: "Validation must be an object.",
      });
    }
    const validationRecord = isRecord(rawValidation) ? rawValidation : {};
    const validation: FieldValidation = {
      minLength:
        validationRecord.minLength === undefined
          ? undefined
          : readInteger(
              validationRecord.minLength,
              `${path}.validation.minLength`,
              issues,
              { min: 0, max: 10000 },
            ),
      maxLength:
        validationRecord.maxLength === undefined
          ? undefined
          : readInteger(
              validationRecord.maxLength,
              `${path}.validation.maxLength`,
              issues,
              { min: 0, max: 10000 },
            ),
      min:
        validationRecord.min === undefined
          ? undefined
          : readNumber(validationRecord.min, `${path}.validation.min`, issues),
      max:
        validationRecord.max === undefined
          ? undefined
          : readNumber(validationRecord.max, `${path}.validation.max`, issues),
      pattern:
        validationRecord.pattern === undefined
          ? undefined
          : readString(
              validationRecord.pattern,
              `${path}.validation.pattern`,
              issues,
              { maxLength: 500 },
            ),
      requiredMessage:
        validationRecord.requiredMessage === undefined
          ? undefined
          : readString(
              validationRecord.requiredMessage,
              `${path}.validation.requiredMessage`,
              issues,
              { maxLength: 500 },
            ),
      invalidMessage:
        validationRecord.invalidMessage === undefined
          ? undefined
          : readString(
              validationRecord.invalidMessage,
              `${path}.validation.invalidMessage`,
              issues,
              { maxLength: 500 },
            ),
    };
    if (
      validation.min !== undefined &&
      validation.max !== undefined &&
      validation.max < validation.min
    ) {
      issues.push({
        path: `${path}.validation.max`,
        message: "Maximum must be greater than minimum.",
      });
    }

    fields.push({
      id,
      type: fieldType,
      label: readString(rawField.label, `${path}.label`, issues, {
        required: true,
        maxLength: 200,
      }),
      name: readString(rawField.name, `${path}.name`, issues, {
        required: true,
        maxLength: 64,
      }),
      description: readString(
        rawField.description,
        `${path}.description`,
        issues,
        { maxLength: 1000 },
      ),
      placeholder: readString(
        rawField.placeholder,
        `${path}.placeholder`,
        issues,
        { maxLength: 500 },
      ),
      defaultValue: readString(
        rawField.defaultValue,
        `${path}.defaultValue`,
        issues,
        { maxLength: 2000 },
      ),
      required: readBoolean(rawField.required, `${path}.required`, issues),
      disabled: readBoolean(rawField.disabled, `${path}.disabled`, issues),
      hidden: readBoolean(rawField.hidden, `${path}.hidden`, issues),
      row: readInteger(rawField.row, `${path}.row`, issues, {
        required: true,
        min: 1,
        max: 1000,
      }),
      column: readInteger(rawField.column, `${path}.column`, issues, {
        required: true,
        min: 1,
        max: 3,
      }),
      width: readInteger(rawField.width, `${path}.width`, issues, {
        required: true,
        min: 1,
        max: 12,
      }) as FieldWidth,
      widthMode:
        rawField.widthMode === undefined
          ? "auto"
          : rawField.widthMode === "manual"
            ? "manual"
            : rawField.widthMode === "auto"
              ? "auto"
              : (() => {
                  issues.push({
                    path: `${path}.widthMode`,
                    message: "Choose automatic or manual width.",
                  });
                  return "auto" as const;
                })(),
      options,
      validation,
    });
  }

  if (issues.length) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    config: { columns, settings, style: style as FormStyleTokens, fields },
  };
}

export function validateBuilderConfig(
  config: FormBuilderConfig,
  options: { forPublish?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const names = new Set<string>();
  const forPublish = options.forPublish ?? false;

  if (![1, 2, 3].includes(config.columns)) {
    issues.push({
      path: "columns",
      message: "Choose one, two, or three columns.",
    });
  }

  if (!config.settings.submitLabel.trim()) {
    issues.push({
      path: "settings.submitLabel",
      message: "Submit button text is required.",
    });
  }

  if (forPublish && !config.fields.length) {
    issues.push({
      path: "fields",
      message: "Add at least one field before publishing.",
    });
  }

  for (const [index, field] of config.fields.entries()) {
    const path = `fields.${index}`;
    if (!SAFE_FIELD_NAME.test(field.name)) {
      issues.push({
        path: `${path}.name`,
        message: "Use 2–64 lowercase letters, numbers, and underscores.",
      });
    }

    if (names.has(field.name)) {
      issues.push({
        path: `${path}.name`,
        message: "Field names must be unique.",
      });
    }
    names.add(field.name);

    if (!field.label.trim()) {
      issues.push({
        path: `${path}.label`,
        message: "A field label is required.",
      });
    }

    if (!ALLOWED_WIDTHS.includes(field.width)) {
      issues.push({
        path: `${path}.width`,
        message: "Choose a supported field width.",
      });
    }

    if (field.column < 1 || field.column > config.columns) {
      issues.push({
        path: `${path}.column`,
        message: "Field column is outside the form layout.",
      });
    }

    if (field.row < 1) {
      issues.push({
        path: `${path}.row`,
        message: "Field row must be positive.",
      });
    }

    if (
      field.validation.minLength !== undefined &&
      field.validation.minLength < 0
    ) {
      issues.push({
        path: `${path}.validation.minLength`,
        message: "Minimum length cannot be negative.",
      });
    }

    if (
      field.validation.maxLength !== undefined &&
      field.validation.minLength !== undefined &&
      field.validation.maxLength < field.validation.minLength
    ) {
      issues.push({
        path: `${path}.validation.maxLength`,
        message: "Maximum length must be greater than minimum length.",
      });
    }

    if (
      forPublish &&
      ["select", "multiselect", "radio", "checkbox"].includes(field.type) &&
      field.options.length === 0
    ) {
      issues.push({
        path: `${path}.options`,
        message: "Add at least one option.",
      });
    }

    if (field.validation.pattern) {
      try {
        new RegExp(field.validation.pattern);
      } catch {
        issues.push({
          path: `${path}.validation.pattern`,
          message: "Enter a valid regular expression.",
        });
      }
    }
  }

  return issues;
}
