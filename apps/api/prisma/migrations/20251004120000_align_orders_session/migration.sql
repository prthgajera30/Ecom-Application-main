-- Align the relational schema with the current Prisma data model.
-- Adds optional session tracking on orders, richer order accounting fields,
-- shipping option support, and address storage used by checkout.

-- Create Address table if it does not exist.
CREATE TABLE IF NOT EXISTS "public"."Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "fullName" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'Address'
      AND constraint_name = 'Address_userId_fkey'
  ) THEN
    ALTER TABLE "public"."Address"
      ADD CONSTRAINT "Address_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create ShippingOption table if it does not exist.
CREATE TABLE IF NOT EXISTS "public"."ShippingOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "estimatedDaysMin" INTEGER,
    "estimatedDaysMax" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShippingOption_pkey" PRIMARY KEY ("id")
);

-- Extend Order table with checkout metadata used by the API.
ALTER TABLE "public"."Order"
  ADD COLUMN IF NOT EXISTS "sessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "subtotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "shippingAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "promoCode" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingAddress" JSONB,
  ADD COLUMN IF NOT EXISTS "shippingOptionId" TEXT;

CREATE INDEX IF NOT EXISTS "Order_sessionId_idx" ON "public"."Order" ("sessionId");

-- Ensure foreign key to ShippingOption exists when the column is present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Order'
      AND column_name = 'shippingOptionId'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'Order'
        AND constraint_name = 'Order_shippingOptionId_fkey'
    ) THEN
      ALTER TABLE "public"."Order"
        ADD CONSTRAINT "Order_shippingOptionId_fkey"
        FOREIGN KEY ("shippingOptionId") REFERENCES "public"."ShippingOption"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add address relationship from orders to users via saved addresses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Address'
      AND column_name = 'userId'
  ) THEN
    CREATE INDEX IF NOT EXISTS "Address_userId_idx" ON "public"."Address" ("userId");
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Align Payment table with Prisma schema (provider + optional metadata).
ALTER TABLE "public"."Payment"
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Payment'
      AND column_name = 'stripePaymentIntentId'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "public"."Payment"
      ALTER COLUMN "stripePaymentIntentId" DROP NOT NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

