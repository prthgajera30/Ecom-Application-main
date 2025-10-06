-- CreateEnum
CREATE TYPE "ShippingStatus" AS ENUM ('pending', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "actualDelivery" TIMESTAMP(3),
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "estimatedDelivery" TIMESTAMP(3),
ADD COLUMN     "packageWeight" DOUBLE PRECISION,
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippingNotes" TEXT,
ADD COLUMN     "shippingStatus" "ShippingStatus",
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT,
    "cardBrand" TEXT,
    "last4" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_stripePaymentMethodId_key" ON "PaymentMethod"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "TrackingEvent_orderId_idx" ON "TrackingEvent"("orderId");

-- CreateIndex
CREATE INDEX "TrackingEvent_carrier_status_idx" ON "TrackingEvent"("carrier", "status");

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
