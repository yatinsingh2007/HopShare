-- Readable names for the pickup and drop points.
-- Both are required, so this fails if "Ride" already has rows (it should be empty at this stage).
-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "destinationName" TEXT NOT NULL,
ADD COLUMN     "sourceName" TEXT NOT NULL;

