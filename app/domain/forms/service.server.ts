import type { Prisma, PrismaClient } from "@prisma/client";
import { newFormPublicId } from "./ids";
import { createFormShortcode } from "./shortcode";

type Database = PrismaClient | Prisma.TransactionClient;

export type FormIdentity = {
  id: string;
  publicId: string;
  name: string;
  shortcode: string;
};

export async function createForm(
  db: Database,
  input: { shopId: string; name: string; title?: string },
): Promise<FormIdentity> {
  const form = await db.form.create({
    data: {
      shopId: input.shopId,
      publicId: newFormPublicId(),
      name: input.name,
      title: input.title,
      versions: {
        create: {
          version: 1,
          settings: {},
          layout: { create: { columns: 1 } },
          style: { create: { tokens: {} } },
        },
      },
    },
    select: { id: true, publicId: true, name: true },
  });

  return { ...form, shortcode: createFormShortcode(form.publicId) };
}

export async function duplicateForm(
  db: Database,
  input: { shopId: string; formId: string; name: string },
): Promise<FormIdentity> {
  const source = await db.form.findFirst({
    where: { id: input.formId, shopId: input.shopId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { fields: true, layout: true, style: true },
      },
    },
  });

  if (!source) {
    throw new Error("Form not found");
  }

  const version = source.versions[0];
  if (!version) {
    throw new Error("Form has no version");
  }

  const sourceFields = version.fields;
  const copy = await db.form.create({
    data: {
      shopId: input.shopId,
      publicId: newFormPublicId(),
      name: input.name,
      title: source.title,
      status: "DRAFT",
      versions: {
        create: {
          version: 1,
          settings: version.settings ?? {},
          layout: { create: { columns: version.layout.columns } },
          style: { create: { tokens: version.style.tokens ?? {} } },
          fields: {
            create: sourceFields.map((field) => ({
              key: field.key,
              label: field.label,
              type: field.type,
              position: field.position,
              column: field.column,
              width: field.width,
              required: field.required,
              configuration: field.configuration ?? {},
              validation: field.validation ?? undefined,
            })),
          },
        },
      },
    },
    select: { id: true, publicId: true, name: true },
  });

  return { ...copy, shortcode: createFormShortcode(copy.publicId) };
}

export async function resolveFormByShortcode(
  db: Database,
  input: { shopId: string; shortcode: string },
) {
  const publicId = input.shortcode.startsWith("[form:")
    ? input.shortcode.slice(6, -1)
    : input.shortcode;

  if (!/^[A-Za-z0-9_-]+$/.test(publicId)) {
    return null;
  }

  return db.form.findFirst({
    where: {
      shopId: input.shopId,
      publicId,
      status: "PUBLISHED",
    },
  });
}
