import type { LoaderFunctionArgs } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { isUniqueConstraintError } from "../db-errors.server";
import { createForm } from "../domain/forms/service.server";
import { getOrCreateShop } from "../domain/forms/tenant.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, redirect } = await authenticate.admin(request);
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

  // A same-iframe redirect leaves Shopify Admin on /app/forms/new. App Bridge
  // then reloads that path without the session and the iframe stays blank.
  // Navigate the Admin frame to the form route so the builder loads in place.
  return redirect(
    `shopify://admin/apps/${process.env.SHOPIFY_API_KEY}/app/forms/${form.id}`,
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
