import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FORM_SETTINGS, DEFAULT_STYLE_TOKENS } from "./builder-schema";
import {
  deleteBuilderForm,
  duplicateBuilderForm,
  publishBuilderForm,
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
});
