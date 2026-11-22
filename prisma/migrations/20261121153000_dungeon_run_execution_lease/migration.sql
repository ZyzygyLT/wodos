ALTER TABLE "dungeon_runs" ADD COLUMN "executionStartedAt" TIMESTAMP(3);

CREATE INDEX "dungeon_runs_status_executionStartedAt_idx"
ON "dungeon_runs"("status", "executionStartedAt");
