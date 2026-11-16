ALTER TABLE "network_placements" ADD COLUMN IF NOT EXISTS "placement_kind" text DEFAULT 'STUDENT' NOT NULL;
DROP INDEX IF EXISTS "network_parent_side_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "network_parent_side_kind_unique" ON "network_placements" USING btree ("parent_account_id", "side", "placement_kind");
