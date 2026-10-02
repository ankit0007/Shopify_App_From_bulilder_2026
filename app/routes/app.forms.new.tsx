import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}

export default function NewFormPage() {
  return (
    <s-page heading="Create form">
      <s-section heading="Builder foundation">
        <s-alert tone="info">
          The visual form builder is intentionally deferred to Phase 2. Its
          persistence boundary and immutable form ID contract are ready.
        </s-alert>
      </s-section>
    </s-page>
  );
}
