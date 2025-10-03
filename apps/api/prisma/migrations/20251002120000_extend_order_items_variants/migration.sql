ALTER TABLE "public"."OrderItem" ADD COLUMN IF NOT EXISTS "variantId" TEXT;
ALTER TABLE "public"."OrderItem" ADD COLUMN IF NOT EXISTS "variantLabel" TEXT;
ALTER TABLE "public"."OrderItem" ADD COLUMN IF NOT EXISTS "variantOptions" JSONB;
