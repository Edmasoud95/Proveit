-- AlterTable
ALTER TABLE "EvalResult" ADD COLUMN "errorDetail" TEXT;
ALTER TABLE "EvalResult" ADD COLUMN "failureStep" TEXT;
ALTER TABLE "EvalResult" ADD COLUMN "pipelineTrace" TEXT;

-- CreateTable
CREATE TABLE "EvalSuiteVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pocConfigId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "casesSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvalSuiteVersion_pocConfigId_fkey" FOREIGN KEY ("pocConfigId") REFERENCES "PocConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EvalRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pocConfigId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "passedCases" INTEGER NOT NULL DEFAULT 0,
    "failedCases" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "runNumber" INTEGER NOT NULL DEFAULT 0,
    "evalSuiteVersionId" TEXT,
    "snapshotSystemPrompt" TEXT NOT NULL DEFAULT '',
    "snapshotModel" TEXT NOT NULL DEFAULT '',
    "snapshotEndpointUrl" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "EvalRun_pocConfigId_fkey" FOREIGN KEY ("pocConfigId") REFERENCES "PocConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvalRun_evalSuiteVersionId_fkey" FOREIGN KEY ("evalSuiteVersionId") REFERENCES "EvalSuiteVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EvalRun" ("completedAt", "failedCases", "id", "passedCases", "pocConfigId", "startedAt", "status", "totalCases") SELECT "completedAt", "failedCases", "id", "passedCases", "pocConfigId", "startedAt", "status", "totalCases" FROM "EvalRun";
DROP TABLE "EvalRun";
ALTER TABLE "new_EvalRun" RENAME TO "EvalRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
