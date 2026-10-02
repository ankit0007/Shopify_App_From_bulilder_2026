import type { BuilderFieldType, FieldOption } from "./field-registry";

export const ALLOWED_WIDTHS = [3, 4, 6, 8, 9, 12] as const;
export type FieldWidth = (typeof ALLOWED_WIDTHS)[number];

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
