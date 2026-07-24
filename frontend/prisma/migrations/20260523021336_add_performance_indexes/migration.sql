-- CreateIndex
CREATE INDEX "GroupDiscussion_groupId_authorId_idx" ON "GroupDiscussion"("groupId", "authorId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_read_createdAt_idx" ON "Notification"("recipientId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Review_tmdbId_createdAt_idx" ON "Review"("tmdbId", "createdAt");

-- CreateIndex
CREATE INDEX "SharedList_ownerId_createdAt_idx" ON "SharedList"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "SharedListComment_createdAt_idx" ON "SharedListComment"("createdAt");

-- CreateIndex
CREATE INDEX "UserWatchExperience_userId_watchedAt_idx" ON "UserWatchExperience"("userId", "watchedAt");
