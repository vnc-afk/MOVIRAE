CREATE TABLE "UserWatchExperience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWatchExperience_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserWatchExperience_userId_tmdbId_key" ON "UserWatchExperience"("userId", "tmdbId");
CREATE INDEX "UserWatchExperience_userId_idx" ON "UserWatchExperience"("userId");
CREATE INDEX "UserWatchExperience_tmdbId_idx" ON "UserWatchExperience"("tmdbId");

ALTER TABLE "UserWatchExperience"
ADD CONSTRAINT "UserWatchExperience_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;