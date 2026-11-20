ALTER TABLE "bazar_listings"
ADD COLUMN "cycle" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "bazar_purchases"
ADD COLUMN "cycle" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "bazar_purchases_listingId_cycle_pricePaid_idx"
ON "bazar_purchases"("listingId", "cycle", "pricePaid");
