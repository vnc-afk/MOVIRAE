-- CreateTable
CREATE TABLE "ReviewReplyLike" (
    "id" TEXT NOT NULL,
    "reviewReplyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReplyLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReplyLike_reviewReplyId_userId_key" ON "ReviewReplyLike"("reviewReplyId", "userId");

-- CreateIndex
CREATE INDEX "ReviewReplyLike_reviewReplyId_idx" ON "ReviewReplyLike"("reviewReplyId");

-- CreateIndex
CREATE INDEX "ReviewReplyLike_userId_idx" ON "ReviewReplyLike"("userId");

-- AddForeignKey
ALTER TABLE "ReviewReplyLike" ADD CONSTRAINT "ReviewReplyLike_reviewReplyId_fkey" FOREIGN KEY ("reviewReplyId") REFERENCES "ReviewReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReplyLike" ADD CONSTRAINT "ReviewReplyLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
