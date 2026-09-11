-- CreateIndex
CREATE INDEX "Review_userId_createdAt_idx" ON "Review"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SharedList_createdAt_idx" ON "SharedList"("createdAt");
