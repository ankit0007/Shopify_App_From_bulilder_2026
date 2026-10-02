import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}

export default function FormsPage() {
  return (
    <s-page heading="Forms">
      <s-button slot="primary-action" href="/app/forms/new">
        Create form
      </s-button>
      <s-section heading="Your forms">
        <s-empty-state heading="No forms yet">
          <s-paragraph>
            The visual builder will be introduced in the next phase. New forms
            will receive an immutable public ID such as [form:184729].
          </s-paragraph>
        </s-empty-state>
      </s-section>
    </s-page>
  );
}
