-- Add nullable name column to User table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE "public"."User" ADD COLUMN "name" TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;
