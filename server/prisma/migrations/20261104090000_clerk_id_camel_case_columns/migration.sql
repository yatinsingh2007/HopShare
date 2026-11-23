/*
  Users now sign in with Clerk, so we store their Clerk ID instead of a password.
  Columns now use the same camelCase names as the Prisma schema (no @map).

  Warnings:
  - Adding the required column `clerkId` fails if the `User` table already has rows.
    The table should be empty at this stage; clear it first if it isn't.
  - The `password` column and any data in it are dropped.
  - Columns are renamed, not recreated, so their data is kept.
*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "clerkId" TEXT NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

ALTER TABLE "User" RENAME COLUMN "phone_number" TO "phoneNumber";
ALTER TABLE "User" RENAME COLUMN "upi_id" TO "upiId";
ALTER TABLE "Chat" RENAME COLUMN "ride_id" TO "rideId";

-- Rename indexes and constraints to match Prisma's default names
ALTER INDEX "User_phone_number_key" RENAME TO "User_phoneNumber_key";
ALTER INDEX "Chat_ride_id_key" RENAME TO "Chat_rideId_key";
ALTER TABLE "Chat" RENAME CONSTRAINT "Chat_ride_id_fkey" TO "Chat_rideId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");
