-- CreateTable
CREATE TABLE "TaskModelOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pocConfigId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    CONSTRAINT "TaskModelOverride_pocConfigId_fkey" FOREIGN KEY ("pocConfigId") REFERENCES "PocConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskModelOverride_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "LlmConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LlmConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pocConfigId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "endpointUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "model" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" DATETIME,
    "availableModels" TEXT,
    CONSTRAINT "LlmConnection_pocConfigId_fkey" FOREIGN KEY ("pocConfigId") REFERENCES "PocConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LlmConnection" ("apiKey", "endpointUrl", "id", "isActive", "lastCheckedAt", "model", "pocConfigId") SELECT "apiKey", "endpointUrl", "id", "isActive", "lastCheckedAt", "model", "pocConfigId" FROM "LlmConnection";
DROP TABLE "LlmConnection";
ALTER TABLE "new_LlmConnection" RENAME TO "LlmConnection";
CREATE INDEX "LlmConnection_pocConfigId_idx" ON "LlmConnection"("pocConfigId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TaskModelOverride_pocConfigId_taskType_key" ON "TaskModelOverride"("pocConfigId", "taskType");

-- DataMigration: promote all existing connections to default providers
UPDATE "LlmConnection" SET "isDefault" = 1, "name" = 'Default';
