import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { BuilderShell } from "../components/form-builder/builder-shell";
import { isUniqueConstraintError } from "../db-errors.server";
import { parseBuilderConfig } from "../domain/forms/builder-schema";
import {
  deleteBuilderForm,
  duplicateBuilderForm,
  loadBuilderForm,
  publishBuilderForm,
  saveBuilderDraft,
  setBuilderFormStatus,
} from "../domain/forms/builder-service.server";
import { getOrCreateShop } from "../domain/forms/tenant.server";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(db, session.shop);
  const loaded = await loadBuilderForm(db, {
    shopId: shop.id,
    formId: String(params.formId),
  });

  if (!loaded) {
    throw new Response("Form not found", { status: 404 });
  }

  return {
    form: {
      id: loaded.form.id,
      publicId: loaded.form.publicId,
      name: loaded.form.name,
      status: loaded.form.status,
    },
    config: loaded.config,
    shortcode: loaded.shortcode,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(db, session.shop);
  const formId = String(params.formId);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const rawPayload = String(formData.get("payload") ?? "{}");
  if (rawPayload.length > 1_000_000) {
    return { ok: false, error: "Form payload is too large." };
  }
  let payload: {
    name?: string;
    config?: Parameters<typeof saveBuilderDraft>[1]["config"];
  };
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return { ok: false, error: "Invalid form payload." };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      issues: [{ path: "payload", message: "Form payload must be an object." }],
    };
  }
  const safeName =
    payload.name === undefined
      ? undefined
      : typeof payload.name === "string"
        ? payload.name.trim()
        : null;
  if (
    safeName === null ||
    (safeName !== undefined && (safeName.length < 2 || safeName.length > 120))
  ) {
    return {
      ok: false,
      issues: [
        {
          path: "name",
          message: "Form name must be between 2 and 120 characters.",
        },
      ],
    };
  }

  if (intent === "save" || intent === "publish") {
    const parsed = parseBuilderConfig(payload.config);
    if (!parsed.ok) return parsed;
    if (intent === "publish") {
      try {
        return await publishBuilderForm(db, {
          shopId: shop.id,
          formId,
          config: parsed.config,
          name: safeName ?? undefined,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return {
            ok: false,
            issues: [
              {
                path: "name",
                message: "A form with this name already exists.",
              },
            ],
          };
        }
        throw error;
      }
    }

    let saved;
    try {
      saved = await saveBuilderDraft(db, {
        shopId: shop.id,
        formId,
        config: parsed.config,
        name: safeName ?? undefined,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return {
          ok: false,
          issues: [
            { path: "name", message: "A form with this name already exists." },
          ],
        };
      }
      throw error;
    }
    if (!saved.ok) return saved;
    return saved;
  }

  if (intent === "disable") {
    return {
      ok: await setBuilderFormStatus(db, {
        shopId: shop.id,
        formId,
        status: "DISABLED",
      }),
    };
  }

  if (intent === "duplicate") {
    try {
      await duplicateBuilderForm(db, {
        shopId: shop.id,
        formId,
        name: safeName || "Form copy",
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { ok: false, error: "A form with this name already exists." };
      }
      throw error;
    }
    return redirect("/app/forms");
  }

  if (intent === "delete") {
    await deleteBuilderForm(db, { shopId: shop.id, formId });
    return redirect("/app/forms");
  }

  return { ok: false, error: "Unsupported form action." };
}

export default function FormBuilderRoute() {
  const data = useLoaderData<typeof loader>();
  return (
    <BuilderShell
      form={data.form}
      initialConfig={data.config}
      shortcode={data.shortcode}
    />
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
