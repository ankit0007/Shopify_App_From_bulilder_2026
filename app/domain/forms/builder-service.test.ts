import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FORM_SETTINGS, DEFAULT_STYLE_TOKENS } from "./builder-schema";
import {
  deleteBuilderForm,
  duplicateBuilderForm,
  getFormLifecycleState,
  publishBuilderForm,
  saveBuilderDraft,
  setBuilderFormStatus,
} from "./builder-service.server";

function fakeDatabase() {
  return {
    form: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe("builder service tenant boundaries", () => {
  it.each([
    ["DRAFT", null, { version: 1, isPublished: false }, "DRAFT"],
    ["PUBLISHED", 1, { version: 1, isPublished: true }, "PUBLISHED"],
    [
      "PUBLISHED",
      1,
      { version: 2, isPublished: false },
      "PUBLISHED_WITH_DRAFT",
    ],
    ["DISABLED", 1, { version: 2, isPublished: false }, "DISABLED_WITH_DRAFT"],
  ] as const)(
    "derives the %s lifecycle state",
    (status, publishedVersion, version, expected) => {
      expect(getFormLifecycleState({ status, publishedVersion }, version)).toBe(
        expected,
      );
    },
  );

  it("duplicates into a new form identity while scoping the source lookup", async () => {
    const db = fakeDatabase();
    db.form.findFirst.mockResolvedValue({
      id: "source",
      publicId: "original",
      name: "Contact",
      title: "Contact",
      versions: [
        {
          version: 1,
          isPublished: false,
          settings: DEFAULT_FORM_SETTINGS,
          layout: { columns: 2 },
          style: { tokens: DEFAULT_STYLE_TOKENS },
          fields: [],
        },
      ],
    });
    db.form.create.mockResolvedValue({
      id: "copy",
      publicId: "new-public-id",
      name: "Contact copy",
    });

    const copy = await duplicateBuilderForm(db as never, {
      shopId: "shop-a",
      formId: "source",
      name: "Contact copy",
    });

    expect(copy.publicId).toBe("new-public-id");
    expect(copy.shortcode).toBe("[form:new-public-id]");
    expect(db.form.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "source", shopId: "shop-a" } }),
    );
    expect(db.form.create.mock.calls[0][0].data.shopId).toBe("shop-a");
    expect(db.form.create.mock.calls[0][0].data.publicId).not.toBe("original");
  });

  it("cannot change status outside the current shop", async () => {
    const db = fakeDatabase();
    db.form.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      setBuilderFormStatus(db as never, {
        shopId: "shop-a",
        formId: "shop-b-form",
        status: "DISABLED",
      }),
    ).resolves.toBe(false);

    expect(db.form.updateMany).toHaveBeenCalledWith({
      where: { id: "shop-b-form", shopId: "shop-a" },
      data: { status: "DISABLED" },
    });
  });

  it("cannot delete outside the current shop", async () => {
    const db = fakeDatabase();
    db.form.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      deleteBuilderForm(db as never, {
        shopId: "shop-a",
        formId: "shop-b-form",
      }),
    ).resolves.toBe(false);

    expect(db.form.deleteMany).toHaveBeenCalledWith({
      where: { id: "shop-b-form", shopId: "shop-a" },
    });
  });

  it("publishes a validated version and records the published version", async () => {
    const db = fakeDatabase();
    const formRecord = {
      id: "form-a",
      publicId: "public-a",
      name: "Contact",
      status: "DRAFT",
      currentVersion: 1,
      versions: [
        {
          id: "version-a",
          version: 1,
          isPublished: false,
          settings: DEFAULT_FORM_SETTINGS,
          layout: { columns: 1 },
          style: { tokens: DEFAULT_STYLE_TOKENS },
          fields: [
            {
              id: "field-a",
              key: "field_name",
              label: "Name",
              type: "TEXT",
              row: 1,
              column: 1,
              width: 12,
              required: true,
              configuration: { name: "name" },
              validation: {},
            },
          ],
        },
      ],
    };
    db.form.findFirst.mockResolvedValue(formRecord);
    const tx = {
      formVersion: {
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      formField: { deleteMany: vi.fn() },
      form: {
        findFirst: vi.fn().mockResolvedValue(formRecord),
        update: vi.fn(),
      },
    };
    db.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      publishBuilderForm(db as never, { shopId: "shop-a", formId: "form-a" }),
    ).resolves.toEqual({ ok: true, publicId: "public-a" });
    expect(tx.formVersion.updateMany).toHaveBeenCalledWith({
      where: { formId: "form-a" },
      data: { isPublished: false },
    });
    expect(tx.form.update).toHaveBeenCalledWith({
      where: { id: "form-a" },
      data: { status: "PUBLISHED", publishedVersion: 1 },
    });
  });

  it("saves a published form into a draft while keeping the published version", async () => {
    const db = fakeDatabase();
    const publishedVersion = {
      id: "version-one",
      version: 1,
      isPublished: true,
      settings: DEFAULT_FORM_SETTINGS,
      layout: { columns: 1 },
      style: { tokens: DEFAULT_STYLE_TOKENS },
      fields: [],
    };
    const tx = {
      form: {
        findFirst: vi.fn().mockResolvedValue({
          id: "form-a",
          publicId: "public-a",
          currentVersion: 1,
          status: "PUBLISHED",
          versions: [publishedVersion],
        }),
        update: vi.fn(),
      },
      formVersion: {
        create: vi.fn().mockResolvedValue({ id: "version-two" }),
      },
      formField: { deleteMany: vi.fn() },
    };
    db.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await saveBuilderDraft(db as never, {
      shopId: "shop-a",
      formId: "form-a",
      config: {
        columns: 1,
        settings: DEFAULT_FORM_SETTINGS,
        style: DEFAULT_STYLE_TOKENS,
        fields: [],
      },
    });

    expect(result).toEqual({
      ok: true,
      versionId: "version-two",
      publicId: "public-a",
    });
    expect(tx.formVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 2,
          isPublished: false,
        }),
      }),
    );
    expect(tx.form.update).toHaveBeenCalledWith({
      where: { id: "form-a" },
      data: { currentVersion: 2 },
    });
    expect(tx.formVersion.create.mock.calls[0][0].data.isPublished).toBe(false);
  });

  it("publishes the pending draft and replaces the active version atomically", async () => {
    const db = fakeDatabase();
    const draft = {
      id: "version-two",
      version: 2,
      isPublished: false,
      settings: DEFAULT_FORM_SETTINGS,
      layout: { columns: 1 },
      style: { tokens: DEFAULT_STYLE_TOKENS },
      fields: [],
    };
    const tx = {
      formVersion: {
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      formField: { deleteMany: vi.fn() },
      form: {
        findFirst: vi.fn().mockResolvedValue({
          id: "form-a",
          publicId: "public-a",
          currentVersion: 2,
          publishedVersion: 1,
          status: "PUBLISHED",
          versions: [draft],
        }),
        update: vi.fn(),
      },
    };
    db.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      publishBuilderForm(db as never, {
        shopId: "shop-a",
        formId: "form-a",
        config: {
          columns: 1,
          settings: DEFAULT_FORM_SETTINGS,
          style: DEFAULT_STYLE_TOKENS,
          fields: [
            {
              id: "field_name",
              type: "text",
              label: "Name",
              name: "name",
              description: "",
              placeholder: "",
              defaultValue: "",
              required: false,
              disabled: false,
              hidden: false,
              row: 1,
              column: 1,
              width: 12,
              options: [],
              validation: {},
            },
          ],
        },
      }),
    ).resolves.toEqual({ ok: true, publicId: "public-a" });

    expect(db.$transaction).toHaveBeenCalled();
    expect(tx.formVersion.updateMany).toHaveBeenCalledWith({
      where: { formId: "form-a" },
      data: { isPublished: false },
    });
    expect(tx.formVersion.update).toHaveBeenCalledWith({
      where: { id: "version-two" },
      data: { isPublished: true },
    });
    expect(tx.form.update).toHaveBeenCalledWith({
      where: { id: "form-a" },
      data: { status: "PUBLISHED", publishedVersion: 2 },
    });
  });
});
