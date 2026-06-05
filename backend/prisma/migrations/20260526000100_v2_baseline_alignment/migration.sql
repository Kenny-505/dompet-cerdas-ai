-- Align profile and spending prediction schema with v2 context.

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "user_segment" TEXT NOT NULL DEFAULT 'pekerja_tetap',
ADD COLUMN IF NOT EXISTS "has_savings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "has_debt" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "spending_predictions"
ADD COLUMN IF NOT EXISTS "category_slug" TEXT NOT NULL DEFAULT '__total';

DROP INDEX IF EXISTS "spending_predictions_user_id_target_month_key";

CREATE UNIQUE INDEX IF NOT EXISTS "spending_predictions_user_id_target_month_category_slug_key"
ON "spending_predictions"("user_id", "target_month", "category_slug");
