CREATE TABLE "Soundtrack" (
    "id" TEXT NOT NULL,
    "tmdbMovieId" TEXT NOT NULL,
    "movieTitle" TEXT NOT NULL,
    "poster" TEXT,
    "composer" TEXT,
    "spotifyAlbumId" TEXT,
    "spotifyAlbumName" TEXT,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Soundtrack_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SoundtrackTrack" (
    "id" TEXT NOT NULL,
    "soundtrackId" TEXT NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "previewUrl" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "SoundtrackTrack_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UserSoundtrackFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "soundtrackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSoundtrackFavorite_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SoundtrackPlayEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "soundtrackId" TEXT NOT NULL,
    "spotifyTrackId" TEXT,
    "action" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SoundtrackPlayEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SoundtrackMatchOverride" (
    "id" TEXT NOT NULL,
    "tmdbMovieId" TEXT NOT NULL,
    "spotifyAlbumId" TEXT NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SoundtrackMatchOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Soundtrack_tmdbMovieId_key" ON "Soundtrack"("tmdbMovieId");
CREATE UNIQUE INDEX "SoundtrackTrack_soundtrackId_spotifyId_key" ON "SoundtrackTrack"("soundtrackId", "spotifyId");
CREATE UNIQUE INDEX "UserSoundtrackFavorite_userId_soundtrackId_key" ON "UserSoundtrackFavorite"("userId", "soundtrackId");
CREATE UNIQUE INDEX "SoundtrackMatchOverride_tmdbMovieId_key" ON "SoundtrackMatchOverride"("tmdbMovieId");
CREATE INDEX "Soundtrack_spotifyAlbumId_idx" ON "Soundtrack"("spotifyAlbumId");
CREATE INDEX "Soundtrack_lastFetchedAt_idx" ON "Soundtrack"("lastFetchedAt");
CREATE INDEX "SoundtrackTrack_soundtrackId_position_idx" ON "SoundtrackTrack"("soundtrackId", "position");
CREATE INDEX "UserSoundtrackFavorite_userId_createdAt_idx" ON "UserSoundtrackFavorite"("userId", "createdAt");
CREATE INDEX "SoundtrackPlayEvent_soundtrackId_createdAt_idx" ON "SoundtrackPlayEvent"("soundtrackId", "createdAt");
CREATE INDEX "SoundtrackPlayEvent_userId_createdAt_idx" ON "SoundtrackPlayEvent"("userId", "createdAt");
CREATE INDEX "SoundtrackMatchOverride_spotifyAlbumId_idx" ON "SoundtrackMatchOverride"("spotifyAlbumId");
ALTER TABLE "SoundtrackTrack" ADD CONSTRAINT "SoundtrackTrack_soundtrackId_fkey" FOREIGN KEY ("soundtrackId") REFERENCES "Soundtrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSoundtrackFavorite" ADD CONSTRAINT "UserSoundtrackFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSoundtrackFavorite" ADD CONSTRAINT "UserSoundtrackFavorite_soundtrackId_fkey" FOREIGN KEY ("soundtrackId") REFERENCES "Soundtrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SoundtrackPlayEvent" ADD CONSTRAINT "SoundtrackPlayEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SoundtrackPlayEvent" ADD CONSTRAINT "SoundtrackPlayEvent_soundtrackId_fkey" FOREIGN KEY ("soundtrackId") REFERENCES "Soundtrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;