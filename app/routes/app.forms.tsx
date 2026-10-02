import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  deleteBuilderForm,
  duplicateBuilderForm,
} from "../domain/forms/builder-service.server";
import { createFormShortcode } from "../domain/forms/shortcode";
import { getOrCreateShop } from "../domain/forms/tenant.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(db, session.shop);
  const forms = await db.form.findMany({
    where: { shopId: shop.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      publicId: true,
      name: true,
      status: true,
      updatedAt: true,
    },
  });
  return {
    forms: forms.map((form) => ({
      ...form,
      updatedAt: form.updatedAt.toISOString(),
      shortcode: createFormShortcode(form.publicId),
    })),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(db, session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const formId = String(formData.get("formId") ?? "");

  if (intent === "delete") {
    await deleteBuilderForm(db, { shopId: shop.id, formId });
  }
  if (intent === "duplicate") {
    const name = String(formData.get("name") ?? "Form copy").trim();
    await duplicateBuilderForm(db, { shopId: shop.id, formId, name });
  }
  return redirect("/app/forms");
}

export default function FormsPage() {
  const { forms } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">Workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              Forms
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Create, publish, and manage your storefront forms.
            </p>
          </div>
          <a
            href="/app/forms/new"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Create form
          </a>
        </div>
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {forms.length ? (
            <div className="divide-y divide-slate-100">
              {forms.map((form) => (
                <div
                  className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6"
                  key={form.id}
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/app/forms/${form.id}`}
                      className="font-semibold text-slate-900 hover:text-blue-700"
                    >
                      {form.name}
                    </a>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      {form.shortcode}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${form.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : form.status === "DISABLED" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-700"}`}
                  >
                    {form.status}
                  </span>
                  <span className="hidden text-xs text-slate-400 md:block">
                    {new Date(form.updatedAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      onClick={() =>
                        navigator.clipboard?.writeText(form.shortcode)
                      }
                    >
                      Copy shortcode
                    </button>
                    <fetcher.Form method="post">
                      <input type="hidden" name="formId" value={form.id} />
                      <input type="hidden" name="intent" value="duplicate" />
                      <input
                        type="hidden"
                        name="name"
                        value={`${form.name} copy`}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Duplicate
                      </button>
                    </fetcher.Form>
                    <fetcher.Form
                      method="post"
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            `Delete ${form.name}? This cannot be undone.`,
                          )
                        )
                          event.preventDefault();
                      }}
                    >
                      <input type="hidden" name="formId" value={form.id} />
                      <input type="hidden" name="intent" value="delete" />
                      <button
                        type="submit"
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </fetcher.Form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                ＋
              </div>
              <h2 className="mt-4 font-semibold text-slate-900">
                Create your first form
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                Start with a blank canvas and build a responsive form in
                minutes.
              </p>
              <a
                href="/app/forms/new"
                className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Create form
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
