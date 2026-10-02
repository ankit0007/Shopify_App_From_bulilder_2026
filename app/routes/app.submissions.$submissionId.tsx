import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getOrCreateShop } from "../domain/forms/tenant.server";

const allowedStatuses = new Set(["NEW", "READ", "ARCHIVED", "SPAM"]);

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(db, session.shop);
  const submission = await db.submission.findFirst({
    where: { id: params.submissionId, shopId: shop.id },
    include: {
      form: { select: { name: true, publicId: true } },
      formVersion: {
        select: {
          fields: {
            orderBy: { position: "asc" },
            select: { key: true, label: true, type: true },
          },
        },
      },
      values: { select: { fieldKey: true, value: true } },
    },
  });
  if (!submission) throw new Response("Not found", { status: 404 });
  return {
    id: submission.id,
    status: submission.status,
    createdAt: submission.createdAt.toISOString(),
    form: submission.form,
    fields: submission.formVersion.fields,
    values: submission.values,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(db, session.shop);
  const formData = await request.formData();
  const status = String(formData.get("status") ?? "");
  if (!allowedStatuses.has(status)) {
    return { error: "Choose a valid status." };
  }
  const result = await db.submission.updateMany({
    where: { id: params.submissionId, shopId: shop.id },
    data: { status: status as "NEW" | "READ" | "ARCHIVED" | "SPAM" },
  });
  if (!result.count) throw new Response("Not found", { status: 404 });
  return redirect(`/app/submissions/${params.submissionId}`);
}

export default function SubmissionDetailPage() {
  const submission = useLoaderData<typeof loader>();
  const labels = new Map(
    submission.fields.map((field) => [field.key, `${field.label} (${field.type})`]),
  );
  const formatValue = (value: unknown) =>
    typeof value === "string" ? value : JSON.stringify(value);
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/app/submissions"
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          ← Back to submissions
        </Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">Submission</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              {submission.form.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Received {new Date(submission.createdAt).toLocaleString()}
            </p>
          </div>
          <Form method="post" className="flex items-center gap-2">
            <label className="sr-only" htmlFor="submission-status">
              Submission status
            </label>
            <select
              id="submission-status"
              name="status"
              defaultValue={submission.status}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {["NEW", "READ", "ARCHIVED", "SPAM"].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Update
            </button>
          </Form>
        </div>
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-slate-900">Submitted values</h2>
          </div>
          <dl className="divide-y divide-slate-100">
            {submission.values.map((value) => (
              <div
                key={value.fieldKey}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(12rem,1fr)_2fr] sm:px-6"
              >
                <dt className="text-sm font-medium text-slate-500">
                  {labels.get(value.fieldKey) ?? value.fieldKey}
                </dt>
                <dd className="break-words text-sm text-slate-900">
                  {formatValue(value.value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
