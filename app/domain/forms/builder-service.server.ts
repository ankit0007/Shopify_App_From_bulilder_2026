import { Prisma, type PrismaClient } from "@prisma/client";
import {
  DEFAULT_FORM_SETTINGS,
  DEFAULT_STYLE_TOKENS,
  type BuilderField,
  type FormBuilderConfig,
  parseBuilderConfig,
  validateBuilderConfig,
} from "./builder-schema";
import type { BuilderFieldType } from "./field-registry";
import { createFormShortcode } from "./shortcode";
import { newFormPublicId } from "./ids";

const FIELD_TYPE_TO_DB: Record<BuilderFieldType, string> = {
  text: "TEXT",
  textarea: "TEXTAREA",
  email: "EMAIL",
  phone: "PHONE",
  number: "NUMBER",
  url: "URL",
  password: "PASSWORD",
  date: "DATE",
  time: "TIME",
  datetime: "DATETIME",
  select: "SELECT",
  multiselect: "MULTISELECT",
  radio: "RADIO",
  checkbox: "CHECKBOX",
  yes_no: "YES_NO",
  hidden: "HIDDEN",
};

const DB_TYPE_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TYPE_TO_DB).map(([key, value]) => [value, key]),
) as Record<string, BuilderFieldType>;

const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export type FormLifecycleState =
  | "DRAFT"
  | "PUBLISHED"
  | "PUBLISHED_WITH_DRAFT"
  | "DISABLED"
  | "DISABLED_WITH_DRAFT";

export function getFormLifecycleState(
  form: {
    status: "DRAFT" | "PUBLISHED" | "DISABLED";
    publishedVersion: number | null;
  },
  latestVersion: { version: number; isPublished: boolean } | null,
): FormLifecycleState {
  const hasPendingDraft = Boolean(
    latestVersion &&
    !latestVersion.isPublished &&
    form.publishedVersion !== null &&
    latestVersion.version > form.publishedVersion,
  );

  if (form.status === "DRAFT") return "DRAFT";
  if (form.status === "DISABLED") {
    return hasPendingDraft ? "DISABLED_WITH_DRAFT" : "DISABLED";
  }
  return hasPendingDraft ? "PUBLISHED_WITH_DRAFT" : "PUBLISHED";
}

async function serializableTransaction<T>(
  db: PrismaClient,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Transaction could not be completed");
}

function fieldToData(field: BuilderField) {
  return {
    key: field.id,
    label: field.label,
    type: FIELD_TYPE_TO_DB[field.type] as never,
    position: 0,
    row: field.row,
    column: field.column,
    width: field.width,
    required: field.required,
    configuration: asJson({
      name: field.name,
      description: field.description,
      placeholder: field.placeholder,
      defaultValue: field.defaultValue,
      disabled: field.disabled,
      hidden: field.hidden,
      widthMode: field.widthMode ?? "auto",
      options: field.options,
    }),
    validation: asJson(field.validation),
  };
}

function configToVersionData(config: FormBuilderConfig) {
  return {
    settings: asJson(config.settings),
    layout: { create: { columns: config.columns } },
    style: { create: { tokens: asJson(config.style) } },
    fields: {
      create: config.fields.map((field, position) => ({
        ...fieldToData(field),
        position,
      })),
    },
  };
}

function dataToConfig(version: {
  settings: Prisma.JsonValue;
  layout: { columns: number };
  style: { tokens: Prisma.JsonValue };
  fields: Array<{
    id: string;
    key: string;
    label: string;
    type: string;
    row: number;
    column: number;
    width: number;
    required: boolean;
    configuration: Prisma.JsonValue;
    validation: Prisma.JsonValue | null;
  }>;
}): FormBuilderConfig {
  const settings = {
    ...DEFAULT_FORM_SETTINGS,
    ...((version.settings ?? {}) as Partial<FormBuilderConfig["settings"]>),
  };
  const style = {
    ...DEFAULT_STYLE_TOKENS,
    ...((version.style.tokens ?? {}) as Partial<FormBuilderConfig["style"]>),
  };

  return {
    columns: Math.min(3, Math.max(1, version.layout.columns)) as 1 | 2 | 3,
    settings,
    style,
    fields: version.fields.map((field) => {
      const configuration = (field.configuration ?? {}) as Record<
        string,
        unknown
      >;
      return {
        id: field.key || field.id,
        type: DB_TYPE_TO_FIELD[field.type] ?? "text",
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
          ? (configuration.options as BuilderField["options"])
          : [],
        validation: (field.validation ?? {}) as BuilderField["validation"],
      };
    }),
  };
}

export async function loadBuilderForm(
  db: PrismaClient,
  input: { shopId: string; formId: string },
) {
  const form = await db.form.findFirst({
    where: { id: input.formId, shopId: input.shopId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          fields: { orderBy: { position: "asc" } },
          layout: true,
          style: true,
        },
      },
    },
  });

  const version = form?.versions[0];
  if (!form || !version) {
    return null;
  }

  return {
    form,
    version,
    config: dataToConfig(version),
    shortcode: createFormShortcode(form.publicId),
    hasPendingDraft:
      getFormLifecycleState(form, version) === "PUBLISHED_WITH_DRAFT" ||
      getFormLifecycleState(form, version) === "DISABLED_WITH_DRAFT",
    lifecycleState: getFormLifecycleState(form, version),
  };
}

export async function saveBuilderDraft(
  db: PrismaClient,
  input: {
    shopId: string;
    formId: string;
    config: unknown;
    name?: string;
  },
) {
  const parsed = parseBuilderConfig(input.config);
  if (!parsed.ok) {
    return parsed;
  }
  const config = parsed.config;
  const issues = validateBuilderConfig(config);
  if (issues.length) {
    return { ok: false as const, issues };
  }

  return serializableTransaction(db, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id: input.formId, shopId: input.shopId },
      include: {
        versions: {
          where: { version: { equals: undefined } },
          orderBy: { version: "desc" },
          take: 1,
          include: {
            fields: { orderBy: { position: "asc" } },
            layout: true,
            style: true,
          },
        },
      },
    });

    if (!form || !form.versions[0]) {
      return {
        ok: false as const,
        issues: [{ path: "form", message: "Form not found." }],
      };
    }

    const current = form.versions[0];
    const nextVersion = current.isPublished
      ? form.currentVersion + 1
      : form.currentVersion;
    let versionId = current.id;

    if (current.isPublished) {
      const created = await tx.formVersion.create({
        data: {
          form: { connect: { id: form.id } },
          version: nextVersion,
          isPublished: false,
          ...configToVersionData(config),
        },
      });
      versionId = created.id;
      await tx.form.update({
        where: { id: form.id },
        data: {
          currentVersion: nextVersion,
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        },
      });
    } else {
      await tx.formField.deleteMany({ where: { versionId: current.id } });
      await tx.formVersion.update({
        where: { id: current.id },
        data: {
          settings: asJson(config.settings),
          layout: { update: { columns: config.columns } },
          style: { update: { tokens: asJson(config.style) } },
          fields: {
            create: config.fields.map((field, position) => ({
              ...fieldToData(field),
              position,
            })),
          },
        },
      });
      if (input.name?.trim()) {
        await tx.form.update({
          where: { id: form.id },
          data: { name: input.name.trim() },
        });
      }
    }

    return { ok: true as const, versionId, publicId: form.publicId };
  });
}

export async function publishBuilderForm(
  db: PrismaClient,
  input: { shopId: string; formId: string; config?: unknown; name?: string },
) {
  return serializableTransaction(db, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id: input.formId, shopId: input.shopId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: {
            fields: { orderBy: { position: "asc" } },
            layout: true,
            style: true,
          },
        },
      },
    });
    const version = form?.versions[0];
    if (!form || !version) {
      return {
        ok: false as const,
        issues: [{ path: "form", message: "Form not found." }],
      };
    }
    let config: FormBuilderConfig;
    if (input.config === undefined) {
      config = dataToConfig(version);
    } else {
      const parsed = parseBuilderConfig(input.config);
      if (!parsed.ok) return parsed;
      config = parsed.config;
    }
    const issues = validateBuilderConfig(config, { forPublish: true });
    if (issues.length) {
      return { ok: false as const, issues };
    }

    let versionId = version.id;
    let versionNumber = version.version;
    if (input.config !== undefined && version.isPublished) {
      versionNumber = form.currentVersion + 1;
      const created = await tx.formVersion.create({
        data: {
          form: { connect: { id: form.id } },
          version: versionNumber,
          isPublished: false,
          ...configToVersionData(config),
        },
      });
      versionId = created.id;
      await tx.form.update({
        where: { id: form.id },
        data: {
          currentVersion: versionNumber,
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        },
      });
    } else if (input.config !== undefined) {
      await tx.formField.deleteMany({ where: { versionId: version.id } });
      await tx.formVersion.update({
        where: { id: version.id },
        data: {
          settings: asJson(config.settings),
          layout: { update: { columns: config.columns } },
          style: { update: { tokens: asJson(config.style) } },
          fields: {
            create: config.fields.map((field, position) => ({
              ...fieldToData(field),
              position,
            })),
          },
        },
      });
    }

    await tx.formVersion.updateMany({
      where: { formId: input.formId },
      data: { isPublished: false },
    });
    await tx.formVersion.update({
      where: { id: versionId },
      data: { isPublished: true },
    });
    await tx.form.update({
      where: { id: input.formId },
      data: {
        status: "PUBLISHED",
        publishedVersion: versionNumber,
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      },
    });
    return { ok: true as const, publicId: form.publicId };
  });
}

export async function setBuilderFormStatus(
  db: PrismaClient,
  input: { shopId: string; formId: string; status: "DRAFT" | "DISABLED" },
) {
  const result = await db.form.updateMany({
    where: { id: input.formId, shopId: input.shopId },
    data: { status: input.status },
  });
  return result.count === 1;
}

export async function deleteBuilderForm(
  db: PrismaClient,
  input: { shopId: string; formId: string },
) {
  const result = await db.form.deleteMany({
    where: { id: input.formId, shopId: input.shopId },
  });
  return result.count === 1;
}

export async function duplicateBuilderForm(
  db: PrismaClient,
  input: { shopId: string; formId: string; name: string },
) {
  const loaded = await loadBuilderForm(db, input);
  if (!loaded) {
    throw new Error("Form not found");
  }

  const form = await db.form.create({
    data: {
      shopId: input.shopId,
      publicId: newFormPublicId(),
      name: input.name,
      title: loaded.form.title,
      status: "DRAFT",
      versions: {
        create: {
          version: 1,
          isPublished: false,
          ...configToVersionData(loaded.config),
        },
      },
    },
    select: { id: true, publicId: true, name: true },
  });

  return { ...form, shortcode: createFormShortcode(form.publicId) };
}
