-- Safety: trusted contacts, SOS reports and public trip-share links.

-- CreateTable
CREATE TABLE "TrustedContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rideId" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripShare" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "TripShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrustedContact_userId_phone_key" ON "TrustedContact"("userId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "TripShare_token_key" ON "TripShare"("token");

-- CreateIndex
CREATE INDEX "TripShare_rideId_idx" ON "TripShare"("rideId");

-- AddForeignKey
ALTER TABLE "TrustedContact" ADD CONSTRAINT "TrustedContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripShare" ADD CONSTRAINT "TripShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripShare" ADD CONSTRAINT "TripShare_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
