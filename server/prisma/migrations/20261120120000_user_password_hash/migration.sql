-- Passwords are ours: bcrypt hash, empty for Google-only accounts.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
