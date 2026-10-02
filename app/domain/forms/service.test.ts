import { describe, expect, it, vi } from "vitest";
import {
  createForm,
  duplicateForm,
  resolveFormByShortcode,
} from "./service.server";

type FakeDatabase = {
  form: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

function fakeDatabase(): FakeDatabase {
  return {
    form: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  };
}

describe("form service identity and tenant boundaries", () => {
  it("creates and duplicates forms with different immutable IDs", async () => {
    const db = fakeDatabase();
    db.form.create
      .mockResolvedValueOnce({ id: "one", publicId: "first", name: "Contact" })
      .mockResolvedValueOnce({ id: "two", publicId: "second", name: "Contact copy" });
    db.form.findFirst.mockResolvedValue({
      title: "Contact",
      versions: [
        {
          settings: {},
          layout: { columns: 1 },
          style: { tokens: {} },
          fields: [],
        },
      ],
    });

    const original = await createForm(db as never, {
      shopId: "shop-a",
      name: "Contact",
    });
    const duplicate = await duplicateForm(db as never, {
      shopId: "shop-a",
      formId: "one",
      name: "Contact copy",
    });

    expect(original.publicId).not.toBe(duplicate.publicId);
    expect(original.shortcode).toBe("[form:first]");
    expect(duplicate.shortcode).toBe("[form:second]");
    expect(db.form.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "one", shopId: "shop-a" } }),
    );
  });

  it("resolves only published forms belonging to the requested shop", async () => {
    const db = fakeDatabase();
    db.form.findFirst.mockResolvedValue(null);

    const result = await resolveFormByShortcode(db as never, {
      shopId: "shop-b",
      shortcode: "[form:184729]",
    });

    expect(result).toBeNull();
    expect(db.form.findFirst).toHaveBeenCalledWith({
      where: {
        shopId: "shop-b",
        publicId: "184729",
        status: "PUBLISHED",
      },
    });
  });

  it("handles invalid IDs without querying the database", async () => {
    const db = fakeDatabase();
    const result = await resolveFormByShortcode(db as never, {
      shopId: "shop-a",
      shortcode: "[form:not valid]",
    });

    expect(result).toBeNull();
    expect(db.form.findFirst).not.toHaveBeenCalled();
  });
});
