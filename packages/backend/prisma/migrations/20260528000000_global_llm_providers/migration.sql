-- Make LlmConnection.pocConfigId nullable to support global providers (NULL = no owning POC)
-- SQLite requires full table recreation to change column nullability

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_LlmConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pocConfigId" TEXT,
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

INSERT INTO "new_LlmConnection" ("id", "pocConfigId", "name", "isDefault", "endpointUrl", "apiKey", "model", "isActive", "lastCheckedAt", "availableModels")
SELECT "id", "pocConfigId", "name", "isDefault", "endpointUrl", "apiKey", "model", "isActive", "lastCheckedAt", "availableModels"
FROM "LlmConnection";

DROP TABLE "LlmConnection";
ALTER TABLE "new_LlmConnection" RENAME TO "LlmConnection";

CREATE INDEX "LlmConnection_pocConfigId_idx" ON "LlmConnection"("pocConfigId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
