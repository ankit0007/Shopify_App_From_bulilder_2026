ALTER TABLE "Submission" ADD COLUMN "formVersionId" TEXT;

UPDATE "Submission" AS submission
SET "formVersionId" = version.id
FROM "FormVersion" AS version
JOIN "Form" AS form ON form.id = version."formId"
WHERE submission."formId" = form.id
  AND version.version = COALESCE(form."publishedVersion", form."currentVersion");

ALTER TABLE "Submission" ALTER COLUMN "formVersionId" SET NOT NULL;

CREATE INDEX "Submission_formVersionId_idx" ON "Submission"("formVersionId");

ALTER TABLE "Submission"
ADD CONSTRAINT "Submission_formVersionId_fkey"
FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
