-- Refresh tokens are stateless JWTs now; per-device sessions come back later.
-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropTable
DROP TABLE "Session";
