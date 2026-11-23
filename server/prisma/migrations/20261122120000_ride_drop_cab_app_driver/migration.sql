-- Cab app and driver name aren't needed: the trip-share link already shows the driver.
-- AlterTable
ALTER TABLE "Ride" DROP COLUMN "cabApp",
DROP COLUMN "driverName";
