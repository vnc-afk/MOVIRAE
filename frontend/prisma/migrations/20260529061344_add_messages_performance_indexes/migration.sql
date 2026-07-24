-- CreateIndex
CREATE INDEX "Message_fromId_createdAt_idx" ON "Message"("fromId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_toId_createdAt_idx" ON "Message"("toId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_fromId_toId_createdAt_idx" ON "Message"("fromId", "toId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_toId_fromId_createdAt_idx" ON "Message"("toId", "fromId", "createdAt");
