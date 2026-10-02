import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  // Webhooks can be delivered after a prior uninstall and without a session.
  // Keep tenant data for the documented retention policy, but revoke all
  // Shopify sessions and mark the tenant inactive.
  await db.$transaction([
    db.shop.updateMany({
      where: { shopDomain: shop },
      data: { uninstalledAt: new Date() },
    }),
    db.session.deleteMany({ where: { shop } }),
  ]);

  return new Response();
};
