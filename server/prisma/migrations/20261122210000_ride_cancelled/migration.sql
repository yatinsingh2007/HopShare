-- The person who started a group can call it off before pickup.
-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "cancelledAt" TIMESTAMP(3);
