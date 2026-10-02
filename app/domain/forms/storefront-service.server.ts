import { Prisma, type PrismaClient } from "@prisma/client";
import {
  parseBuilderConfig,
  validateBuilderConfig,
  type BuilderField,
  type FormBuilderConfig,
} from "./builder-schema";
import { parseFormShortcode } from "./shortcode";

const MAX_SUBMISSION_BYTES = 64 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PublicField = Omit<BuilderField, "id">;

export type PublicForm = {
  publicId: string;
  settings: FormBuilderConfig["settings"];
  style: FormBuilderConfig["style"];
  columns: FormBuilderConfig["columns"];
  fields: PublicField[];
};

type PublishedForm = Omit<PublicForm, "fields"> & {
  shopId: string;
  formId: string;
  versionId: string;
  fields: BuilderField[];
};

export type SubmissionValidationIssue = {
  field?: string;
  message: string;
};

export function submissionByteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeFieldValue(field: BuilderField, value: unknown) {
  if (field.type === "multiselect" || field.type === "checkbox") {
    return Array.isArray(value) ? value : null;
  }
  return value;
}

function hasValue(value: unknown) {
  return !(
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function optionValues(field: BuilderField) {
  return new Set(field.options.map((option) => option.value));
}

function validateFieldValue(
  field: BuilderField,
  value: unknown,
  issues: SubmissionValidationIssue[],
) {
  if (field.disabled) return;
  if (
    (field.type === "multiselect" || field.type === "checkbox") &&
    value !== undefined &&
    value !== null &&
    value !== "" &&
    !Array.isArray(value)
  ) {
    issues.push({ field: field.name, message: "Choose valid options." });
    return;
  }
  if (value === null) {
    issues.push({ field: field.name, message: "Enter a valid value." });
    return;
  }
  const normalized = normalizeFieldValue(field, value);
  if (!hasValue(normalized)) {
    if (field.required) {
      issues.push({
        field: field.name,
        message: field.validation.requiredMessage || "This field is required.",
      });
    }
    return;
  }

  if (field.type === "multiselect" || field.type === "checkbox") {
    if (
      !Array.isArray(normalized) ||
      normalized.some((item) => typeof item !== "string")
    ) {
      issues.push({ field: field.name, message: "Choose valid options." });
      return;
    }
    const allowed = optionValues(field);
    if (
      normalized.length > 100 ||
      new Set(normalized).size !== normalized.length ||
      normalized.some((item) => !allowed.has(item))
    ) {
      issues.push({ field: field.name, message: "Choose valid options." });
    }
    return;
  }

  if (field.type === "select" || field.type === "radio") {
    if (
      typeof normalized !== "string" ||
      !optionValues(field).has(normalized)
    ) {
      issues.push({ field: field.name, message: "Choose a valid option." });
    }
    return;
  }

  if (field.type === "yes_no") {
    if (
      normalized !== true &&
      normalized !== false &&
      normalized !== "yes" &&
      normalized !== "no"
    ) {
      issues.push({ field: field.name, message: "Choose yes or no." });
    }
    return;
  }

  if (field.type === "password") {
    issues.push({
      field: field.name,
      message: "Password fields cannot be stored by this submission system.",
    });
    return;
  }

  if (field.type === "number") {
    const numberValue =
      typeof normalized === "number" ? normalized : Number(normalized);
    if (!Number.isFinite(numberValue)) {
      issues.push({
        field: field.name,
        message: field.validation.invalidMessage || "Enter a valid number.",
      });
      return;
    }
    if (
      field.validation.min !== undefined &&
      numberValue < field.validation.min
    ) {
      issues.push({ field: field.name, message: "Value is too small." });
    }
    if (
      field.validation.max !== undefined &&
      numberValue > field.validation.max
    ) {
      issues.push({ field: field.name, message: "Value is too large." });
    }
    return;
  }

  if (typeof normalized !== "string") {
    issues.push({ field: field.name, message: "Enter a valid value." });
    return;
  }

  if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    issues.push({ field: field.name, message: "Enter a valid date." });
  }
  if (field.type === "time" && !/^\d{2}:\d{2}(?::\d{2})?$/.test(normalized)) {
    issues.push({ field: field.name, message: "Enter a valid time." });
  }
  if (
    field.type === "datetime" &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)
  ) {
    issues.push({ field: field.name, message: "Enter a valid date and time." });
  }

  if (
    field.validation.minLength !== undefined &&
    normalized.length < field.validation.minLength
  ) {
    issues.push({ field: field.name, message: "Value is too short." });
  }
  if (
    field.validation.maxLength !== undefined &&
    normalized.length > field.validation.maxLength
  ) {
    issues.push({ field: field.name, message: "Value is too long." });
  }
  if (field.type === "email" && !EMAIL_PATTERN.test(normalized)) {
    issues.push({
      field: field.name,
      message:
        field.validation.invalidMessage || "Enter a valid email address.",
    });
  }
  if (field.type === "url") {
    try {
      const url = new URL(normalized);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      issues.push({
        field: field.name,
        message: field.validation.invalidMessage || "Enter a valid URL.",
      });
    }
  }
  if (field.validation.pattern) {
    try {
      if (!new RegExp(field.validation.pattern).test(normalized)) {
        issues.push({
          field: field.name,
          message: field.validation.invalidMessage || "Enter a valid value.",
        });
      }
    } catch {
      issues.push({
        field: field.name,
        message: "Field validation is invalid.",
      });
    }
  }
}

function versionToConfig(version: {
  settings: Prisma.JsonValue;
  layout: { columns: number };
  style: { tokens: Prisma.JsonValue };
  fields: Array<{
    id: string;
    key: string;
    label: string;
    type: string;
    position: number;
    row: number;
    column: number;
    width: number;
    required: boolean;
    configuration: Prisma.JsonValue;
    validation: Prisma.JsonValue | null;
  }>;
}): FormBuilderConfig | null {
  const fields = version.fields.map((field) => {
    const configuration = asRecord(field.configuration) ?? {};
    return {
      id: field.key || field.id,
      type: field.type.toLowerCase() as BuilderField["type"],
      label: field.label,
      name: String(configuration.name ?? field.key),
      description: String(configuration.description ?? ""),
      placeholder: String(configuration.placeholder ?? ""),
      defaultValue: String(configuration.defaultValue ?? ""),
      required: field.required,
      disabled: Boolean(configuration.disabled),
      hidden: Boolean(configuration.hidden),
      row: field.row,
      column: field.column,
      width: field.width as BuilderField["width"],
      widthMode: configuration.widthMode === "manual" ? "manual" : "auto",
      options: Array.isArray(configuration.options)
        ? configuration.options
            .map((option) => {
              const record = asRecord(option);
              return record
                ? {
                    label: String(record.label ?? ""),
                    value: String(record.value ?? ""),
                  }
                : null;
            })
            .filter(
              (option): option is { label: string; value: string } =>
                option !== null,
            )
        : [],
      validation: (asRecord(field.validation) ??
        {}) as BuilderField["validation"],
    };
  });
  const parsed = parseBuilderConfig({
    columns: version.layout.columns,
    settings: version.settings,
    style: version.style.tokens,
    fields,
  });
  if (!parsed.ok || validateBuilderConfig(parsed.config).length) return null;
  return parsed.config;
}

export async function resolvePublishedForm(
  db: PrismaClient,
  input: { shopId: string; publicIdOrShortcode: string },
): Promise<PublishedForm | null> {
  const value = input.publicIdOrShortcode.trim();
  const publicId = parseFormShortcode(value) ?? value;
  if (!/^[A-Za-z0-9_-]+$/.test(publicId)) return null;

  const form = await db.form.findFirst({
    where: { shopId: input.shopId, publicId, status: "PUBLISHED" },
    include: {
      versions: {
        where: { isPublished: true },
        orderBy: { version: "desc" },
        take: 1,
        include: {
          layout: true,
          style: true,
          fields: { orderBy: { position: "asc" } },
        },
      },
    },
  });
  const version = form?.versions[0];
  const config = version ? versionToConfig(version) : null;
  if (
    !form ||
    !version ||
    !config ||
    form.publishedVersion !== version.version
  ) {
    return null;
  }
  return {
    shopId: form.shopId,
    formId: form.id,
    versionId: version.id,
    publicId: form.publicId,
    settings: config.settings,
    style: config.style,
    columns: config.columns,
    fields: config.fields,
  };
}

export function toPublicForm(form: PublishedForm): PublicForm {
  return {
    publicId: form.publicId,
    settings: form.settings,
    style: form.style,
    columns: form.columns,
    fields: form.fields.map((field) => ({
      type: field.type,
      label: field.label,
      name: field.name,
      description: field.description,
      placeholder: field.placeholder,
      defaultValue: field.defaultValue,
      required: field.required,
      disabled: field.disabled,
      hidden: field.hidden,
      row: field.row,
      column: field.column,
      width: field.width,
      options: field.options,
      validation: field.validation,
    })),
  };
}

export function validateSubmission(
  form: PublishedForm,
  values: unknown,
):
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; issues: SubmissionValidationIssue[] } {
  if (submissionByteLength(values) > MAX_SUBMISSION_BYTES) {
    return { ok: false, issues: [{ message: "Submission is too large." }] };
  }
  const record = asRecord(values);
  if (!record)
    return {
      ok: false,
      issues: [{ message: "Submission must be an object." }],
    };

  const fields = new Map(form.fields.map((field) => [field.name, field]));
  const sanitizedValues = { ...record };
  const issues: SubmissionValidationIssue[] = [];
  for (const key of Object.keys(record)) {
    if (!fields.has(key))
      issues.push({ field: key, message: "Unknown field." });
  }
  for (const field of form.fields) {
    if (field.disabled) {
      delete sanitizedValues[field.name];
    } else if (field.hidden) {
      sanitizedValues[field.name] = field.defaultValue;
    }
    validateFieldValue(field, sanitizedValues[field.name], issues);
  }
  return issues.length
    ? { ok: false, issues }
    : { ok: true, values: sanitizedValues };
}

export async function createSubmission(
  db: PrismaClient,
  input: {
    shopId: string;
    publicIdOrShortcode: string;
    values: unknown;
    source?: string;
  },
) {
  const form = await resolvePublishedForm(db, {
    shopId: input.shopId,
    publicIdOrShortcode: input.publicIdOrShortcode,
  });
  if (!form) return { ok: false as const, error: "Form not found." };
  const validated = validateSubmission(form, input.values);
  if (!validated.ok) return validated;
  const submission = await db.submission.create({
    data: {
      shopId: form.shopId,
      formId: form.formId,
      formVersionId: form.versionId,
      source: input.source?.slice(0, 100) || "storefront",
      values: {
        create: Object.entries(validated.values).map(([fieldKey, value]) => ({
          fieldKey,
          value: JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue,
        })),
      },
    },
    select: { id: true },
  });
  return {
    ok: true as const,
    submissionId: submission.id,
    message: form.settings.successMessage,
  };
}

export const STOREFRONT_MAX_SUBMISSION_BYTES = MAX_SUBMISSION_BYTES;
