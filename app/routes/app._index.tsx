import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useRouteError } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="Form Builder">
      <s-button slot="primary-action" href="/app/forms/new">
        Create form
      </s-button>
      <s-section heading="Build better storefront experiences">
        <s-paragraph>
          Create responsive forms, publish them through Shopify-supported theme
          surfaces, and manage submissions from one workspace.
        </s-paragraph>
      </s-section>
      <s-section heading="Phase 1 foundation">
        <s-stack direction="block" gap="base">
          <s-text>
            Tenant isolation and immutable form public IDs are ready.
          </s-text>
          <s-text>
            Form editing, placement rules, and submission workflows will be
            added in later phases.
          </s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
