import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  if (topic === "SHOP_REDACT") {
    await db.$transaction([
      db.shop.deleteMany({ where: { shopDomain: shop } }),
      db.session.deleteMany({ where: { shop } }),
    ]);
  }

  // Submission values are anonymous in the current data model and are not
  // linked to Shopify customer IDs or customer accounts. Therefore customer
  // data requests/redactions cannot be matched safely without deleting other
  // customers' submissions. The topics remain HMAC-verified and routed; a
  // customer identity/retention policy must be implemented before claiming
  // customer-level GDPR processing is complete.
  return new Response(null, { status: 200 });
};
