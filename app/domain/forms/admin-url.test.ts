import { describe, expect, it } from "vitest";
import { embeddedAdminFormUrl } from "./admin-url";

describe("embedded admin form URL", () => {
  it("opens the created form in the Shopify Admin frame", () => {
    expect(
      embeddedAdminFormUrl({
        shop: "form-builder-dev.myshopify.com",
        apiKey: "app-key",
        formId: "form-1",
      }),
    ).toBe(
      "https://admin.shopify.com/store/form-builder-dev/apps/app-key/app/forms/form-1",
    );
  });
});
