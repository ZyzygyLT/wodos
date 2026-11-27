ALTER TABLE "heroes"
ADD COLUMN "attrPointLedger" JSONB NOT NULL DEFAULT '{}'::jsonb;
