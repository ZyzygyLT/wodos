CREATE TABLE "faction_rep_grants" (
    "id" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "factionId" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faction_rep_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "faction_rep_grants_heroId_factionId_sourceType_sourceId_key"
ON "faction_rep_grants"("heroId", "factionId", "sourceType", "sourceId");

CREATE INDEX "faction_rep_grants_heroId_createdAt_idx"
ON "faction_rep_grants"("heroId", "createdAt");

ALTER TABLE "faction_rep_grants"
ADD CONSTRAINT "faction_rep_grants_heroId_fkey"
FOREIGN KEY ("heroId") REFERENCES "heroes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "faction_rep_grants"
ADD CONSTRAINT "faction_rep_grants_factionId_fkey"
FOREIGN KEY ("factionId") REFERENCES "factions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
