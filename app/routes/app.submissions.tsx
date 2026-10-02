import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}

export default function SubmissionsPage() {
  return (
    <s-page heading="Submissions">
      <s-section heading="Submission management">
        <s-empty-state heading="No submissions yet">
          <s-paragraph>
            Submission storage, filtering, export, and retention controls will
            be added with the submission workflow.
          </s-paragraph>
        </s-empty-state>
      </s-section>
    </s-page>
  );
}
