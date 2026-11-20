-- Idempotency keys for post-run material and rune drops.
CREATE TABLE "DungeonRunRewardGrant" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "heroId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DungeonRunRewardGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DungeonRunRewardGrant_runId_heroId_kind_key"
  ON "DungeonRunRewardGrant"("runId", "heroId", "kind");
CREATE INDEX "DungeonRunRewardGrant_heroId_createdAt_idx"
  ON "DungeonRunRewardGrant"("heroId", "createdAt");
