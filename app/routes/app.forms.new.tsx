import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { isUniqueConstraintError } from "../db-errors.server";
import { embeddedAdminFormUrl } from "../domain/forms/admin-url";
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

  return {
    adminUrl: embeddedAdminFormUrl({
      shop: session.shop,
      apiKey: process.env.SHOPIFY_API_KEY || "",
      formId: form.id,
    }),
  };
}

export default function NewFormPage() {
  const { adminUrl } = useLoaderData<typeof loader>();

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.open(${JSON.stringify(adminUrl)}, "_parent");`,
        }}
      />
      <p className="p-6 text-sm text-slate-600">Opening the form builder…</p>
    </>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
