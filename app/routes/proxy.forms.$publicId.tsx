import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  createSubmission,
  resolvePublishedForm,
  STOREFRONT_MAX_SUBMISSION_BYTES,
  toPublicForm,
} from "../domain/forms/storefront-service.server";
import {
  getSubmissionRateLimiter,
  RateLimitUnavailableError,
} from "../domain/forms/submission-rate-limit.server";

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

class PayloadTooLargeError extends Error {}

async function readJsonBody(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > STOREFRONT_MAX_SUBMISSION_BYTES
    ) {
      throw new PayloadTooLargeError();
    }
  }
  if (!request.body) throw new Error("Missing request body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > STOREFRONT_MAX_SUBMISSION_BYTES) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
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
    const limiter = getSubmissionRateLimiter();
    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (limiter) {
      try {
        const allowed = await limiter.allow(`${shopId}:${ip}`);
        if (!allowed) {
          return jsonError("Please wait before submitting again.", 429);
        }
      } catch (error) {
        if (error instanceof RateLimitUnavailableError) {
          return jsonError("Please wait before submitting again.", 503);
        }
        throw error;
      }
    }
    const body = await readJsonBody(request);
    const result = await createSubmission(db, {
      shopId,
      publicIdOrShortcode: params.publicId ?? "",
      values: body?.values,
      source: "theme_app_block",
    });
    if (!result.ok) {
      return jsonError(
        "Please correct the highlighted fields.",
        "error" in result ? 404 : 422,
        "issues" in result ? result.issues : undefined,
      );
    }
    return Response.json(
      { ok: true, message: result.message },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return jsonError("Submission is too large.", 413);
    }
    return jsonError("We could not submit the form. Please try again.", 400);
  }
}

export default function ProxyFormRoute() {
  return null;
}
