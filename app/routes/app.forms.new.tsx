import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { isUniqueConstraintError } from "../db-errors.server";
import { createForm } from "../domain/forms/service.server";
import { getOrCreateShop } from "../domain/forms/tenant.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(db, session.shop);
  let form;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const name =
      attempt === 0 ? "Untitled form" : `Untitled form ${attempt + 1}`;
    try {
      form = await createForm(db, {
        shopId: shop.id,
        name,
      });
      break;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }

  if (!form) {
    throw new Error("Unable to create a unique draft form name.");
  }

  // The form-id route owns the complete builder UI and lifecycle.
  const redirectUrl = new URL(`/app/forms/${form.id}`, request.url);
  redirectUrl.search = new URL(request.url).search;
  return redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
}
