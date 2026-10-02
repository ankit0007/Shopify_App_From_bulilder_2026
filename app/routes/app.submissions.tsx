import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getOrCreateShop } from "../domain/forms/tenant.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(db, session.shop);
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") || 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage >= 1
      ? Math.min(requestedPage, 100_000)
      : 1;
  const formId = url.searchParams.get("formId") || "";
  const pageSize = 20;
  const where = { shopId: shop.id, ...(formId ? { formId } : {}) };
  const [submissions, total, forms] = await Promise.all([
    db.submission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        form: { select: { id: true, name: true, publicId: true } },
        values: { select: { fieldKey: true, value: true } },
      },
    }),
    db.submission.count({ where }),
    db.form.findMany({
      where: { shopId: shop.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return {
    submissions: submissions.map((submission) => ({
      id: submission.id,
      form: submission.form,
      status: submission.status,
      createdAt: submission.createdAt.toISOString(),
      values: submission.values.map((value) => ({
        fieldKey: value.fieldKey,
        value: value.value,
      })),
    })),
    forms,
    formId,
    page,
    pageSize,
    total,
  };
}

export default function SubmissionsPage() {
  const { submissions, forms, formId, page, pageSize, total } =
    useLoaderData<typeof loader>();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageLink = (nextPage: number) =>
    `?page=${nextPage}${formId ? `&formId=${encodeURIComponent(formId)}` : ""}`;
  const formatValue = (value: unknown) =>
    typeof value === "string" ? value : JSON.stringify(value);
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">Workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              Submissions
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Review responses received from your published forms.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
            {total} total
          </span>
        </div>
        <form className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="min-w-56 text-sm font-medium text-slate-700">
            Filter by form
            <select
              name="formId"
              defaultValue={formId}
              className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All forms</option>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Apply filter
          </button>
        </form>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {submissions.length ? (
            <div className="divide-y divide-slate-100">
              {submissions.map((submission) => (
                <Link
                  key={submission.id}
                  to={`/app/submissions/${submission.id}`}
                  className="block px-5 py-5 transition hover:bg-slate-50 sm:px-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {submission.form.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(submission.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {submission.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                    {submission.values.slice(0, 3).map((value) => (
                      <span key={value.fieldKey} className="max-w-xs truncate">
                        <span className="font-medium text-slate-800">
                          {value.fieldKey}:
                        </span>{" "}
                        {formatValue(value.value)}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-6 py-20 text-center">
              <h2 className="font-semibold text-slate-900">
                No submissions yet
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                Responses will appear here when customers submit a published
                form.
              </p>
            </div>
          )}
        </div>
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  to={pageLink(page - 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700"
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  to={pageLink(page + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
