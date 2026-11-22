-- Freeze the party and its combat build when a dungeon run is registered.
CREATE TABLE "dungeon_run_participants" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "heroId" TEXT,
  "profileId" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dungeon_run_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dungeon_run_participants_runId_heroId_key"
  ON "dungeon_run_participants"("runId", "heroId");

CREATE INDEX "dungeon_run_participants_heroId_createdAt_idx"
  ON "dungeon_run_participants"("heroId", "createdAt");

ALTER TABLE "dungeon_run_participants"
  ADD CONSTRAINT "dungeon_run_participants_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "dungeon_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dungeon_run_participants"
  ADD CONSTRAINT "dungeon_run_participants_heroId_fkey"
  FOREIGN KEY ("heroId") REFERENCES "heroes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
