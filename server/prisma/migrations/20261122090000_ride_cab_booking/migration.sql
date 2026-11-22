-- The booker taps "Cab booked" and may add the cab's details for the group.
-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "bookedAt" TIMESTAMP(3),
ADD COLUMN     "cabApp" TEXT,
ADD COLUMN     "cabNumber" TEXT,
ADD COLUMN     "driverName" TEXT,
ADD COLUMN     "tripLink" TEXT;
