-- Create PocConfigVersion table
CREATE TABLE "PocConfigVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pocConfigId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "tools" TEXT NOT NULL,
    "changeLabel" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PocConfigVersion_pocConfigId_fkey" FOREIGN KEY ("pocConfigId") REFERENCES "PocConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PocConfigVersion_pocConfigId_versionNumber_key" ON "PocConfigVersion"("pocConfigId", "versionNumber");
CREATE INDEX "PocConfigVersion_pocConfigId_idx" ON "PocConfigVersion"("pocConfigId");

-- Add currentConfigVersionId to PocConfig
ALTER TABLE "PocConfig" ADD COLUMN "currentConfigVersionId" TEXT;

-- Add config version fields to EvalRun
ALTER TABLE "EvalRun" ADD COLUMN "configVersionId" TEXT;
ALTER TABLE "EvalRun" ADD COLUMN "snapshotConfigVersionNumber" INTEGER;
