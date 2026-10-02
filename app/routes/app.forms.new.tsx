import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { createForm } from "../domain/forms/service.server";
import { getOrCreateShop } from "../domain/forms/tenant.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (name.length < 2 || name.length > 120) {
    return { error: "Enter a form name between 2 and 120 characters." };
  }

  const shop = await getOrCreateShop(db, session.shop);
  const form = await createForm(db, { shopId: shop.id, name, title: title || undefined });
  return redirect(`/app/forms/${form.id}`);
}

export default function NewFormPage() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <a href="/app/forms" className="text-sm font-medium text-slate-500 hover:text-slate-900">← Back to forms</a>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-blue-600">New form</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Create a new form</h1>
          <p className="mt-2 text-sm text-slate-500">Give your form a clear name. You can configure fields and styling next.</p>
          <Form method="post" className="mt-8 space-y-5">
            {actionData?.error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionData.error}</div>}
            <label className="block text-sm font-medium text-slate-700">
              Form name
              <input name="name" required className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Contact us" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Internal title <span className="font-normal text-slate-400">(optional)</span>
              <input name="title" className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Contact form" />
            </label>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <a href="/app/forms" className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</a>
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Create form</button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
