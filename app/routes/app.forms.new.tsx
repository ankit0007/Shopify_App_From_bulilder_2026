import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { createForm } from "../domain/forms/service.server";
import { getOrCreateShop } from "../domain/forms/tenant.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(db, session.shop);
  const form = await createForm(db, {
    shopId: shop.id,
    name: "Untitled form",
  });

  // The form-id route owns the complete builder UI and lifecycle.
  const redirectUrl = new URL(`/app/forms/${form.id}`, request.url);
  redirectUrl.search = new URL(request.url).search;
  return redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
}
