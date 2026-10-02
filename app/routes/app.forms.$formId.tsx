import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { BuilderShell } from "../components/form-builder/builder-shell";
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
  let payload: {
    name?: string;
    config?: Parameters<typeof saveBuilderDraft>[1]["config"];
  };
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "Invalid form payload." };
  }

  if (intent === "save" || intent === "publish") {
    if (!payload.config) {
      return { ok: false, issues: [{ path: "config", message: "Form configuration is missing." }] };
    }
    const saved = await saveBuilderDraft(db, {
      shopId: shop.id,
      formId,
      config: payload.config,
      name: payload.name,
    });
    if (!saved.ok) return saved;
    if (intent === "publish") {
      return publishBuilderForm(db, { shopId: shop.id, formId });
    }
    return saved;
  }

  if (intent === "disable") {
    return { ok: await setBuilderFormStatus(db, { shopId: shop.id, formId, status: "DISABLED" }) };
  }

  if (intent === "duplicate") {
    await duplicateBuilderForm(db, {
      shopId: shop.id,
      formId,
      name: payload.name?.trim() || "Form copy",
    });
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
  return <BuilderShell form={data.form} initialConfig={data.config} shortcode={data.shortcode} />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
