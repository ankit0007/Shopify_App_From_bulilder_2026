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

  // Customer-level redaction and data requests are deliberately routed and
  // HMAC-verified now; personal-data workflows will be completed with the
  // submission retention policy in the submission phase.
  return new Response(null, { status: 200 });
};
