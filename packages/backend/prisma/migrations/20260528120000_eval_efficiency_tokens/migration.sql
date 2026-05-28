-- AlterTable
ALTER TABLE "EvalResult" ADD COLUMN "promptTokens" INTEGER;
ALTER TABLE "EvalResult" ADD COLUMN "completionTokens" INTEGER;
ALTER TABLE "EvalResult" ADD COLUMN "totalTokens" INTEGER;
