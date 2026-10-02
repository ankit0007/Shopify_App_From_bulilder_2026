import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}

export default function SettingsPage() {
  return (
    <s-page heading="Settings">
      <s-section heading="Workspace settings">
        <s-paragraph>
          Billing, notifications, integrations, and privacy controls will be
          added as each Phase 1 domain boundary is implemented.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
