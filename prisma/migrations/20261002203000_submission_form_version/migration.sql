ALTER TABLE "Submission" ADD COLUMN "formVersionId" TEXT NOT NULL;

CREATE INDEX "Submission_formVersionId_idx" ON "Submission"("formVersionId");

ALTER TABLE "Submission"
ADD CONSTRAINT "Submission_formVersionId_fkey"
FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
