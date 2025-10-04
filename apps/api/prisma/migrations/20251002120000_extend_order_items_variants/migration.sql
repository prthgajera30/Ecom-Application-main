DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OrderItem'
      AND column_name = 'variantId'
  ) THEN
    ALTER TABLE "public"."OrderItem" ADD COLUMN "variantId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OrderItem'
      AND column_name = 'variantLabel'
  ) THEN
    ALTER TABLE "public"."OrderItem" ADD COLUMN "variantLabel" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OrderItem'
      AND column_name = 'variantOptions'
  ) THEN
    ALTER TABLE "public"."OrderItem" ADD COLUMN "variantOptions" JSONB;
  END IF;
END;
$$ LANGUAGE plpgsql;
