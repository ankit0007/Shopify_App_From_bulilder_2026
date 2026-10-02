export function embeddedAdminFormUrl(input: {
  shop: string;
  apiKey: string;
  formId: string;
}) {
  const storeHandle = input.shop.replace(/\.myshopify\.com$/i, "");
  return `https://admin.shopify.com/store/${storeHandle}/apps/${input.apiKey}/app/forms/${input.formId}`;
}
