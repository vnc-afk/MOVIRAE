CREATE TYPE "CalendarItemType" AS ENUM ('release', 'planned', 'reminder');

CREATE TABLE "CalendarItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" TEXT NOT NULL,
    "movieTitle" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "CalendarItemType" NOT NULL,
    "poster" TEXT,
    "genre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarItem_userId_tmdbId_type_date_key" ON "CalendarItem"("userId", "tmdbId", "type", "date");
CREATE INDEX "CalendarItem_userId_date_idx" ON "CalendarItem"("userId", "date");
CREATE INDEX "CalendarItem_userId_type_date_idx" ON "CalendarItem"("userId", "type", "date");

ALTER TABLE "CalendarItem" ADD CONSTRAINT "CalendarItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;