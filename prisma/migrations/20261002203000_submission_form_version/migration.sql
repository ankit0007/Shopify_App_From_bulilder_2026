ALTER TABLE "Submission" ADD COLUMN "formVersionId" TEXT;

UPDATE "Submission" AS submission
SET "formVersionId" = version.id
FROM "Form" AS form
JOIN LATERAL (
  SELECT version.id
  FROM "FormVersion" AS version
  WHERE version."formId" = form.id
    AND version.version = form."publishedVersion"
  UNION ALL
  SELECT version.id
  FROM "FormVersion" AS version
  WHERE version."formId" = form.id
    AND version.version = form."currentVersion"
    AND NOT EXISTS (
      SELECT 1
      FROM "FormVersion" AS published_version
      WHERE published_version."formId" = form.id
        AND published_version.version = form."publishedVersion"
    )
  LIMIT 1
) AS version ON TRUE
WHERE submission."formId" = form.id;

DO $$
DECLARE
  missing_count INTEGER;
  mismatched_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM "Submission"
  WHERE "formVersionId" IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION
      'Cannot backfill formVersionId: % submission(s) have no matching form version',
      missing_count;
  END IF;

  SELECT COUNT(*) INTO mismatched_count
  FROM "Submission" AS submission
  JOIN "FormVersion" AS version ON version.id = submission."formVersionId"
  WHERE version."formId" <> submission."formId";

  IF mismatched_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add submission version integrity: % submission(s) reference a version from another form',
      mismatched_count;
  END IF;
END $$;

ALTER TABLE "Submission" ALTER COLUMN "formVersionId" SET NOT NULL;

CREATE UNIQUE INDEX "Form_shopId_id_key" ON "Form"("shopId", "id");
CREATE UNIQUE INDEX "FormVersion_formId_id_key" ON "FormVersion"("formId", "id");
CREATE INDEX "Submission_formVersionId_idx" ON "Submission"("formVersionId");

ALTER TABLE "Submission" DROP CONSTRAINT "Submission_formId_fkey";
ALTER TABLE "Submission"
ADD CONSTRAINT "Submission_shopId_formId_fkey"
FOREIGN KEY ("shopId", "formId") REFERENCES "Form"("shopId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Submission" DROP CONSTRAINT "Submission_formVersionId_fkey";
ALTER TABLE "Submission"
ADD CONSTRAINT "Submission_formId_formVersionId_fkey"
FOREIGN KEY ("formId", "formVersionId") REFERENCES "FormVersion"("formId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;
