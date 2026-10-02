import type { PrismaClient } from "@prisma/client";

export async function getOrCreateShop(db: PrismaClient, shopDomain: string) {
  return db.shop.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: { uninstalledAt: null },
  });
}

export async function getShopForm(
  db: PrismaClient,
  input: { shopId: string; formId: string },
) {
  return db.form.findFirst({
    where: { id: input.formId, shopId: input.shopId },
  });
}
