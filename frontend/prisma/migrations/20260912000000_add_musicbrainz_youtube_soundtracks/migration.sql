ALTER TABLE "Soundtrack" ADD COLUMN "musicbrainzReleaseId" TEXT;
ALTER TABLE "Soundtrack" ADD COLUMN "musicbrainzReleaseName" TEXT;
ALTER TABLE "SoundtrackTrack" ADD COLUMN "musicbrainzRecordingId" TEXT;
ALTER TABLE "SoundtrackTrack" ADD COLUMN "musicbrainzReleaseId" TEXT;
ALTER TABLE "SoundtrackTrack" ADD COLUMN "musicbrainzArtistId" TEXT;
ALTER TABLE "SoundtrackTrack" ADD COLUMN "youtubeVideoId" TEXT;
CREATE INDEX "SoundtrackTrack_musicbrainzRecordingId_idx" ON "SoundtrackTrack"("musicbrainzRecordingId");
CREATE INDEX "SoundtrackTrack_youtubeVideoId_idx" ON "SoundtrackTrack"("youtubeVideoId");