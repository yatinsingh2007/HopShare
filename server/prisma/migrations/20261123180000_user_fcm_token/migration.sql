-- A phone's FCM token, so the server can push when the app is closed. One phone, one account.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fcmToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_fcmToken_key" ON "User"("fcmToken");
