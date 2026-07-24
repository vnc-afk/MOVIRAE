-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "discussionId" TEXT,
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "reviewId" TEXT,
ADD COLUMN     "sharedListId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_reviewId_idx" ON "Notification"("reviewId");

-- CreateIndex
CREATE INDEX "Notification_discussionId_idx" ON "Notification"("discussionId");

-- CreateIndex
CREATE INDEX "Notification_eventId_idx" ON "Notification"("eventId");

-- CreateIndex
CREATE INDEX "Notification_sharedListId_idx" ON "Notification"("sharedListId");

-- CreateIndex
CREATE INDEX "Notification_groupId_idx" ON "Notification"("groupId");
