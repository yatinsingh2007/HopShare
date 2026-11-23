-- Fare split: the ride's pickup, end and fare; payments in whole paise.
-- "Payment" is empty at this stage, so its amount column is replaced rather than converted.

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "farePaise" INTEGER,
ADD COLUMN     "pickedUpAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "amount",
ADD COLUMN     "amountPaise" INTEGER NOT NULL,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "chatId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_rideId_fromId_key" ON "Payment"("rideId", "fromId");
