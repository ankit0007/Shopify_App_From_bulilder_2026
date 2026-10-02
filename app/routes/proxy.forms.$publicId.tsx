import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  createSubmission,
  resolvePublishedForm,
  toPublicForm,
} from "../domain/forms/storefront-service.server";

async function resolveShopId(shopDomain: string) {
  const shop = await db.shop.findUnique({
    where: { shopDomain },
    select: { id: true, uninstalledAt: true },
  });
  return shop && !shop.uninstalledAt ? shop.id : null;
}

function jsonError(message: string, status: number, details?: unknown) {
  return Response.json(
    { ok: false, error: message, ...(details ? { issues: details } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session?.shop) return jsonError("Form not found.", 404);
    const shopId = await resolveShopId(session.shop);
    if (!shopId) return jsonError("Form not found.", 404);
    const form = await resolvePublishedForm(db, {
      shopId,
      publicIdOrShortcode: params.publicId ?? "",
    });
    if (!form) return jsonError("Form not found.", 404);
    return Response.json(
      { ok: true, form: toPublicForm(form) },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch {
    return jsonError("Form not found.", 404);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") return jsonError("Method not allowed.", 405);
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session?.shop) return jsonError("Form not found.", 404);
    const shopId = await resolveShopId(session.shop);
    if (!shopId) return jsonError("Form not found.", 404);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 70 * 1024) return jsonError("Submission is too large.", 413);
    const body = await request.json();
    const result = await createSubmission(db, {
      shopId,
      publicIdOrShortcode: params.publicId ?? "",
      values: body?.values,
      source: "theme_app_block",
    });
    if (!result.ok) {
      return jsonError(
        "Please correct the highlighted fields.",
        result.error ? 404 : 422,
        "issues" in result ? result.issues : undefined,
      );
    }
    return Response.json(
      { ok: true, message: result.message },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return jsonError("We could not submit the form. Please try again.", 400);
  }
}

export default function ProxyFormRoute() {
  return null;
}
